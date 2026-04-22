/**
 * fetch-once.js
 * Script CLI: esegue un singolo fetch, normalizza e stampa i risultati.
 * Uso: node src/fetch-once.js [ICAO]
 * Es:  node src/fetch-once.js LIRF
 */

import { fetchAll } from './fetcher.js';
import { normalizeVATSIM, normalizeIVAO, diffSnapshots, POSITION_LABELS } from './normalizer.js';

const FILTER_ICAO = process.argv[2]?.toUpperCase() ?? null;

// ─── Colori ANSI ─────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  blue:   '\x1b[34m',
  magenta:'\x1b[35m',
};

const POS_COLOR = {
  ATIS: C.dim,
  DEL:  C.magenta,
  GND:  C.green,
  TWR:  C.blue,
  APP:  C.cyan,
  DEP:  C.yellow,
  CTR:  C.red,
  FSS:  C.dim,
};

function pad(s, n) { return String(s).padEnd(n); }
function rpad(s, n) { return String(s).padStart(n); }

function secToHHMM(sec) {
  if (!sec) return '--:--';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${String(h).padStart(2,'0')}h${String(m).padStart(2,'0')}m`;
}

function formatLogon(isoString, onlineSec) {
  if (onlineSec) return secToHHMM(onlineSec);
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toISOString().slice(11, 16) + 'z';
}

// ─── Main ─────────────────────────────────────────────────────────────────────
console.log(`\n${C.bold}━━━ ATC Coverage POC ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
console.log(`${C.dim}Fetch: VATSIM data.vatsim.net + IVAO api.ivao.aero${C.reset}`);
if (FILTER_ICAO) {
  console.log(`${C.yellow}Filtro attivo: ${FILTER_ICAO}${C.reset}`);
}
console.log();

const startTime = Date.now();
process.stdout.write('Fetching... ');

const { vatsim, ivao, errors } = await fetchAll();
const elapsed = Date.now() - startTime;

console.log(`${C.dim}(${elapsed}ms)${C.reset}\n`);

// ─── Report fetch ─────────────────────────────────────────────────────────────
if (errors.vatsim) {
  console.log(`${C.red}✗ VATSIM: ${errors.vatsim}${C.reset}`);
} else {
  const ts = vatsim?.general?.update_timestamp?.slice(0, 19).replace('T', ' ') ?? '—';
  console.log(`${C.green}✓ VATSIM${C.reset} ${C.dim}feed timestamp: ${ts} UTC${C.reset}`);
  console.log(`  ${C.dim}controllers: ${vatsim.controllers?.length ?? 0}  atis: ${vatsim.atis?.length ?? 0}  pilots: ${vatsim.pilots?.length ?? 0}${C.reset}`);
}

if (errors.ivao) {
  console.log(`${C.red}✗ IVAO:   ${errors.ivao}${C.reset}`);
} else {
  const ts = ivao?.updatedAt?.slice(0, 19).replace('T', ' ') ?? '—';
  console.log(`${C.green}✓ IVAO${C.reset}   ${C.dim}feed timestamp: ${ts} UTC${C.reset}`);
  console.log(`  ${C.dim}atcs: ${ivao?.clients?.atcs?.length ?? 0}  pilots: ${ivao?.clients?.pilots?.length ?? 0}${C.reset}`);
}

// ─── Normalizzazione ──────────────────────────────────────────────────────────
const vNorm = vatsim ? normalizeVATSIM(vatsim) : { positions: [], stats: {} };
const iNorm = ivao   ? normalizeIVAO(ivao)     : { positions: [], stats: {} };

const all = [...vNorm.positions, ...iNorm.positions];

console.log(`\n${C.bold}Posizioni normalizzate: ${all.length}${C.reset}`);
if (vatsim) console.log(`  VATSIM: ${vNorm.positions.length} (controllers: ${vNorm.stats.controllers}, atis: ${vNorm.stats.atis}, skipped: ${vNorm.stats.skipped})`);
if (ivao)   console.log(`  IVAO:   ${iNorm.positions.length} (atcs: ${iNorm.stats.atcs}, observers: ${iNorm.stats.observers}, skipped: ${iNorm.stats.skipped})`);

// ─── Riepilogo per tipo ───────────────────────────────────────────────────────
const byType = {};
for (const p of all) {
  byType[p.positionType] = (byType[p.positionType] ?? 0) + 1;
}
console.log('\nPer tipo:');
for (const [type, count] of Object.entries(byType).sort()) {
  const col = POS_COLOR[type] ?? C.reset;
  console.log(`  ${col}${pad(POSITION_LABELS[type] ?? type, 12)}${C.reset} ${rpad(count, 4)}`);
}

// ─── Aeroporti con copertura ──────────────────────────────────────────────────
const airports = {};
for (const p of all) {
  if (!airports[p.icao]) airports[p.icao] = { VATSIM: [], IVAO: [] };
  airports[p.icao][p.network].push(p.positionType);
}
const sortedAirports = Object.entries(airports).sort((a, b) => {
  const totalA = a[1].VATSIM.length + a[1].IVAO.length;
  const totalB = b[1].VATSIM.length + b[1].IVAO.length;
  return totalB - totalA;
});
console.log(`\n${C.bold}Aeroporti con copertura: ${sortedAirports.length}${C.reset}`);

// ─── Tabella posizioni ─────────────────────────────────────────────────────────
const filtered = FILTER_ICAO
  ? all.filter(p => p.icao === FILTER_ICAO)
  : all.sort((a, b) => a.icao.localeCompare(b.icao));

if (FILTER_ICAO && filtered.length === 0) {
  console.log(`\n${C.yellow}Nessuna copertura ATC attiva per ${FILTER_ICAO}${C.reset}`);
} else {
  const displayList = FILTER_ICAO ? filtered : all.slice(0, 30);
  const truncated = !FILTER_ICAO && all.length > 30;

  console.log(`\n${C.bold}${pad('CALLSIGN', 18)} ${pad('ICAO', 6)} ${pad('TIPO', 10)} ${pad('RETE', 8)} ${pad('FREQ', 9)} ${pad('ONLINE', 8)} ${pad('RATING', 6)}${C.reset}`);
  console.log('─'.repeat(75));

  for (const p of displayList) {
    const col = POS_COLOR[p.positionType] ?? C.reset;
    const since = formatLogon(p.logonTime, p.onlineSeconds);
    console.log(
      `${col}${pad(p.callsign, 18)}${C.reset}` +
      ` ${C.cyan}${pad(p.icao, 6)}${C.reset}` +
      ` ${col}${pad(POSITION_LABELS[p.positionType] ?? p.positionType, 10)}${C.reset}` +
      ` ${pad(p.network, 8)}` +
      ` ${pad(p.frequency + ' MHz', 9)}` +
      ` ${C.dim}${pad(since, 8)}${C.reset}` +
      ` ${p.rating ?? '—'}`
    );

    // Mostra ATIS se presente
    if (p.atis?.length) {
      const atisText = (Array.isArray(p.atis) ? p.atis : [p.atis])
        .join(' | ')
        .slice(0, 80);
      console.log(`  ${C.dim}atis: ${atisText}…${C.reset}`);
    }
  }

  if (truncated) {
    console.log(`\n${C.dim}... e altri ${all.length - 30} controllori. Usa: node src/fetch-once.js ICAO per filtrare.${C.reset}`);
  }
}

// ─── Top 10 aeroporti più coperti ────────────────────────────────────────────
if (!FILTER_ICAO) {
  console.log(`\n${C.bold}Top 10 aeroporti per copertura:${C.reset}`);
  console.log(`${C.dim}${pad('ICAO', 7)} ${pad('VATSIM', 20)} ${pad('IVAO', 20)}${C.reset}`);
  console.log('─'.repeat(50));
  for (const [icao, nets] of sortedAirports.slice(0, 10)) {
    const v = nets.VATSIM.join(', ') || '—';
    const i = nets.IVAO.join(', ')   || '—';
    console.log(`${C.cyan}${pad(icao, 7)}${C.reset} ${pad(v, 20)} ${pad(i, 20)}`);
  }
}

console.log(`\n${C.dim}Completato in ${Date.now() - startTime}ms${C.reset}\n`);
