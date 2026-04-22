/**
 * Live data fetcher for VATSIM and IVAO networks.
 * Uses native fetch with timeout and user-agent.
 */

const VATSIM_URL = 'https://data.vatsim.net/v3/vatsim-data.json';
const IVAO_URL   = 'https://api.ivao.aero/v2/tracker/whazzup';
const TIMEOUT_MS = 10_000;

// Identified User-Agent: good practice and required by IVAO
const USER_AGENT = 'ATCCoverageMonitor/0.1 (NextJS)';

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<any> {
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
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchVATSIM(): Promise<any> {
  return fetchWithTimeout(VATSIM_URL);
}

export async function fetchIVAO(): Promise<any> {
  return fetchWithTimeout(IVAO_URL);
}

export interface FetchAllResult {
  vatsim: any | null;
  ivao: any | null;
  errors: {
    vatsim: string | null;
    ivao: string | null;
  };
}

/**
 * Parallel fetch of both networks.
 * Uses Promise.allSettled to ensure one failure doesn't block the other.
 */
export async function fetchAll(): Promise<FetchAllResult> {
  const [vResult, iResult] = await Promise.allSettled([
    fetchVATSIM(),
    fetchIVAO(),
  ]);

  return {
    vatsim: vResult.status === 'fulfilled' ? vResult.value : null,
    ivao:   iResult.status === 'fulfilled' ? iResult.value : null,
    errors: {
      vatsim: vResult.status === 'rejected'  ? (vResult.reason as Error).message : null,
      ivao:   iResult.status === 'rejected'  ? (iResult.reason as Error).message : null,
    },
  };
}
