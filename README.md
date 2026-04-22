# ATC Coverage POC

POC per verificare il fetch e la normalizzazione dei dati VATSIM + IVAO.
**Nessuna dipendenza npm** — solo Node.js 18+ (fetch nativo).

## Requisiti

- Node.js 18 o superiore
- Connessione internet

## Quickstart

```bash
# 1. Clona / decomprimila nella tua cartella di lavoro

# 2. Fetch singolo — vedi tutti i controllori attivi
node src/fetch-once.js

# Fetch filtrato per aeroporto
node src/fetch-once.js LIRF
node src/fetch-once.js EGLL
node src/fetch-once.js KJFK

# 3. Poller continuo (aggiornamento ogni 15s)
node src/index.js         # monitora tutta la rete
node src/index.js LIRF    # monitora solo LIRF

# 4. Dashboard web locale
node src/server.js
# Apri: http://localhost:3000
```

## Cosa verifica questa POC

- [x] Fetch VATSIM `data.vatsim.net/v3/vatsim-data.json` (no auth)
- [x] Fetch IVAO `api.ivao.aero/v2/tracker/whazzup` (no auth per utenti generici)
- [x] Parsing `controllers` VATSIM (facility integer → tipo)
- [x] Parsing `atis` VATSIM (array separato!)
- [x] Parsing `atcs` IVAO (position string + DEP distinto)
- [x] Estrazione ICAO dal callsign (entrambe le reti)
- [x] Normalizzazione in `ATCPosition[]` unificato
- [x] Diff engine: rilevamento online/offline tra snapshot
- [x] Rate limit rispettati (fetch ogni 15s + jitter)
- [x] SSE server per aggiornamenti push verso il browser

## Struttura

```
src/
  normalizer.js   → parsing + normalizzazione dati (no I/O)
  fetcher.js      → HTTP fetch con timeout e User-Agent
  fetch-once.js   → CLI: singolo fetch + report tabellare
  index.js        → CLI: poller continuo con diff engine
  server.js       → HTTP server con dashboard HTML + API + SSE
```

## Output atteso (fetch-once.js)

```
━━━ ATC Coverage POC ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fetching... (843ms)

✓ VATSIM feed timestamp: 2025-04-22 19:43:00 UTC
  controllers: 312  atis: 89  pilots: 4521
✓ IVAO   feed timestamp: 2025-04-22 19:43:15 UTC
  atcs: 187  pilots: 2103

Posizioni normalizzate: 588
  VATSIM: 401 (controllers: 312, atis: 89, skipped: 3)
  IVAO:   187 (atcs: 187, observers: 12, skipped: 0)

Per tipo:
  ATIS          89
  Center/FIR    156
  Ground         78
  ...

Top 10 aeroporti per copertura:
ICAO    VATSIM               IVAO
EGLL    APP, TWR, GND, ATIS  APP, GND
LIRF    APP, TWR, GND        CTR
...
```

## Note CORS

Il widget nel browser (claude.ai) non può chiamare direttamente
VATSIM o IVAO per policy CORS/CSP del sandbox.
Questo POC Node.js non ha questa limitazione.
In produzione il fetch avviene lato server (Next.js API route o worker),
il browser riceve solo i dati normalizzati via SSE/REST.

## Prossimi passi dopo la POC

1. Verificare edge cases nei callsign (output `skipped` > 0?)
2. Confrontare conteggi con siti ufficiali (stats.vatsim.net)
3. Aggiungere PostgreSQL per storicizzare gli snapshot
4. Sostituire il server Express-like con Next.js API routes
