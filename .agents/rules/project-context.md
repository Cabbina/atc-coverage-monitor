---
trigger: always_on
---

---
name: project-context
description: Contesto generale del progetto ATC Coverage Monitor
---

# ATC Coverage Monitor — Contesto progetto

## Cosa è questo progetto
Web app per piloti virtuali (MSFS 2024, IVAO, VATSIM) che mostra copertura
ATC in tempo reale, storico e predizione probabilistica.

## Stack tecnologico
- Frontend: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- Backend: Next.js API Routes / Fastify
- Database: PostgreSQL + TimescaleDB (Supabase)
- Cache/PubSub: Redis (Upstash)
- Real-time: SSE (Server-Sent Events)
- Mappe: MapLibre GL JS

## Convenzioni codice
- TypeScript strict mode sempre attivo
- ES modules (import/export), mai require()
- Nomi file: kebab-case (es. atc-normalizer.ts)
- Nomi componenti React: PascalCase
- Commenti in inglese nel codice, italiano solo per documentazione
- Nessuna dipendenza esterna non necessaria