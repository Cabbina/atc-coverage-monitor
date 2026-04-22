/**
 * index.js  — Poller continuo con diff engine
 * Uso: node src/index.js [ICAO_DA_MONITORARE]
 * Es:  node src/index.js LIRF
 *      node src/index.js        (monitora tutto, verbose)
 * Stop: Ctrl+C
 */

import { fetchAll } from './fetcher.js';
import { normalizeVATSIM, normalizeIVAO, diffSnapshots, POSITION_LABELS } from './normalizer.js';

const MONITOR_ICAO   = process.argv[2]?.toUpperCase() ?? null;
const POLL_INTERVAL  = 15_000; // ms — rispetta rate limit IVAO e VATSIM
const JITTER_MAX     = 2_000;  // ms — evita thundering herd

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', blue: '\x1b[34m', magenta: '\x1b[35m',
};

function ts() {
  return new Date().toISOString().slice(11, 19) + ' UTC';
}

function formatPosition(p) {
  const label = POSITION_LABELS[p.positionType] ?? p.positionType;
  return `${C.cyan}${p.icao}${C.reset} ${C.bold}${p.callsign}${C.reset} [${label}] ${C.dim}${p.frequency} MHz · ${p.network}${C.reset}`;
}

let previousSnapshot = [];
let cycleCount = 0;

async function poll() {
  cycleCount++;
  const start = Date.now();

  const { vatsim, ivao, errors } = await fetchAll();

  const vNorm = vatsim ? normalizeVATSIM(vatsim).positions : [];
  const iNorm = ivao   ? normalizeIVAO(ivao).positions     : [];
  const current = [...vNorm, ...iNorm];

  // Filtro aeroporto se specificato
  const relevant = MONITOR_ICAO
    ? current.filter(p => p.icao === MONITOR_ICAO)
    : current;

  const prevRelevant = MONITOR_ICAO
    ? previousSnapshot.filter(p => p.icao === MONITOR_ICAO)
    : previousSnapshot;

  const { newOnline, wentOffline } = diffSnapshots(prevRelevant, relevant);
  previousSnapshot = current;

  const elapsed = Date.now() - start;

  // ─── Header ciclo ───────────────────────────────────────────────────────────
  const vStatus = errors.vatsim ? `${C.red}ERR${C.reset}` : `${C.green}OK${C.reset}`;
  const iStatus = errors.ivao   ? `${C.red}ERR${C.reset}` : `${C.green}OK${C.reset}`;

  process.stdout.write(
    `\r${C.dim}[${ts()}]${C.reset} ` +
    `VATSIM:${vStatus} IVAO:${iStatus} | ` +
    `posizioni: ${C.bold}${current.length}${C.reset} | ` +
    `fetch: ${elapsed}ms | ` +
    `ciclo #${cycleCount}` +
    (MONITOR_ICAO ? ` | monitorando: ${C.cyan}${MONITOR_ICAO}${C.reset}` : '') +
    '   '
  );

  // ─── Alert nuove connessioni ─────────────────────────────────────────────────
  if (newOnline.length > 0) {
    console.log(''); // newline dopo il ticker
    for (const p of newOnline) {
      console.log(`${C.green}▲ ONLINE${C.reset}  ${formatPosition(p)}`);
      if (p.atis?.length) {
        const text = (Array.isArray(p.atis) ? p.atis.join(' | ') : p.atis).slice(0, 100);
        console.log(`  ${C.dim}atis: ${text}${C.reset}`);
      }
    }
  }

  // ─── Alert disconnessioni ────────────────────────────────────────────────────
  if (wentOffline.length > 0) {
    if (newOnline.length === 0) console.log('');
    for (const p of wentOffline) {
      console.log(`${C.red}▼ OFFLINE${C.reset} ${formatPosition(p)}`);
    }
  }

  // ─── Primo ciclo: snapshot iniziale ─────────────────────────────────────────
  if (cycleCount === 1) {
    console.log(''); // newline
    console.log(`${C.bold}Snapshot iniziale:${C.reset}`);
    if (MONITOR_ICAO) {
      if (relevant.length === 0) {
        console.log(`  ${C.yellow}Nessuna copertura ATC attiva su ${MONITOR_ICAO}${C.reset}`);
      } else {
        for (const p of relevant) {
          console.log(`  ${formatPosition(p)}`);
        }
      }
    } else {
      // Mostra riepilogo globale
      const airports = new Set(current.map(p => p.icao)).size;
      console.log(`  ${current.length} posizioni attive su ${airports} aeroporti`);
      const byType = {};
      for (const p of current) byType[p.positionType] = (byType[p.positionType] ?? 0) + 1;
      for (const [t, n] of Object.entries(byType).sort()) {
        console.log(`  ${C.dim}${(POSITION_LABELS[t] ?? t).padEnd(12)}${C.reset} ${n}`);
      }
    }
    console.log(`\n${C.dim}In ascolto... (aggiornamento ogni ${POLL_INTERVAL/1000}s, Ctrl+C per fermare)${C.reset}\n`);
  }

  // ─── Errori API ──────────────────────────────────────────────────────────────
  if (errors.vatsim && cycleCount === 1) {
    console.log(`\n${C.red}VATSIM error: ${errors.vatsim}${C.reset}`);
  }
  if (errors.ivao && cycleCount === 1) {
    console.log(`\n${C.yellow}IVAO error: ${errors.ivao}${C.reset}`);
  }
}

// ─── Loop principale ──────────────────────────────────────────────────────────
console.log(`\n${C.bold}━━━ ATC Coverage Poller ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
if (MONITOR_ICAO) {
  console.log(`Monitorando: ${C.cyan}${MONITOR_ICAO}${C.reset}`);
} else {
  console.log('Monitorando: tutta la rete');
}
console.log(`Intervallo: ${POLL_INTERVAL/1000}s | Rate limits: VATSIM 15s, IVAO 15s`);
console.log();

process.on('SIGINT', () => {
  console.log(`\n\n${C.dim}Poller fermato. Totale cicli: ${cycleCount}${C.reset}\n`);
  process.exit(0);
});

await poll(); // primo ciclo immediato

setInterval(async () => {
  const jitter = Math.random() * JITTER_MAX;
  await new Promise(r => setTimeout(r, jitter));
  await poll();
}, POLL_INTERVAL);
