// Shared types for the trading backend

// ============================================
// Data Types Enum
// ============================================
export type DataType = "volume" | "oi" | "oichange";

// ============================================
// Intraday Volume Types
// ============================================
export interface IntradayVolumeStrikeData {
  strike: number;
  putVol: number | null;
  callVol: number | null;
  volSettle?: number | null;
  range?: string | null;
}

export interface IntradayVolumeSnapshot {
  id: string;
  product: string;
  expiry: string;
  futurePrice: number | null;
  totalPut: number | null;
  totalCall: number | null;
  vol: number | null;
  volChg: number | null;
  futureChg: number | null;
  extractedAt: Date;
  createdAt: Date;
  strikes: IntradayVolumeStrikeData[];
}

// ============================================
// Open Interest Types
// ============================================
export interface OiStrikeData {
  strike: number;
  putOi: number | null;
  callOi: number | null;
  volSettle?: number | null;
  range?: string | null;
}

export interface OiSnapshot {
  id: string;
  product: string;
  expiry: string;
  futurePrice: number | null;
  totalPutOi: number | null;
  totalCallOi: number | null;
  vol: number | null;
  volChg: number | null;
  futureChg: number | null;
  extractedAt: Date;
  createdAt: Date;
  strikes: OiStrikeData[];
}

// ============================================
// OI Change Types
// ============================================
export interface OiChangeStrikeData {
  strike: number;
  putChange: number | null;
  callChange: number | null;
  volSettle?: number | null;
  range?: string | null;
}

export interface OiChangeSnapshot {
  id: string;
  product: string;
  expiry: string;
  futurePrice: number | null;
  totalPutChange: number | null;
  totalCallChange: number | null;
  vol: number | null;
  volChg: number | null;
  futureChg: number | null;
  extractedAt: Date;
  createdAt: Date;
  strikes: OiChangeStrikeData[];
}

// ============================================
// Generic Strike Data (backward compatibility)
// ============================================
export interface StrikeData {
  strike: number;
  putOi: number | null;
  callOi: number | null;
  volSettle?: number | null;
  range?: string | null;
}

export interface Snapshot {
  id: string;
  product: string;
  expiry: string;
  futurePrice: number | null;
  extractedAt: Date;
  createdAt: Date;
  strikes: StrikeData[];
}

// ============================================
// Signal Types
// ============================================
export interface Signal {
  id: string;
  product: string;
  type: "BUY" | "SELL" | "NEUTRAL";
  strength: 1 | 2 | 3 | 4 | 5;
  reason: string;
  analysis: SignalFactors;
  putCallRatio: number | null;
  maxPainStrike: number | null;
  currentPrice: number | null;
  volumeSnapshotId: string | null;
  oiSnapshotId: string | null;
  oiChangeSnapshotId: string | null;
  createdAt: Date;
  notified: boolean;
}

export interface SignalFactors {
  pcr: {
    value: number;
    signal: "BULLISH" | "BEARISH" | "NEUTRAL";
    weight: number;
  };
  atmPcr: {
    value: number;
    signal: "BULLISH" | "BEARISH" | "NEUTRAL";
    weight: number;
  };
  maxPain: {
    value: number;
    priceDistance: number;
    signal: "BULLISH" | "BEARISH" | "NEUTRAL";
    weight: number;
  };
  oiTrend: {
    putChange: number;
    callChange: number;
    signal: "BULLISH" | "BEARISH" | "NEUTRAL";
    weight: number;
  };
  atmOiBuildup: {
    signal: "BULLISH" | "BEARISH" | "NEUTRAL";
    weight: number;
  };
  keyLevels: {
    support: number[];
    resistance: number[];
  };
}

export interface Settings {
  id: string;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  signalThreshold: number;
  analysisInterval: number;
  updatedAt: Date;
}

// ============================================
// API Types
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Extension sends this structure
export interface ExtensionChartData {
  title: string;
  subtitle?: string;
  futurePrice: number | null;
  tableData: Array<{
    strike: number | string;
    put: number | string | null;
    call: number | string | null;
    volSettle: number | string | null;
    range: string | null;
  }>;
  extractedAt: string;
  dataType?: string;
}

export interface ExtensionPayload {
  success: boolean;
  syncedAt?: string;
  // New format - separate data by type
  volumeData?: {
    data: ExtensionChartData[];
    pageUrl?: string;
    extractedAt?: string;
  };
  oiData?: {
    data: ExtensionChartData[];
    pageUrl?: string;
    extractedAt?: string;
  };
  oiChangeData?: {
    data: ExtensionChartData[];
    pageUrl?: string;
    extractedAt?: string;
  };
  // Legacy format
  data?: ExtensionChartData[];
  pageUrl?: string;
  extractedAt?: string;
}

// Parsed summary from subtitle
export interface ChartSummary {
  put: number | null;
  call: number | null;
  vol: number | null;
  volChg: number | null;
  futureChg: number | null;
}

export interface AnalysisResponse {
  success: boolean;
  analysis: {
    currentSnapshot: {
      id: string;
      product: string;
      expiry: string;
      futurePrice: number;
      extractedAt: string;
      strikesCount: number;
    };
    previousSnapshot: {
      id: string;
      futurePrice: number;
      extractedAt: string;
    } | null;
    pcr: {
      ratio: number;
      totalPutOi: number;
      totalCallOi: number;
      signal: string;
      description: string;
    };
    atmPcr: {
      ratio: number;
      signal: string;
    };
    maxPain: {
      maxPainStrike: number;
      priceToMaxPain: number;
      signal: string;
      description: string;
    };
    oiChanges: {
      changes: Array<{
        strike: number;
        putChange: number;
        callChange: number;
      }>;
      summary: {
        totalPutChange: number;
        totalCallChange: number;
        signal: string;
      };
    } | null;
    signal: {
      type: "BUY" | "SELL" | "NEUTRAL";
      strength: number;
      reason: string;
      factors: SignalFactors;
    };
    strikeData: Array<{
      strike: number;
      putOi: number | null;
      callOi: number | null;
      volSettle: number | null;
      range: string | null;
      putChange: number;
      callChange: number;
    }>;
  };
  recentSignals: Signal[];
  generatedAt: string;
}
