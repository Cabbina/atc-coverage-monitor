import { fetchAll } from './fetcher';
import { normalizeVATSIM, normalizeIVAO } from './normalizer';
import { ATCPosition } from './types';

/**
 * PollerService
 * Class that handles periodic fetching of ATC data from VATSIM and IVAO.
 * Designed to run in a long-running Node.js process.
 */
export class PollerService {
  private timer: NodeJS.Timeout | null = null;
  private positions: ATCPosition[] = [];
  private startTime: Date | null = null;
  
  public lastFetchTime: string | null = null;
  public fetchErrors: { vatsim: string | null; ivao: string | null } = { vatsim: null, ivao: null };
  public isRunning: boolean = false;

  constructor() {}

  /**
   * Start the polling loop
   */
  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = new Date();
    
    console.log('[Poller] Starting service...');
    
    // Initial fetch
    await this.poll();
    
    // Setup interval
    this.scheduleNext();
  }

  /**
   * Stop the polling loop
   */
  public stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    this.startTime = null;
    console.log('[Poller] Service stopped.');
  }

  /**
   * Get current data snapshot
   */
  public getSnapshot() {
    return {
      positions: this.positions,
      lastFetchTime: this.lastFetchTime,
      fetchErrors: this.fetchErrors,
      totalCount: this.positions.length
    };
  }

  /**
   * Get service status and metrics
   */
  public getStatus() {
    const uptime = this.startTime 
      ? Math.floor((Date.now() - this.startTime.getTime()) / 1000) 
      : 0;

    return {
      isRunning: this.isRunning,
      totalCount: this.positions.length,
      lastFetch: this.lastFetchTime,
      errors: this.fetchErrors,
      uptimeSeconds: uptime,
      startTime: this.startTime?.toISOString() ?? null
    };
  }

  /**
   * Internal poll logic
   */
  private async poll() {
    const start = Date.now();
    try {
      const { vatsim, ivao, errors } = await fetchAll();
      
      this.fetchErrors = errors;
      
      const vNorm = vatsim ? normalizeVATSIM(vatsim).positions : [];
      const iNorm = ivao ? normalizeIVAO(ivao).positions : [];
      
      // Update snapshot (merging VATSIM and IVAO)
      // If both fetch failed, we keep the previous snapshot (positions)
      if (vatsim || ivao) {
        this.positions = [...vNorm, ...iNorm];
        this.lastFetchTime = new Date().toISOString();
      }
      
      const elapsed = Date.now() - start;
      const vStatus = errors.vatsim ? 'ERR' : (vatsim ? 'OK' : 'NODATA');
      const iStatus = errors.ivao ? 'ERR' : (ivao ? 'OK' : 'NODATA');
      
      console.log(
        `[Poller] ${new Date().toISOString().slice(11, 19)} | ` +
        `VATSIM:${vStatus} IVAO:${iStatus} | ` +
        `Positions: ${this.positions.length} | ` +
        `Fetch: ${elapsed}ms`
      );
    } catch (err) {
      console.error('[Poller] Unexpected error in polling cycle:', err);
    }
  }

  /**
   * Schedule the next poll with jitter
   */
  private scheduleNext() {
    if (!this.isRunning) return;
    
    const interval = 15000;
    const jitter = Math.random() * 2000;
    
    this.timer = setTimeout(async () => {
      await this.poll();
      this.scheduleNext();
    }, interval + jitter);
  }
}
