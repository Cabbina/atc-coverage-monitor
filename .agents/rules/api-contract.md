---
trigger: always_on
---

---
name: api-contracts  
description: Strutture dati VATSIM e IVAO e regole di integrazione API
---

# Contratti API VATSIM e IVAO

## VATSIM Data Feed
- URL: https://data.vatsim.net/v3/vatsim-data.json
- Refresh: ogni 15 secondi — MAI fare fetch più frequente
- Auth: nessuna
- IMPORTANTE: i controllers e gli atis sono in array SEPARATI nel JSON
- facility integer → tipo: 1=FSS 2=DEL 3=GND 4=TWR 5=APP 6=CTR
- ATIS non ha facility, è nell'array `data.atis` con campo `atis_code`

## IVAO Whazzup v2
- URL: https://api.ivao.aero/v2/tracker/whazzup
- Refresh: ogni 15 secondi — IP BAN se più frequente
- Auth: nessuna per utenti generici
- position values: DEL GND TWR APP DEP CTR FSS (DEP è separato da APP!)

## Tipo unificato ATCPosition
Vedere src/normalizer.js per il tipo canonico.
Non modificare i campi senza aggiornare anche il normalizzatore e lo schema DB.

## Rate limit rule
UN SOLO worker di polling per l'intera applicazione.
I client browser non devono mai chiamare VATSIM/IVAO direttamente.