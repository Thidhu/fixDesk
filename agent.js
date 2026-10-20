// FixDesk helper: lets the technician use mouse/keyboard on THIS computer.
// Run via start.bat / start.command, or: node agent.js [ws://server] [code]
const fs = require('fs'), path = require('path'), readline = require('readline');
const WebSocket = require('ws');
const { mouse, keyboard, screen, Point, Button, Key } = require('@nut-tree-fork/nut-js');
let url, code;
for (const a of process.argv.slice(2)) { if (/^(ws|http)/i.test(a)) url = a; else if (/\d/.test(a)) code = a.replace(/\D/g, ''); }
try { url = url || JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')).server; } catch {}
if (!url) { console.log('No server address found (config.json missing).'); process.exit(1); }
mouse.config.mouseSpeed = 100000; keyboard.config.autoDelayMs = 0;
const special = { Enter:Key.Enter, Backspace:Key.Backspace, Tab:Key.Tab, Escape:Key.Escape, ArrowUp:Key.Up, ArrowDown:Key.Down,
  ArrowLeft:Key.Left, ArrowRight:Key.Right, Delete:Key.Delete, Home:Key.Home, End:Key.End, PageUp:Key.PageUp, PageDown:Key.PageDown,
  Shift:Key.LeftShift, Control:Key.LeftControl, Alt:Key.LeftAlt, Meta:Key.LeftSuper };
const mods = new Set(['Shift', 'Control', 'Alt', 'Meta']); const held = new Set();
const btn = b => [Button.LEFT, Button.MIDDLE, Button.RIGHT][b] ?? Button.LEFT;

function start() {
  const ws = new WebSocket(url.replace(/^http/, 'ws'));
  ws.on('open', () => ws.send(JSON.stringify({ t: 'agent', code })));
  ws.on('error', e => { console.log('Could not reach the server: ' + e.message); process.exit(1); });
  ws.on('close', () => { console.log('Session ended. You can close this window.'); process.exit(0); });
  ws.on('message', async raw => {
    const m = JSON.parse(raw);
    if (m.t === 'ok') { console.log('\nConnected! Your technician can now use the mouse and keyboard.\nKeep this window open. Close it to stop remote control.'); if (process.platform === 'darwin') console.log('(Mac: if nothing works, allow Terminal under Privacy & Security > Accessibility.)'); return; }
    if (m.t === 'error') { console.log('Wrong code. Check the number on the FixDesk page and try again.'); process.exit(1); }
    if (m.t === 'ended') process.exit(0);
    if (m.t !== 'ctl') return;
    try {
      if (m.k === 'move' || m.k === 'down' || m.k === 'up') {
        await mouse.setPosition(new Point(Math.round(m.x * await screen.width()), Math.round(m.y * await screen.height())));
        if (m.k === 'down') await mouse.pressButton(btn(m.b));
        if (m.k === 'up') await mouse.releaseButton(btn(m.b));
      } else if (m.k === 'wheel') {
        const n = Math.min(Math.ceil(Math.abs(m.dy) / 40), 20);
        m.dy > 0 ? await mouse.scrollDown(n) : await mouse.scrollUp(n);
      } else if (m.k === 'text') {
        await keyboard.type(String(m.text).slice(0, 5000));
      } else if (m.k === 'key') {
        const sp = special[m.key];
        if (mods.has(m.key)) { m.down ? held.add(m.key) : held.delete(m.key); }
        if (sp) return m.down ? keyboard.pressKey(sp) : keyboard.releaseKey(sp);
        if (m.key.length === 1 && m.down) {
          const chord = [...held].some(k => k !== 'Shift');
          if (!chord) return keyboard.type(m.key);
          const kk = /\d/.test(m.key) ? Key['Num' + m.key] : Key[m.key.toUpperCase()];
          if (kk !== undefined) { await keyboard.pressKey(kk); await keyboard.releaseKey(kk); }
        }
      }
    } catch (e) { console.error(e.message); }
  });
}
if (code) start();
else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Enter the 9-digit code shown on the FixDesk page: ', a => { rl.close(); code = a.replace(/\D/g, ''); start(); });
}
