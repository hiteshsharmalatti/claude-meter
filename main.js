const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

// ─── Single-instance lock ─────────────────────────────────────────────────────
// Prevents multiple copies running when user clicks the shortcut more than once.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

app.on('second-instance', () => {
  // A second launch attempt: just bring the widget into view
  if (win && !win.isDestroyed()) win.show();
});

// ─────────────────────────────────────────────────────────────────────────────

let win, scrapeWin, tray;
let isScraping = false;
let isLoginOpen = false;
let loginListenersAttached = false;
let scrapeInterval = null;

// ─── Scrape window ────────────────────────────────────────────────────────────

function createScrapeWin() {
  if (scrapeWin && !scrapeWin.isDestroyed()) return;
  scrapeWin = new BrowserWindow({
    width: 960,
    height: 720,
    show: false,
    title: 'Claude Meter - Sign In',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: 'persist:claudescrape'
    }
  });
  scrapeWin.on('closed', () => {
    scrapeWin = null;
    loginListenersAttached = false;
  });
  // Prevent scrape window from appearing in taskbar
  scrapeWin.setSkipTaskbar(true);
}

// ─── Scrape logic ─────────────────────────────────────────────────────────────

const SCRAPE_JS = `
(function() {
  try {
    var results = [];

    // Verify we are actually on the usage page
    if (!window.location.href.includes('settings/usage')) {
      return { error: 'not_on_usage_page', url: window.location.href };
    }

    // Method 1: aria-valuenow on progress bars
    var bars = document.querySelectorAll('[role="progressbar"]');
    bars.forEach(function(el) {
      var val = el.getAttribute('aria-valuenow');
      if (val !== null) {
        var n = parseFloat(val);
        if (!isNaN(n) && n >= 0 && n <= 100) results.push(n);
      }
    });

    // Method 2: text "XX% used" anywhere on page
    if (results.length < 2) {
      results = [];
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        var m = node.textContent.trim().match(/^(\\d+)%\\s*used$/i);
        if (m) {
          var n = parseInt(m[1]);
          if (n >= 0 && n <= 100) results.push(n);
        }
      }
    }

    // Method 3: inline width% on progress fill divs
    if (results.length < 2) {
      results = [];
      var fills = document.querySelectorAll('div[style*="width"]');
      fills.forEach(function(el) {
        var s = el.style.width;
        if (s && s.endsWith('%')) {
          var v = parseFloat(s);
          if (v >= 0 && v <= 100) results.push(v);
        }
      });
    }

    if (results.length === 0) {
      return { error: 'no_data_found', url: window.location.href };
    }

    // Extract session + weekly reset times in one pass
    var resetIn = null, weeklyReset = null;
    var rWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var rNode;
    while ((rNode = rWalker.nextNode()) && (!resetIn || !weeklyReset)) {
      var rText = rNode.textContent.trim();
      if (!resetIn && rText.startsWith('Resets in ')) {
        resetIn = rText.replace('Resets in ', '')
          .replace(' hr ', 'h ')
          .replace(/ hr$/, 'h')
          .replace(' min', 'm')
          .trim();
      } else if (!weeklyReset && /^Resets [A-Z][a-z]/.test(rText)) {
        // e.g. "Resets Fri 6:30 PM" → "Fri 6:30 PM"
        weeklyReset = rText.replace('Resets ', '').trim();
      }
    }

    return {
      session:     results.length > 0 ? Math.round(results[0]) : null,
      weekly:      results.length > 1 ? Math.round(results[1]) : null,
      resetIn:     resetIn,
      weeklyReset: weeklyReset
    };
  } catch(e) {
    return { error: e.message };
  }
})()
`;

function scrapeUsage() {
  // Prevent overlapping scrape calls, and don't interrupt the login flow
  if (isScraping || isLoginOpen) return;
  isScraping = true;

  createScrapeWin();
  if (!scrapeWin || scrapeWin.isDestroyed()) {
    isScraping = false;
    return;
  }

  // Remove any previous load listener to avoid stacking
  scrapeWin.webContents.removeAllListeners('did-finish-load');

  scrapeWin.loadURL('https://claude.ai/settings/usage');

  const onLoad = () => {
    // Check we actually landed on usage page, not redirected to login
    const currentURL = scrapeWin ? scrapeWin.webContents.getURL() : '';
    if (!currentURL.includes('settings/usage')) {
      // Redirected to login — user not signed in
      isScraping = false;
      if (win && !win.isDestroyed()) {
        win.webContents.send('usage-update', { error: 'not_logged_in' });
      }
      return;
    }

    // Wait for React to render the progress bars
    setTimeout(() => {
      if (!scrapeWin || scrapeWin.isDestroyed()) {
        isScraping = false;
        return;
      }
      scrapeWin.webContents.executeJavaScript(SCRAPE_JS)
        .then(result => {
          isScraping = false;
          if (win && !win.isDestroyed()) {
            win.webContents.send('usage-update', result);
          }
        })
        .catch(err => {
          isScraping = false;
          if (win && !win.isDestroyed()) {
            win.webContents.send('usage-update', { error: err.message });
          }
        });
    }, 4000);
  };

  scrapeWin.webContents.once('did-finish-load', onLoad);

  // Timeout safety — if page never loads in 15s, release the lock and notify UI
  setTimeout(() => {
    if (isScraping) {
      isScraping = false;
      if (scrapeWin && !scrapeWin.isDestroyed()) {
        scrapeWin.webContents.removeAllListeners('did-finish-load');
      }
      if (win && !win.isDestroyed()) {
        win.webContents.send('usage-update', { error: 'timeout' });
      }
    }
  }, 15000);
}

