Claude Meter - Desktop Widget
==============================

REQUIREMENTS
------------
- Node.js (https://nodejs.org) — install LTS version
- Internet connection for first-time npm install

HOW TO BUILD THE INSTALLER
---------------------------
1. Extract this folder anywhere (e.g. C:\claude-meter)
2. Open Command Prompt in that folder
3. Run: npm install
4. Run: npm run build
5. Installer will be created at: dist\Claude Meter Setup 1.0.0.exe
6. Run that .exe to install the app

HOW TO USE
----------
- App floats on top of all windows, bottom-right corner
- Drag the widget to reposition it anywhere
- Use the sliders to update your session % and weekly % from claude.ai/settings/usage
- Values are saved and remembered between launches
- Click X to hide to system tray
- Double-click tray icon to show/hide
- Right-click tray icon: Show / Hide / Toggle auto-start / Quit

ARC COLORS
----------
- Purple  = normal (0-60%)
- Amber   = getting close (61-80%)
- Red     = high usage (81-100%)

AUTO-START
----------
- App auto-starts with Windows by default after install
- Right-click tray icon > uncheck "Auto-start with Windows" to disable
