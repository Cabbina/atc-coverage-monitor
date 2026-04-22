/**
 * normalizer.js
 * Converte i dati raw di VATSIM e IVAO in un formato ATCPosition unificato.
 */

// ─── Mapping VATSIM facility (integer) → PositionType ────────────────────────
const VATSIM_FACILITY_MAP = {
  0: null,      // OBS — da ignorare
  1: 'FSS',
  2: 'DEL',
  3: 'GND',
  4: 'TWR',
  5: 'APP',     // include anche DEP lato VATSIM (callsign _DEP ma facility=5)
  6: 'CTR',
};

// ─── Mapping IVAO position (string) → PositionType ───────────────────────────
const IVAO_POSITION_MAP = {
  DEL: 'DEL',
  GND: 'GND',
  TWR: 'TWR',
  APP: 'APP',
  DEP: 'DEP',   // IVAO distingue DEP separato
  CTR: 'CTR',
  FSS: 'FSS',
};

// ─── Etichette leggibili ──────────────────────────────────────────────────────
export const POSITION_LABELS = {
  ATIS: 'ATIS',
  DEL:  'Delivery',
  GND:  'Ground',
  TWR:  'Tower',
  APP:  'Approach',
  DEP:  'Departure',
  CTR:  'Center/FIR',
  FSS:  'Flight Service',
};

// ─── Estrazione ICAO da callsign VATSIM ──────────────────────────────────────
// Gestisce pattern standard e con suffissi multipli (es. EGLL_1_GND, KJFK_DEP)
export function extractICAO_VATSIM(callsign) {
  // Pattern normale: LIRF_APP, EGLL_TWR, KJFK_GND
  const match = callsign.match(
    /^([A-Z]{3,4})(?:_[A-Z0-9]+)*_(DEL|GND|TWR|APP|DEP|CTR|FSS|ATIS)$/i
  );
  if (match) return match[1].toUpperCase();

  // Fallback: prendi il prefisso prima del primo "_"
  const parts = callsign.split('_');
  if (parts.length >= 2 && /^[A-Z]{3,4}$/.test(parts[0])) {
    return parts[0].toUpperCase();
  }
  return null;
}

// ─── Estrazione ICAO da callsign IVAO ────────────────────────────────────────
// IVAO può avere: LIRF_APP, LEBG_I_TWR (posizione intermedia), EGTT_CTR
export function extractICAO_IVAO(callsign) {
  return callsign.split('_')[0].toUpperCase();
}

// ─── Normalizzatore VATSIM ───────────────────────────────────────────────────
export function normalizeVATSIM(data) {
  const positions = [];
  const stats = { controllers: 0, atis: 0, skipped: 0 };

  // 1. Controllers normali
  for (const ctrl of (data.controllers ?? [])) {
    const posType = VATSIM_FACILITY_MAP[ctrl.facility];
    if (!posType) { stats.skipped++; continue; }

    const icao = extractICAO_VATSIM(ctrl.callsign);
    if (!icao) { stats.skipped++; continue; }

    // Detect se è DEP dal callsign anche se facility=5
    const effectiveType = ctrl.callsign.toUpperCase().endsWith('_DEP') ? 'DEP' : posType;

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
    stats.controllers++;
  }

  // 2. ATIS — array SEPARATO in VATSIM v3!
  for (const atisEntry of (data.atis ?? [])) {
    const icao = extractICAO_VATSIM(atisEntry.callsign);
    if (!icao) { stats.skipped++; continue; }

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
    stats.atis++;
  }

  return { positions, stats };
}

// ─── Normalizzatore IVAO ─────────────────────────────────────────────────────
export function normalizeIVAO(data) {
  const positions = [];
  const stats = { atcs: 0, observers: 0, skipped: 0 };

  for (const atc of (data.clients?.atcs ?? [])) {
    const rawPos = atc.atcSession?.position;
    if (!rawPos) { stats.observers++; continue; }

    const posType = IVAO_POSITION_MAP[rawPos];
    if (!posType) { stats.skipped++; continue; }

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
    stats.atcs++;
  }

  return { positions, stats };
}

// ─── Diff engine: trova nuove connessioni rispetto allo snapshot precedente ───
export function diffSnapshots(previous, current) {
  const prevSet = new Set(previous.map(p => `${p.network}:${p.callsign}`));
  const currSet = new Set(current.map(p => `${p.network}:${p.callsign}`));

  const newOnline  = current.filter(p => !prevSet.has(`${p.network}:${p.callsign}`));
  const wentOffline = previous.filter(p => !currSet.has(`${p.network}:${p.callsign}`));

  return { newOnline, wentOffline };
}
