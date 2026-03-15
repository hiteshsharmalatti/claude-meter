# Claude Meter

> Stop checking Claude's usage page every 5 minutes.

A tiny desktop widget that auto-reads your session & weekly limits — always visible, always on top.

> **Claude Pro and Max subscribers only.** Does not work with the Claude API, free accounts, or Enterprise/Teams plans.

![Claude Meter Widget](https://i.imgur.com/placeholder.png)

---

## Why

If you use Claude heavily, you've been there — switching tabs every few minutes just to check how much session you have left. Claude Meter puts that number on your screen permanently, updates it automatically, and stays out of your way.

---

## Features

| | |
|---|---|
| ⏱ **Auto-refreshes every minute** | Reads directly from claude.ai — no manual input needed |
| 🪟 **Always on top, tiny footprint** | Floats over all windows, drag it anywhere |
| 🎨 **Color-coded gauges** | Green → amber → red as limits approach |
| ↺ **Session reset countdown** | Shows exactly how long until your session resets |
| 📅 **Weekly reset date** | Displays your weekly limit reset day and time |
| ◑ **Light & dark mode** | Toggle with one click, preference saved |
| 🔔 **System tray / menu bar** | Hides away when you don't need it |
| 🚀 **Launch at login** | Optional, toggle in tray menu |

---

## Download

Go to [Releases](../../releases) and grab the latest:

| Platform | File |
|----------|------|
| Windows  | `Claude Meter Setup x.x.x.exe` |
| macOS    | `Claude Meter-x.x.x.dmg` |

---

## Install

### Windows
1. Download the `.exe` and double-click to install
2. **SmartScreen warning will appear** — click **"More info"** then **"Run anyway"** *(app is unsigned, this is normal for open-source tools)*
3. Widget appears bottom-right — click **"Sign in to claude.ai"** once, done. Auto-updates from then on.

### macOS
1. Download the `.dmg`, open it, drag the app to Applications
2. On first launch go to **System Settings → Privacy & Security** and allow the app to run
3. Same as Windows — sign in once and you're set

---

## Build from Source

**Requirements:** [Node.js](https://nodejs.org) 18+

```bash
git clone https://github.com/YOUR_USERNAME/claude-meter.git
cd claude-meter
npm install
npm start
```

**Build installer:**
```bash
npm run build:win   # Windows → dist/Claude Meter Setup x.x.x.exe
npm run build:mac   # macOS  → dist/Claude Meter-x.x.x.dmg
```

> macOS builds must be run on a Mac. Windows builds can be run on any OS.

---

## How It Works

Claude Meter opens a hidden browser window, loads your `claude.ai/settings/usage` page using your existing session cookie, scrapes the usage percentages, and displays them in the widget. **Your credentials are never stored** — it relies entirely on your existing browser session.

---

## Usage

- **Drag** the widget anywhere on screen
- **↻** button or tray → *Refresh Now* to force a refresh
- **−** minimises to tray, **✕** also hides to tray (keeps running)
- **Double-click** the tray icon to show/hide
- **◑** toggles light/dark mode

---

## Free · Open Source · Windows & macOS

`#Claude` `#AI` `#ProductivityTools` `#BuildInPublic`

---

## License

MIT
