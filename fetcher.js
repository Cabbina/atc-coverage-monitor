/**
 * fetcher.js
 * Recupera i dati live da VATSIM e IVAO rispettando i rate limit.
 * Node.js 18+ usa fetch nativo — nessuna dipendenza richiesta.
 */

const VATSIM_URL = 'https://data.vatsim.net/v3/vatsim-data.json';
const IVAO_URL   = 'https://api.ivao.aero/v2/tracker/whazzup';
const TIMEOUT_MS = 10_000;

// User-Agent identificativo: buona pratica e richiesta da IVAO
const USER_AGENT = 'ATCCoveragePOC/0.1 (contact: your@email.com)';

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchVATSIM() {
  return fetchWithTimeout(VATSIM_URL);
}

export async function fetchIVAO() {
  return fetchWithTimeout(IVAO_URL);
}

/**
 * Fetch parallelo di entrambe le reti.
 * Non lancia mai errori: usa Promise.allSettled.
 * Ritorna { vatsim, ivao, errors }
 */
export async function fetchAll() {
  const [vResult, iResult] = await Promise.allSettled([
    fetchVATSIM(),
    fetchIVAO(),
  ]);

  return {
    vatsim: vResult.status === 'fulfilled' ? vResult.value : null,
    ivao:   iResult.status === 'fulfilled' ? iResult.value : null,
    errors: {
      vatsim: vResult.status === 'rejected'  ? vResult.reason.message : null,
      ivao:   iResult.status === 'rejected'  ? iResult.reason.message : null,
    },
  };
}
