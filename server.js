/**
 * server.js  — Server HTTP locale con dashboard HTML live
 * Uso: node src/server.js
 * Apri: http://localhost:3000
 *
 * Espone:
 *   GET /api/live        → snapshot corrente JSON
 *   GET /api/airport/:icao → copertura per aeroporto
 *   GET /events          → SSE stream (aggiornamenti ogni 15s)
 *   GET /               → dashboard HTML
 */

import { createServer } from 'node:http';
import { fetchAll } from './fetcher.js';
import { normalizeVATSIM, normalizeIVAO, diffSnapshots } from './normalizer.js';

const PORT = 3000;
const POLL_MS = 15_000;

// ─── Stato globale ────────────────────────────────────────────────────────────
let currentSnapshot = [];
let lastFetchTime   = null;
let fetchErrors     = { vatsim: null, ivao: null };
let sseClients      = new Set();
let cycleCount      = 0;

// ─── Poller interno ───────────────────────────────────────────────────────────
async function pollOnce() {
  const { vatsim, ivao, errors } = await fetchAll();
  fetchErrors = errors;

  const vPos = vatsim ? normalizeVATSIM(vatsim).positions : [];
  const iPos = ivao   ? normalizeIVAO(ivao).positions     : [];
  const next = [...vPos, ...iPos];

  const { newOnline, wentOffline } = diffSnapshots(currentSnapshot, next);
  currentSnapshot = next;
  lastFetchTime   = new Date().toISOString();
  cycleCount++;

  // Notifica SSE clients se ci sono cambiamenti
  if (newOnline.length > 0 || wentOffline.length > 0) {
    broadcastSSE({
      type:       'diff',
      newOnline,
      wentOffline,
      timestamp:  lastFetchTime,
      totalCount: currentSnapshot.length,
    });
  } else {
    broadcastSSE({ type: 'heartbeat', timestamp: lastFetchTime, totalCount: currentSnapshot.length });
  }

  const airports = new Set(currentSnapshot.map(p => p.icao)).size;
  process.stdout.write(
    `\r[${lastFetchTime.slice(11,19)}] posizioni: ${currentSnapshot.length} | ` +
    `aeroporti: ${airports} | VATSIM:${errors.vatsim?'ERR':'OK'} IVAO:${errors.ivao?'ERR':'OK'} | ` +
    `ciclo #${cycleCount}   `
  );
}

function broadcastSSE(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch { sseClients.delete(client); }
  }
}

