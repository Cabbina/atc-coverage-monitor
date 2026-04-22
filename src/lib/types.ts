/**
 * Network type definition
 */
export type Network = 'VATSIM' | 'IVAO';

/**
 * ATC Position type definition
 */
export type PositionType = 
  | 'FSS'   // Flight Service Station
  | 'DEL'   // Delivery
  | 'GND'   // Ground
  | 'TWR'   // Tower
  | 'APP'   // Approach
  | 'DEP'   // Departure
  | 'CTR'   // Center / FIR
  | 'ATIS'; // Automatic Terminal Information Service

/**
 * Unified ATC Position interface
 */
export interface ATCPosition {
  /** Network (VATSIM or IVAO) */
  network: Network;
  
  /** ATC Callsign (e.g., LIRF_APP) */
  callsign: string;
  
  /** Airport or FIR ICAO code (e.g., LIRF) */
  icao: string;
  
  /** Normalized position type */
  positionType: PositionType;
  
  /** Frequency in string format (e.g., "122.800") */
  frequency: string;
  
  /** ISO timestamp of logon */
  logonTime: string;
  
  /** ISO timestamp of last update */
  lastUpdated?: string;
  
  /** Visual range in nautical miles (VATSIM specific) */
  visualRange?: number;
  
  /** ATIS text (string for VATSIM, array of strings for IVAO) */
  atis?: string | string[] | null;
  
  /** ATIS code/letter (VATSIM specific) */
  atisCode?: string;
  
  /** ATIS revision number (IVAO specific) */
  atisRevision?: number;
  
  /** Network unique ID for the controller */
  controllerId: string;
  
  /** Numeric rating of the controller */
  rating: number;
  
  /** Total seconds online (IVAO specific) */
  onlineSeconds?: number;
  
  /** Latitude (IVAO specific) */
  latitude?: number;
  
  /** Longitude (IVAO specific) */
  longitude?: number;
  
  /** Unique session ID (IVAO specific) */
  sessionId?: string;
}

/**
 * Statistics returned by normalizers
 */
export interface NormalizerStats {
  controllers?: number;
  atcs?: number;
  atis?: number;
  observers?: number;
  skipped: number;
}

/**
 * Result of a normalization process
 */
export interface NormalizationResult {
  positions: ATCPosition[];
  stats: NormalizerStats;
}
