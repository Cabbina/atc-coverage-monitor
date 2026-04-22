---
trigger: always_on
---

---
name: db-schema
description: Schema PostgreSQL + TimescaleDB del progetto
---

# Schema Database

## Tabelle principali
- airports: anagrafica aeroporti (ICAO, coordinate, paese)
- atc_sessions: sessioni ATC storiche (start/end, network, callsign, icao)
- atc_snapshots: hypertable TimescaleDB, snapshot ogni 15s
- coverage_stats: statistiche aggregate (icao × tipo × giorno × ora)
- user_alerts: alert utenti per aeroporto
- push_subscriptions: Web Push API subscriptions

## Convenzioni
- UUID come PK per tutte le tabelle principali
- Timestamp sempre in UTC (TIMESTAMPTZ)
- Enum come VARCHAR con CHECK constraint, non enum PostgreSQL
- Indici su (icao, started_at DESC) per query frequenti

## Hypertable
atc_snapshots è una TimescaleDB hypertable partizionata per snapshot_time.
Non usare DELETE su questa tabella — usare le retention policy di TimescaleDB.