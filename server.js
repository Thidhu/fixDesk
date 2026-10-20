// Signaling server: creates rooms, relays WebRTC handshakes, gates control events.
const express = require('express'), http = require('http'), crypto = require('crypto');
const { WebSocketServer } = require('ws');
const archiver = require('archiver'), fs = require('fs'), path = require('path');
const app = express(); app.use(express.static('public'));
const H = f => fs.readFileSync(path.join(__dirname, 'helper', f), 'utf8');
app.get('/download/agent.zip', (req, res) => {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol) === 'https' ? 'wss' : 'ws';
  const dir = 'FixDesk-Helper/', z = archiver('zip');
  res.attachment('FixDesk-Helper.zip'); z.pipe(res);
  z.append(fs.readFileSync(path.join(__dirname, 'agent.js')), { name: dir + 'agent.js' });
  z.append(JSON.stringify({ server: proto + '://' + req.headers.host }), { name: dir + 'config.json' });
  z.append(H('package.json'), { name: dir + 'package.json' });
  z.append(H('start.bat').replace(/\r?\n/g, '\r\n'), { name: dir + 'start.bat' });
  z.append(H('start.command'), { name: dir + 'start.command', mode: 0o755 });
  z.append(H('README.txt'), { name: dir + 'README.txt' });
  z.finalize();
});
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const rooms = new Map(); // code -> {host, viewers:Map, agent, view:Set, control:Set}
const send = (ws, o) => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));

wss.on('connection', ws => {
  ws.id = crypto.randomBytes(4).toString('hex'); ws.fails = 0;
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const room = rooms.get(ws.code);
    if (m.t === 'host') {
      let code; do { code = String(crypto.randomInt(100000000, 999999999)); } while (rooms.has(code));
      rooms.set(code, { host: ws, viewers: new Map(), agent: null, view: new Set(), control: new Set() });
      ws.code = code; ws.role = 'host'; send(ws, { t: 'code', code });
    } else if (m.t === 'join' || m.t === 'agent') {
      const r = rooms.get(String(m.code || '').replace(/\D/g, ''));
      if (!r) { if (++ws.fails > 5) ws.close(); return send(ws, { t: 'error', msg: 'Invalid code' }); }
      ws.code = String(m.code).replace(/\D/g, '');
      if (m.t === 'agent') { ws.role = 'agent'; r.agent = ws; send(r.host, { t: 'agent', on: true }); r.control.forEach(id => send(r.viewers.get(id), { t: 'agent', on: true })); send(ws, { t: 'ok' }); }
      else { ws.role = 'viewer'; r.viewers.set(ws.id, ws); send(r.host, { t: 'request', id: ws.id }); send(ws, { t: 'waiting' }); }
    } else if (!room) return;
    else if (m.t === 'decide' && ws.role === 'host') {       // host consent: 'deny' | 'view' | 'control'
      const v = room.viewers.get(m.id); if (!v) return;
      if (m.mode === 'view' || m.mode === 'control') room.view.add(m.id);
      if (m.mode === 'control') room.control.add(m.id);
      send(v, { t: 'decision', mode: m.mode, agent: !!room.agent });
    } else if (m.t === 'sig') {
      if (ws.role === 'host') send(room.viewers.get(m.to), { t: 'sig', data: m.data });
      else if (ws.role === 'viewer' && room.view.has(ws.id)) send(room.host, { t: 'sig', from: ws.id, data: m.data });
    } else if (m.t === 'ctl' && ws.role === 'viewer' && room.control.has(ws.id)) {
      send(room.agent, m);
    } else if (m.t === 'revoke' && ws.role === 'host') {
      room.view.clear(); room.control.clear();
      room.viewers.forEach(v => send(v, { t: 'ended' }));
    }
  });
  ws.on('close', () => {
    const room = rooms.get(ws.code); if (!room) return;
    if (ws.role === 'host') { room.viewers.forEach(v => send(v, { t: 'ended' })); send(room.agent, { t: 'ended' }); rooms.delete(ws.code); }
    else if (ws.role === 'viewer') { room.viewers.delete(ws.id); room.view.delete(ws.id); room.control.delete(ws.id); send(room.host, { t: 'left', id: ws.id }); }
    else if (ws.role === 'agent') { room.agent = null; send(room.host, { t: 'agent', on: false }); room.control.forEach(id => send(room.viewers.get(id), { t: 'agent', on: false })); }
  });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('FixDesk running on http://localhost:' + PORT));