// ─── HTML dashboard ───────────────────────────────────────────────────────────
function buildHTML() {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ATC Coverage POC</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f8f8f6; color: #1a1a1a; font-size: 14px; }
    header { background: #1a1a1a; color: #fff; padding: 12px 20px; display: flex; align-items: center; gap: 12px; }
    header h1 { font-size: 16px; font-weight: 500; }
    .badge { font-size: 11px; padding: 2px 8px; border-radius: 99px; font-weight: 500; }
    .badge.vatsim { background: #d1e8ff; color: #0047ab; }
    .badge.ivao   { background: #d1f5e0; color: #005c2e; }
    .controls { padding: 12px 20px; background: #fff; border-bottom: 1px solid #e0e0dc; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .controls input, .controls select { padding: 6px 10px; border: 1px solid #d0d0cc; border-radius: 6px; font-size: 13px; background: #fafaf8; }
    .controls input { width: 120px; text-transform: uppercase; }
    .status-bar { display: flex; gap: 12px; padding: 10px 20px; background: #f0f0ec; border-bottom: 1px solid #e0e0dc; font-size: 12px; flex-wrap: wrap; }
    .stat { display: flex; gap: 4px; align-items: baseline; }
    .stat .label { color: #666; }
    .stat .value { font-weight: 600; }
    .stat.ok .value { color: #1a7a3a; }
    .stat.err .value { color: #c0392b; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; padding: 16px 20px; }
    .card { background: #fff; border: 1px solid #e0e0dc; border-radius: 10px; padding: 12px 14px; }
    .card.new-flash { animation: flash 1.5s ease; }
    @keyframes flash { 0%,100%{background:#fff} 30%{background:#e8fff0} }
    .card-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
    .callsign { font-family: monospace; font-size: 14px; font-weight: 600; }
    .pos-badge { font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 500; display: inline-block; margin-bottom: 6px; }
    .GND { background: #e8f5e9; color: #1b5e20; }
    .TWR { background: #e3f2fd; color: #0d47a1; }
    .APP { background: #f1f8e9; color: #33691e; }
    .DEP { background: #fce4ec; color: #880e4f; }
    .CTR { background: #fbe9e7; color: #bf360c; }
    .DEL { background: #ede7f6; color: #311b92; }
    .ATIS{ background: #f5f5f5; color: #424242; }
    .FSS { background: #f3e5f5; color: #4a148c; }
    .meta { font-size: 12px; color: #555; line-height: 1.7; }
    .meta code { font-family: monospace; color: #1a1a1a; background: #f0f0ec; padding: 1px 4px; border-radius: 3px; font-size: 11px; }
    .atis-text { font-size: 11px; font-family: monospace; background: #f8f8f6; border: 1px solid #e8e8e4; border-radius: 4px; padding: 6px 8px; margin-top: 8px; line-height: 1.5; max-height: 80px; overflow: hidden; color: #444; }
    .empty { text-align: center; padding: 40px; color: #888; grid-column: 1/-1; }
    .sse-dot { width: 8px; height: 8px; border-radius: 50%; background: #ccc; display: inline-block; margin-left: 8px; }
    .sse-dot.connected { background: #2ecc71; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    .airport-group { font-size: 11px; color: #888; padding: 2px 20px 4px; border-top: 1px solid #f0f0ec; margin-top: 4px; }
    footer { padding: 12px 20px; font-size: 11px; color: #888; border-top: 1px solid #e8e8e4; }
  </style>
</head>
<body>
  <header>
    <h1>ATC Coverage POC</h1>
    <span class="badge vatsim">VATSIM</span>
    <span class="badge ivao">IVAO</span>
    <span style="margin-left:auto;font-size:12px;color:#aaa">
      SSE live<span id="sseDot" class="sse-dot"></span>
    </span>
  </header>

  <div class="controls">
    <input type="text" id="icaoInput" placeholder="Filtra ICAO" maxlength="4" oninput="render()" />
    <select id="netFilter" onchange="render()">
      <option value="">Tutte le reti</option>
      <option value="VATSIM">VATSIM</option>
      <option value="IVAO">IVAO</option>
    </select>
    <select id="posFilter" onchange="render()">
      <option value="">Tutti i tipi</option>
      <option value="ATIS">ATIS</option>
      <option value="DEL">Delivery</option>
      <option value="GND">Ground</option>
      <option value="TWR">Tower</option>
      <option value="APP">Approach</option>
      <option value="DEP">Departure</option>
      <option value="CTR">Center/FIR</option>
    </select>
    <span id="countLabel" style="font-size:12px;color:#888;margin-left:auto"></span>
  </div>

  <div class="status-bar">
    <div class="stat" id="statVatsim"><span class="label">VATSIM</span><span class="value">—</span></div>
    <div class="stat" id="statIvao"><span class="label">IVAO</span><span class="value">—</span></div>
    <div class="stat"><span class="label">Posizioni:</span><span class="value" id="statTotal">—</span></div>
    <div class="stat"><span class="label">Aeroporti:</span><span class="value" id="statAirports">—</span></div>
    <div class="stat"><span class="label">Ultimo aggiornamento:</span><span class="value" id="statTime">—</span></div>
  </div>

  <div class="grid" id="grid">
    <div class="empty">Connessione in corso...</div>
  </div>

  <footer>
    POC locale · I dati provengono da VATSIM e IVAO tramite API pubbliche · Aggiornamento ogni 15s
  </footer>

  <script>
    const POS_LABELS = { ATIS:'ATIS', DEL:'Delivery', GND:'Ground', TWR:'Tower', APP:'Approach', DEP:'Departure', CTR:'Center/FIR', FSS:'Flight Svc' };
    let positions = [];

    async function loadInitial() {
      try {
        const res = await fetch('/api/live');
        const data = await res.json();
        positions = data.positions;
        updateStats(data);
        render();
      } catch(e) { console.error(e); }
    }

    function updateStats(data) {
      document.getElementById('statTotal').textContent = data.totalCount ?? positions.length;
      document.getElementById('statAirports').textContent = new Set(positions.map(p=>p.icao)).size;
      document.getElementById('statTime').textContent = data.lastFetch?.slice(11,19)+' UTC' ?? '—';
      const sv = document.getElementById('statVatsim');
      const si = document.getElementById('statIvao');
      sv.className = 'stat ' + (data.errors?.vatsim ? 'err':'ok');
      sv.querySelector('.value').textContent = data.errors?.vatsim ? 'ERR' : 'OK';
      si.className = 'stat ' + (data.errors?.ivao ? 'err':'ok');
      si.querySelector('.value').textContent = data.errors?.ivao ? 'ERR' : 'OK';
    }

    function render() {
      const icao = document.getElementById('icaoInput').value.trim().toUpperCase();
      const net  = document.getElementById('netFilter').value;
      const pos  = document.getElementById('posFilter').value;
      let filtered = positions.filter(p =>
        (!icao || p.icao.startsWith(icao)) &&
        (!net  || p.network === net) &&
        (!pos  || p.positionType === pos)
      ).sort((a,b) => a.icao.localeCompare(b.icao));

      document.getElementById('countLabel').textContent = filtered.length + ' posizioni';
      const grid = document.getElementById('grid');
      if (!filtered.length) {
        grid.innerHTML = '<div class="empty">Nessuna posizione trovata.</div>';
        return;
      }
      grid.innerHTML = filtered.map(p => {
        const since = p.logonTime ? new Date(p.logonTime).toISOString().slice(11,16)+'z' : (p.onlineSeconds ? Math.floor(p.onlineSeconds/3600)+'h'+Math.floor((p.onlineSeconds%3600)/60)+'m' : '—');
        const atisHtml = p.atis?.length ? '<div class="atis-text">'+(Array.isArray(p.atis)?p.atis.join(' · '):p.atis).replace(/</g,'&lt;').slice(0,200)+'</div>' : '';
        const coords = (p.latitude&&p.longitude) ? '<br>pos: <code>'+p.latitude.toFixed(3)+', '+p.longitude.toFixed(3)+'</code>' : '';
        return \`<div class="card" id="card-\${p.network}-\${p.callsign.replace(/[^A-Z0-9]/g,'')}">
          <div class="card-head">
            <div class="callsign">\${p.callsign}</div>
            <span class="badge \${p.network.toLowerCase()}">\${p.network}</span>
          </div>
          <div><span class="pos-badge \${p.positionType}">\${POS_LABELS[p.positionType]||p.positionType}</span></div>
          <div class="meta">icao: <code>\${p.icao}</code><br>freq: <code>\${p.frequency} MHz</code><br>online da: <code>\${since}</code>\${coords}</div>
          \${atisHtml}
        </div>\`;
      }).join('');
    }

    // SSE
    const evtSource = new EventSource('/events');
    evtSource.onopen = () => {
      document.getElementById('sseDot').className = 'sse-dot connected';
    };
    evtSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'diff') {
        // Ricarica dati freschi
        fetch('/api/live').then(r=>r.json()).then(d => {
          positions = d.positions;
          updateStats(d);
          render();
          // Flash cards nuove
          for (const p of data.newOnline) {
            const id = 'card-'+p.network+'-'+p.callsign.replace(/[^A-Z0-9]/g,'');
            const el = document.getElementById(id);
            if (el) { el.classList.remove('new-flash'); void el.offsetWidth; el.classList.add('new-flash'); }
          }
        });
      } else if (data.type === 'heartbeat') {
        document.getElementById('statTime').textContent = data.timestamp?.slice(11,19)+' UTC';
        document.getElementById('statTotal').textContent = data.totalCount;
      }
    };
    evtSource.onerror = () => {
      document.getElementById('sseDot').className = 'sse-dot';
    };

    loadInitial();
  </script>
</body>
</html>`;
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(buildHTML());
    return;
  }

  if (path === '/api/live') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      positions:   currentSnapshot,
      totalCount:  currentSnapshot.length,
      lastFetch:   lastFetchTime,
      cycleCount,
      errors:      fetchErrors,
    }));
    return;
  }

  if (path.startsWith('/api/airport/')) {
    const icao = path.split('/')[3]?.toUpperCase();
    const filtered = currentSnapshot.filter(p => p.icao === icao);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ icao, positions: filtered, count: filtered.length }));
    return;
  }

  if (path === '/events') {
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// ─── Avvio ────────────────────────────────────────────────────────────────────
console.log(`\n━━━ ATC Coverage Server ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Dashboard:  http://localhost:${PORT}`);
console.log(`API live:   http://localhost:${PORT}/api/live`);
console.log(`Aeroporto:  http://localhost:${PORT}/api/airport/LIRF`);
console.log(`SSE:        http://localhost:${PORT}/events`);
console.log(`Polling ogni ${POLL_MS/1000}s · Ctrl+C per fermare\n`);

server.listen(PORT, async () => {
  console.log('Primo fetch in corso...\n');
  await pollOnce();
  setInterval(async () => {
    const jitter = Math.random() * 2000;
    await new Promise(r => setTimeout(r, jitter));
    await pollOnce();
  }, POLL_MS);
});
