const { app, BrowserWindow, session, desktopCapturer, ipcMain, systemPreferences, shell } = require('electron');
const path = require('path'), fs = require('fs');
const { startAgent } = require('./agent-core');
let cfg = { server: 'http://localhost:3000' };
try { cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')); } catch {}
const origin = new URL(cfg.server).origin;
let win, agent = null;

function createWindow() {
  win = new BrowserWindow({ width: 1100, height: 720, title: 'FixDesk', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.loadURL(cfg.server);
  win.webContents.on('did-fail-load', () => win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
    '<body style="font:18px system-ui;background:#0f172a;color:#e2e8f0;text-align:center;padding-top:20vh"><h2>Cannot reach FixDesk</h2><p>Check your internet connection, then restart the app.</p></body>')));
  win.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('http')) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (new URL(url).origin !== origin && !url.startsWith('data:')) e.preventDefault(); });
}

app.whenReady().then(() => {
  // Share the main screen without a picker popup (customer already clicked "Share my screen").
  session.defaultSession.setDisplayMediaRequestHandler(async (req, cb) => {
    const src = await desktopCapturer.getSources({ types: ['screen'] });
    src.length ? cb({ video: src[0] }) : cb({});
  });
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['display-capture', 'media', 'fullscreen'].includes(perm)));
  createWindow();
});

const trusted = e => { try { return new URL(e.senderFrame.url).origin === origin; } catch { return false; } };
ipcMain.handle('agent:start', (e, code) => {
  if (!trusted(e) || !/^\d{9}$/.test(code)) return { ok: false };
  if (process.platform === 'darwin') systemPreferences.isTrustedAccessibilityClient(true); // asks for Accessibility
  agent?.stop();
  agent = startAgent(cfg.server, code, s => win?.webContents.send('agent:status', s));
  return { ok: true };
});
ipcMain.handle('agent:stop', e => { if (trusted(e)) { agent?.stop(); agent = null; } });
app.on('window-all-closed', () => { agent?.stop(); app.quit(); });
