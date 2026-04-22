import { 
  ATCPosition, 
  NormalizationResult, 
  PositionType, 
  NormalizerStats 
} from './types';

// ─── Mapping VATSIM facility (integer) → PositionType ────────────────────────
const VATSIM_FACILITY_MAP: Record<number, PositionType | null> = {
  0: null,      // OBS — ignore
  1: 'FSS',
  2: 'DEL',
  3: 'GND',
  4: 'TWR',
  5: 'APP',     // includes DEP on VATSIM side (callsign _DEP but facility=5)
  6: 'CTR',
};

// ─── Mapping IVAO position (string) → PositionType ───────────────────────────
const IVAO_POSITION_MAP: Record<string, PositionType> = {
  DEL: 'DEL',
  GND: 'GND',
  TWR: 'TWR',
  APP: 'APP',
  DEP: 'DEP',   // IVAO distinguishes DEP
  CTR: 'CTR',
  FSS: 'FSS',
};

/**
 * Extract ICAO from VATSIM callsign
 */
export function extractICAO_VATSIM(callsign: string): string | null {
  if (callsign.toUpperCase().endsWith('_SUP')) return null;

  const match = callsign.match(
    /^([A-Z]{3,4})(?:_[A-Z0-9]+)*_(DEL|GND|TWR|APP|DEP|CTR|FSS|ATIS)$/i
  );
  if (match) return match[1].toUpperCase();

  const parts = callsign.split('_');
  if (parts.length >= 2 && /^[A-Z][A-Z0-9]{1,3}$/.test(parts[0])) {
    return parts[0].toUpperCase();
  }
  return null;
}

/**
 * Extract ICAO from IVAO callsign
 */
export function extractICAO_IVAO(callsign: string): string {
  return callsign.split('_')[0].toUpperCase();
}

/**
 * Normalize VATSIM v3 data
 */
export function normalizeVATSIM(data: any): NormalizationResult {
  const positions: ATCPosition[] = [];
  const stats: NormalizerStats = { controllers: 0, atis: 0, skipped: 0 };

  // 1. Regular Controllers
  for (const ctrl of (data.controllers ?? [])) {
    const posType = VATSIM_FACILITY_MAP[ctrl.facility];
    if (!posType) { 
      stats.skipped++; 
      continue; 
    }

    const icao = extractICAO_VATSIM(ctrl.callsign);
    if (!icao) { 
      stats.skipped++; 
      continue; 
    }

    // Detect if it's DEP from callsign even if facility=5
    const effectiveType: PositionType = ctrl.callsign.toUpperCase().endsWith('_DEP') ? 'DEP' : posType;

    positions.push({
      network:       'VATSIM',
      callsign:      ctrl.callsign,
      icao,
      positionType:  effectiveType,
      frequency:     ctrl.frequency,
      logonTime:     ctrl.logon_time,
      lastUpdated:   ctrl.last_updated,
      visualRange:   ctrl.visual_range,
      atis:          ctrl.text_atis?.length ? ctrl.text_atis : null,
      controllerId:  String(ctrl.cid),
      rating:        ctrl.rating,
    });
    stats.controllers = (stats.controllers || 0) + 1;
  }

  // 2. ATIS
  for (const atisEntry of (data.atis ?? [])) {
    const icao = extractICAO_VATSIM(atisEntry.callsign);
    if (!icao) { 
      stats.skipped++; 
      continue; 
    }

    positions.push({
      network:       'VATSIM',
      callsign:      atisEntry.callsign,
      icao,
      positionType:  'ATIS',
      frequency:     atisEntry.frequency,
      logonTime:     atisEntry.logon_time,
      lastUpdated:   atisEntry.last_updated,
      atisCode:      atisEntry.atis_code,
      atis:          atisEntry.text_atis,
      controllerId:  String(atisEntry.cid),
      rating:        atisEntry.rating,
    });
    stats.atis = (stats.atis || 0) + 1;
  }

  return { positions, stats };
}

/**
 * Normalize IVAO Whazzup v2 data
 */
export function normalizeIVAO(data: any): NormalizationResult {
  const positions: ATCPosition[] = [];
  const stats: NormalizerStats = { atcs: 0, observers: 0, skipped: 0 };

  for (const atc of (data.clients?.atcs ?? [])) {
    const rawPos = atc.atcSession?.position;
    if (!rawPos) { 
      stats.observers = (stats.observers || 0) + 1; 
      continue; 
    }

    const posType = IVAO_POSITION_MAP[rawPos];
    if (!posType) { 
      stats.skipped++; 
      continue; 
    }

    const icao = extractICAO_IVAO(atc.callsign);

    positions.push({
      network:       'IVAO',
      callsign:      atc.callsign,
      icao,
      positionType:  posType,
      frequency:     String(atc.atcSession.frequency),
      logonTime:     atc.createdAt,
      lastUpdated:   atc.lastTrack?.timestamp,
      onlineSeconds: atc.time,
      latitude:      atc.lastTrack?.latitude,
      longitude:     atc.lastTrack?.longitude,
      atis:          atc.atis?.lines ?? null,
      atisRevision:  atc.atis?.revision,
      controllerId:  String(atc.userId),
      rating:        atc.rating,
      sessionId:     String(atc.id),
    });
    stats.atcs = (stats.atcs || 0) + 1;
  }

  return { positions, stats };
}

/**
 * Find new and offline connections between snapshots
 */
export function diffSnapshots(previous: ATCPosition[], current: ATCPosition[]) {
  const prevSet = new Set(previous.map(p => `${p.network}:${p.callsign}`));
  const currSet = new Set(current.map(p => `${p.network}:${p.callsign}`));

  const newOnline  = current.filter(p => !prevSet.has(`${p.network}:${p.callsign}`));
  const wentOffline = previous.filter(p => !currSet.has(`${p.network}:${p.callsign}`));

  return { newOnline, wentOffline };
}
