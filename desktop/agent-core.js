// Mouse/keyboard control, driven by events relayed from the technician via the server.
const WebSocket = require('ws');
const { mouse, keyboard, screen, Point, Button, Key } = require('@nut-tree-fork/nut-js');
mouse.config.mouseSpeed = 100000; keyboard.config.autoDelayMs = 0;
const special = { Enter:Key.Enter, Backspace:Key.Backspace, Tab:Key.Tab, Escape:Key.Escape, ArrowUp:Key.Up, ArrowDown:Key.Down,
  ArrowLeft:Key.Left, ArrowRight:Key.Right, Delete:Key.Delete, Home:Key.Home, End:Key.End, PageUp:Key.PageUp, PageDown:Key.PageDown,
  Shift:Key.LeftShift, Control:Key.LeftControl, Alt:Key.LeftAlt, Meta:Key.LeftSuper };
const mods = new Set(['Shift', 'Control', 'Alt', 'Meta']);
const btn = b => [Button.LEFT, Button.MIDDLE, Button.RIGHT][b] ?? Button.LEFT;

function startAgent(server, code, onStatus = () => {}) {
  const ws = new WebSocket(server.replace(/^http/, 'ws')), held = new Set();
  ws.on('open', () => ws.send(JSON.stringify({ t: 'agent', code })));
  ws.on('error', () => onStatus('error'));
  ws.on('close', () => onStatus('closed'));
  ws.on('message', async raw => {
    const m = JSON.parse(raw);
    if (m.t === 'ok') return onStatus('connected');
    if (m.t === 'error' || m.t === 'ended') return ws.close();
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
          if (![...held].some(k => k !== 'Shift')) return keyboard.type(m.key);
          const kk = /\d/.test(m.key) ? Key['Num' + m.key] : Key[m.key.toUpperCase()];
          if (kk !== undefined) { await keyboard.pressKey(kk); await keyboard.releaseKey(kk); }
        }
      }
    } catch (e) { console.error(e.message); }
  });
  return { stop: () => { for (const k of held) { const s = special[k]; if (s) keyboard.releaseKey(s).catch(() => {}); } ws.close(); } };
}
module.exports = { startAgent };