// ─── App ready ────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // On macOS, hide from the Dock — this is a menu bar widget, not a dock app
  if (process.platform === 'darwin') app.dock.hide();

  win = new BrowserWindow({
    width: 245,
    height: 165,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');

  // When restored from taskbar, go back to floating widget (no taskbar entry)
  win.on('restore', () => win.setSkipTaskbar(true));

  const { screen } = require('electron');
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win.setPosition(width - 260, height - 200);

  // Initial scrape after app is ready, then every 60s
  setTimeout(scrapeUsage, 3000);
  scrapeInterval = setInterval(scrapeUsage, 60 * 1000);

  // ── Tray ──────────────────────────────────────────────────────────────────
  const iconPath = path.join(__dirname, 'icon.png');
  let appIcon = nativeImage.createFromPath(iconPath);
  // macOS menu bar icons should be small (22px); Windows system tray handles scaling itself
  if (!appIcon.isEmpty() && process.platform === 'darwin') {
    appIcon = appIcon.resize({ width: 22, height: 22 });
  }
  tray = new Tray(appIcon.isEmpty() ? nativeImage.createEmpty() : appIcon);
  tray.setToolTip('Claude Meter');

  const buildMenu = () => Menu.buildFromTemplate([
    { label: 'Show', click: () => { if (win && !win.isDestroyed()) win.show(); } },
    { label: 'Hide', click: () => { if (win && !win.isDestroyed()) win.hide(); } },
    { label: 'Refresh Now', click: () => scrapeUsage() },
    { type: 'separator' },
    {
      label: process.platform === 'darwin' ? 'Launch at Login' : 'Auto-start with Windows',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
        tray.setContextMenu(buildMenu());
      }
    },
    { type: 'separator' },
    { label: 'Quit Claude Meter', click: () => app.quit() }
  ]);

  tray.setContextMenu(buildMenu());
  tray.on('double-click', () => {
    if (win && !win.isDestroyed()) {
      win.isVisible() ? win.hide() : win.show();
    }
  });
});

// ─── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.on('minimize', () => {
  if (win && !win.isDestroyed()) {
    win.setSkipTaskbar(false); // make it visible in taskbar while minimised
    win.minimize();
  }
});

ipcMain.on('close', () => {
  if (win && !win.isDestroyed()) win.hide();
});

ipcMain.on('manual-refresh', () => {
  isScraping = false; // force-release lock for manual refresh
  scrapeUsage();
});

ipcMain.on('open-login', () => {
  // Prevent stacking multiple login listeners
  if (loginListenersAttached) return;

  createScrapeWin();
  if (!scrapeWin || scrapeWin.isDestroyed()) return;

  loginListenersAttached = true;
  isLoginOpen = true;
  scrapeWin.loadURL('https://claude.ai/login');
  scrapeWin.show();

  let loginDone = false;

  const onNavigate = (e, url) => {
    if (loginDone) return;

    // Ignore navigations that are still part of the login/auth flow
    const stillLoggingIn =
      url.includes('/login') ||
      url.includes('/auth') ||
      url.includes('/oauth') ||
      url.includes('accounts.google') ||
      url.includes('apple.com/auth') ||
      !url.includes('claude.ai');

    if (stillLoggingIn) return;

    // Landed on a real claude.ai page — login successful
    loginDone = true;
    loginListenersAttached = false;

    if (scrapeWin && !scrapeWin.isDestroyed()) {
      scrapeWin.webContents.removeListener('did-navigate', onNavigate);
      scrapeWin.webContents.removeListener('did-navigate-in-page', onNavigate);
    }

    // Hide login window after short delay then scrape
    setTimeout(() => {
      if (scrapeWin && !scrapeWin.isDestroyed()) scrapeWin.hide();
      isLoginOpen = false;
      isScraping = false;
      scrapeUsage();
    }, 2500);
  };

  scrapeWin.webContents.on('did-navigate', onNavigate);
  scrapeWin.webContents.on('did-navigate-in-page', onNavigate);

  // Allow user to close login window manually
  scrapeWin.once('close', () => {
    loginListenersAttached = false;
    loginDone = true;
    isLoginOpen = false;
  });
});

app.on('window-all-closed', (e) => e.preventDefault());

// macOS: clicking the menu bar icon should show the widget
app.on('activate', () => {
  if (win && !win.isDestroyed()) win.show();
});

app.on('before-quit', () => {
  if (scrapeInterval) clearInterval(scrapeInterval);
});
