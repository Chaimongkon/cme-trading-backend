// Gold Options Analytics - Type Definitions
// Based on CME QuikStrike Data Structure

// ============================================
// Core Data Interfaces
// ============================================

/**
 * Single strike price data combining all metrics
 */
export interface OptionStrike {
  strike: number;
  // Open Interest
  callOi: number;
  putOi: number;
  // Intraday Volume
  callVolume: number;
  putVolume: number;
  // OI Change (Daily)
  callOiChange: number;
  putOiChange: number;
  // Volatility
  volSettle: number | null;
  range: string | null;
}

/**
 * Aggregated market data from all sources
 */
export interface MarketData {
  product: string;
  expiry: string;
  currentPrice: number;
  extractedAt: string;
  // Aggregated strikes
  strikes: OptionStrike[];
  // Summary totals
  totals: {
    putOi: number;
    callOi: number;
    putVolume: number;
    callVolume: number;
    putOiChange: number;
    callOiChange: number;
  };
}

// ============================================
// Analysis Metrics
// ============================================

/**
 * Put/Call Ratio Analysis
 */
export interface PCRAnalysis {
  // Standard PCR (Total OI)
  oiPcr: number;
  oiPcrSignal: "BULLISH" | "BEARISH" | "NEUTRAL";
  // Volume PCR (Intraday sentiment)
  volumePcr: number;
  volumePcrSignal: "BULLISH" | "BEARISH" | "NEUTRAL";
  // ATM PCR (Near-the-money focus)
  atmPcr: number;
  atmPcrSignal: "BULLISH" | "BEARISH" | "NEUTRAL";
}

/**
 * Max Pain calculation
 */
export interface MaxPainAnalysis {
  maxPainStrike: number;
  distanceFromPrice: number;
  distancePercent: number;
  signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  description: string;
}

/**
 * Key support/resistance levels from OI concentration
 */
export interface KeyLevels {
  // Top 3 Put OI strikes = Support levels
  support: Array<{
    strike: number;
    putOi: number;
    strength: number; // 1-3 (3 = strongest)
  }>;
  // Top 3 Call OI strikes = Resistance levels
  resistance: Array<{
    strike: number;
    callOi: number;
    strength: number;
  }>;
}

/**
 * OI Flow analysis (smart money tracking)
 */
export interface OiFlowAnalysis {
  // Net OI change
  netOiChange: number; // positive = new positions, negative = closing
  // Flow direction
  callFlow: number;
  putFlow: number;
  // Interpretation
  signal: "BULLISH" | "BEARISH" | "NEUTRAL" | "REVERSAL";
  interpretation: string;
}

/**
 * Volume concentration analysis
 */
export interface VolumeAnalysis {
  // Most active strikes
  hotStrikes: Array<{
    strike: number;
    totalVolume: number;
    putVolume: number;
    callVolume: number;
    isNearPrice: boolean;
  }>;
  // Volume-weighted average strike
  vwap: number;
  // Volume skew
  volumeSkew: "PUT_HEAVY" | "CALL_HEAVY" | "BALANCED";
}

// ============================================
// Combined Analysis Result
// ============================================

export interface OptionsAnalysis {
  // Source data summary
  marketData: {
    product: string;
    expiry: string;
    currentPrice: number;
    extractedAt: string;
    strikesCount: number;
  };
  // Individual analyses
  pcr: PCRAnalysis;
  maxPain: MaxPainAnalysis;
  keyLevels: KeyLevels;
  oiFlow: OiFlowAnalysis;
  volume: VolumeAnalysis;
  // Overall signal
  signal: {
    type: "BUY" | "SELL" | "NEUTRAL" | "STRONG_BUY" | "STRONG_SELL";
    strength: number; // 1-5
    confidence: number; // 0-100%
    reason: string;
    factors: string[];
  };
  // Raw strike data for charts
  strikeData: OptionStrike[];
}

// ============================================
// API Response Types
// ============================================

export interface AnalysisApiResponse {
  success: boolean;
  analysis?: OptionsAnalysis;
  error?: string;
  generatedAt: string;
}

// ============================================
// Chart Data Formats
// ============================================

export interface ChartStrikeData {
  strike: number;
  put: number | null;
  call: number | null;
  volSettle: number | null;
  range: string | null;
}

export interface ChartSummary {
  put: number;
  call: number;
  vol: number;
  volChg: number;
  futureChg: number;
}
