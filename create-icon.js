const fs   = require('fs');
const path = require('path');

const iconPath = path.join(__dirname, 'icon.png');

// Skip generation if the file already exists
if (fs.existsSync(iconPath)) process.exit(0);

const { app, BrowserWindow, ipcMain } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 256,
    height: 256,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, 'icon-gen.html'));

  ipcMain.once('icon-data', (e, dataUrl) => {
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(iconPath, Buffer.from(base64, 'base64'));
    console.log('icon.png created successfully.');
    app.quit();
  });

  // Safety timeout — quit if renderer never responds
  setTimeout(() => {
    console.error('Icon generation timed out.');
    process.exit(1);
  }, 10000);
});

app.on('window-all-closed', () => app.quit());
