---
description: 
---

Verifica che il poller rispetti i rate limit:
1. Controlla che il fetch interval sia >= 15000ms
2. Verifica che ci sia jitter randomico (Math.random() * 2000)
3. Controlla che il User-Agent sia impostato nelle richieste
4. Verifica che non ci siano chiamate dirette a VATSIM/IVAO dal frontend