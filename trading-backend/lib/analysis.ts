/**
 * Gold Options Analytics - Analysis Logic
 * 
 * This module provides comprehensive options analysis functions:
 * - Liquidity Walls (Support/Resistance)
 * - Put/Call Ratio (PCR)
 * - Max Pain Calculation
 * - Trading Signal Generation
 */

// ============================================
// Type Definitions
// ============================================

export interface OptionStrike {
  strike_price: number;
  call_oi: number;
  put_oi: number;
  call_volume: number;
  put_volume: number;
  call_oi_change: number;
  put_oi_change: number;
}

export interface MarketData {
  current_price: number;
  vwap: number;
  strikes: OptionStrike[];
}

export interface LiquidityWalls {
  /** Strike with highest Put OI - acts as support */
  support: {
    strike: number;
    put_oi: number;
    strength: number; // 1-5
  };
  /** Strike with highest Call OI - acts as resistance */
  resistance: {
    strike: number;
    call_oi: number;
    strength: number; // 1-5
  };
  /** Top 3 support levels */
  support_levels: Array<{ strike: number; put_oi: number }>;
  /** Top 3 resistance levels */
  resistance_levels: Array<{ strike: number; call_oi: number }>;
}

export interface PCRResult {
  /** PCR based on Open Interest */
  oi_pcr: number;
  /** PCR based on Volume */
  volume_pcr: number;
  /** PCR for ATM strikes only */
  atm_pcr: number;
  /** Overall PCR signal */
  signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  /** Totals */
  totals: {
    total_put_oi: number;
    total_call_oi: number;
    total_put_volume: number;
    total_call_volume: number;
  };
  description: string;
}

export interface MaxPainResult {
  /** The strike price where option buyers lose the most */
  max_pain_strike: number;
  /** Distance from current price */
  distance_from_price: number;
  /** Percentage distance */
  distance_percent: number;
  /** Pain values at each strike */
  pain_by_strike: Array<{ strike: number; total_pain: number }>;
  /** Signal based on price vs max pain */
  signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  description: string;
}

export interface TradingSignal {
  /** Signal type */
  signal: "BUY" | "SELL" | "NEUTRAL";
  /** Confidence score 0-100 */
  score: number;
  /** Market sentiment */
  sentiment: "Bullish" | "Bearish" | "Sideway";
  /** Main reason for signal */
  reason: string;
  /** Human-readable summary for beginners */
  summary: string;
  /** Factors split by positive/negative */
  factors: {
    positive: string[];
    negative: string[];
  };
  /** Key price levels */
  key_levels: {
    max_pain: number;
    call_wall: number;
    put_wall: number;
    significant_strikes: number[];
  };
  /** Individual factor scores (for debugging) */
  factor_scores: {
    pcr_score: number;
    vwap_score: number;
    wall_score: number;
    max_pain_score: number;
    flow_score: number;
    volume_score: number; // NEW: Volume confirmation score
  };
  /** Volume analysis details */
  volume_analysis?: VolumeAnalysis;
  /** Legacy: full breakdown */
  breakdown: string[];
}

// ============================================
// Volume Analysis Types
// ============================================

export interface VolumeSpike {
  strike: number;
  total_volume: number;
  call_volume: number;
  put_volume: number;
  volume_ratio: number; // Ratio vs average
  is_call_dominant: boolean;
  near_price: boolean;
}

export interface VolumeAnalysis {
  /** Total volumes */
  total_call_volume: number;
  total_put_volume: number;
  total_volume: number;
  /** Volume PCR */
  volume_pcr: number;
  /** Average volume per strike */
  avg_volume_per_strike: number;
  /** Volume spikes (>2x average) */
  volume_spikes: VolumeSpike[];
  /** Volume concentration around price */
  atm_volume_concentration: number; // % of total volume within 2% of price
  /** Volume confirmation signal */
  signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  /** Confidence from volume data */
  confidence: number; // 0-100
  description: string;
}

// ============================================
// 1. Liquidity Walls
// ============================================

/**
 * Get Liquidity Walls (Support/Resistance) based on OI concentration
 * 
 * - Highest Put OI = Support (sellers must defend)
 * - Highest Call OI = Resistance (sellers must defend)
 */
export function getLiquidityWalls(data: OptionStrike[]): LiquidityWalls {
  if (data.length === 0) {
    return {
      support: { strike: 0, put_oi: 0, strength: 0 },
      resistance: { strike: 0, call_oi: 0, strength: 0 },
      support_levels: [],
      resistance_levels: [],
    };
  }

  // Sort by Put OI for support levels
  const byPutOi = [...data].sort((a, b) => b.put_oi - a.put_oi);
  const topSupport = byPutOi.slice(0, 3);
  
  // Sort by Call OI for resistance levels
  const byCallOi = [...data].sort((a, b) => b.call_oi - a.call_oi);
  const topResistance = byCallOi.slice(0, 3);
  
  // Calculate strength (relative to max)
  const maxPutOi = topSupport[0]?.put_oi || 1;
  const maxCallOi = topResistance[0]?.call_oi || 1;
  
  // Strength is 1-5 based on how dominant the level is
  const supportStrength = Math.min(5, Math.ceil((topSupport[0]?.put_oi || 0) / maxPutOi * 5));
  const resistanceStrength = Math.min(5, Math.ceil((topResistance[0]?.call_oi || 0) / maxCallOi * 5));

  return {
    support: {
      strike: topSupport[0]?.strike_price || 0,
      put_oi: topSupport[0]?.put_oi || 0,
      strength: supportStrength,
    },
    resistance: {
      strike: topResistance[0]?.strike_price || 0,
      call_oi: topResistance[0]?.call_oi || 0,
      strength: resistanceStrength,
    },
    support_levels: topSupport.map(s => ({
      strike: s.strike_price,
      put_oi: s.put_oi,
    })),
    resistance_levels: topResistance.map(s => ({
      strike: s.strike_price,
      call_oi: s.call_oi,
    })),
  };
}

// ============================================
// 2. Put/Call Ratio (PCR)
// ============================================

/**
 * Calculate Put/Call Ratio based on Volume and OI
 * 
 * PCR Interpretation:
 * - PCR < 0.7: Bullish (more calls = expecting up)
 * - PCR 0.7-1.0: Neutral
 * - PCR > 1.0: Bearish (more puts = expecting down)
 * 
 * Contrarian view (when extreme):
 * - PCR > 1.5: Extremely bearish → potential reversal up
 * - PCR < 0.5: Extremely bullish → potential reversal down
 */
export function calculatePCR(
  data: OptionStrike[],
  currentPrice?: number
): PCRResult {
  const totals = {
    total_put_oi: 0,
    total_call_oi: 0,
    total_put_volume: 0,
    total_call_volume: 0,
  };

  for (const strike of data) {
    totals.total_put_oi += strike.put_oi;
    totals.total_call_oi += strike.call_oi;
    totals.total_put_volume += strike.put_volume;
    totals.total_call_volume += strike.call_volume;
  }

  // Calculate PCRs
  const oi_pcr = totals.total_call_oi > 0 
    ? totals.total_put_oi / totals.total_call_oi 
    : 0;
    
  const volume_pcr = totals.total_call_volume > 0 
    ? totals.total_put_volume / totals.total_call_volume 
    : 0;

  // ATM PCR (strikes within 2% of current price)
  let atm_pcr = 0;
  if (currentPrice && currentPrice > 0) {
    const atmRange = currentPrice * 0.02;
    const atmStrikes = data.filter(
      s => Math.abs(s.strike_price - currentPrice) <= atmRange
    );
    const atmPut = atmStrikes.reduce((sum, s) => sum + s.put_oi, 0);
    const atmCall = atmStrikes.reduce((sum, s) => sum + s.call_oi, 0);
    atm_pcr = atmCall > 0 ? atmPut / atmCall : 0;
  }

  // Determine signal
  let signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  let description: string;

  // Use weighted average of OI and Volume PCR
  const avgPcr = (oi_pcr * 0.6) + (volume_pcr * 0.4);

  if (avgPcr < 0.7) {
    signal = "BULLISH";
    description = `Low PCR (${avgPcr.toFixed(2)}) indicates bullish sentiment - more call activity`;
  } else if (avgPcr > 1.0) {
    signal = "BEARISH";
    description = `High PCR (${avgPcr.toFixed(2)}) indicates bearish sentiment - more put activity`;
  } else {
    signal = "NEUTRAL";
    description = `PCR (${avgPcr.toFixed(2)}) in neutral range - no clear directional bias`;
  }

  return {
    oi_pcr: Math.round(oi_pcr * 100) / 100,
    volume_pcr: Math.round(volume_pcr * 100) / 100,
    atm_pcr: Math.round(atm_pcr * 100) / 100,
    signal,
    totals,
    description,
  };
}

// ============================================
// 3. Max Pain Calculation
// ============================================

/**
 * Calculate Max Pain - the strike price where option buyers lose the most
 * 
 * Algorithm:
 * For each potential settlement price (strike):
 * 1. Calculate how much PUT holders would lose if price settles there
 * 2. Calculate how much CALL holders would lose if price settles there
 * 3. Sum total pain
 * 4. Max Pain = strike with maximum total pain (option writers profit most)
 * 
 * Market tends to gravitate towards Max Pain near expiration.
 */
export function calculateMaxPain(
  data: OptionStrike[],
  currentPrice: number
): MaxPainResult {
  if (data.length === 0) {
    return {
      max_pain_strike: 0,
      distance_from_price: 0,
      distance_percent: 0,
      pain_by_strike: [],
      signal: "NEUTRAL",
      description: "No data available",
    };
  }

  // Get all unique strikes
  const strikes = [...new Set(data.map(s => s.strike_price))].sort((a, b) => a - b);
  
  const pain_by_strike: Array<{ strike: number; total_pain: number }> = [];

  // For each potential settlement price
  for (const settlementPrice of strikes) {
    let totalPain = 0;

    for (const option of data) {
      // Put pain calculation:
      // If settlement > strike: Put expires worthless → buyer loses
      // Pain = Put OI × (strike - min(settlement, strike)) when settlement > strike
      if (option.put_oi > 0) {
        if (settlementPrice > option.strike_price) {
          // Put is OTM at settlement - buyer loses
          totalPain += option.put_oi * (option.strike_price - Math.min(settlementPrice, option.strike_price));
        }
        // If ITM, buyer profits, no pain
      }

      // Call pain calculation:
      // If settlement < strike: Call expires worthless → buyer loses
      // Pain = Call OI × (max(settlement, strike) - strike) when settlement < strike
      if (option.call_oi > 0) {
        if (settlementPrice < option.strike_price) {
          // Call is OTM at settlement - buyer loses
          totalPain += option.call_oi * (Math.max(settlementPrice, option.strike_price) - option.strike_price);
        }
        // If ITM, buyer profits, no pain
      }
    }

    pain_by_strike.push({ strike: settlementPrice, total_pain: totalPain });
  }

  // Find strike with maximum pain
  const maxPainEntry = pain_by_strike.reduce(
    (max, curr) => curr.total_pain > max.total_pain ? curr : max,
    { strike: 0, total_pain: -Infinity }
  );

  const max_pain_strike = maxPainEntry.strike;
  const distance_from_price = max_pain_strike - currentPrice;
  const distance_percent = currentPrice > 0 
    ? (distance_from_price / currentPrice) * 100 
    : 0;

  // Determine signal
  let signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  let description: string;

  if (distance_percent > 1) {
    signal = "BULLISH";
    description = `Max Pain ${max_pain_strike} is ${Math.abs(distance_percent).toFixed(1)}% above current price - upward magnet`;
  } else if (distance_percent < -1) {
    signal = "BEARISH";
    description = `Max Pain ${max_pain_strike} is ${Math.abs(distance_percent).toFixed(1)}% below current price - downward magnet`;
  } else {
    signal = "NEUTRAL";
    description = `Price near Max Pain ${max_pain_strike} - consolidation expected`;
  }

  return {
    max_pain_strike,
    distance_from_price: Math.round(distance_from_price * 100) / 100,
    distance_percent: Math.round(distance_percent * 100) / 100,
    pain_by_strike: pain_by_strike.sort((a, b) => a.strike - b.strike),
    signal,
    description,
  };
}

// ============================================
// 4. Volume Analysis (NEW)
// ============================================

/**
 * Analyze Volume Data for additional confirmation
 * 
 * Volume analysis provides:
 * - Volume PCR (Put/Call Ratio by volume)
 * - Volume Spikes (unusual activity)
 * - ATM Volume Concentration
 * - Volume Confirmation signal
 */
export function analyzeVolume(
  data: OptionStrike[],
  currentPrice: number
): VolumeAnalysis {
  if (data.length === 0) {
    return {
      total_call_volume: 0,
      total_put_volume: 0,
      total_volume: 0,
      volume_pcr: 1,
      avg_volume_per_strike: 0,
      volume_spikes: [],
      atm_volume_concentration: 0,
      signal: "NEUTRAL",
      confidence: 0,
      description: "No volume data available",
    };
  }

  // Calculate totals
  let totalCallVol = 0;
  let totalPutVol = 0;
  let atmCallVol = 0;
  let atmPutVol = 0;
  const atmRange = currentPrice * 0.02; // 2% range

  for (const strike of data) {
    totalCallVol += strike.call_volume;
    totalPutVol += strike.put_volume;

    // ATM volume (within 2% of price)
    if (Math.abs(strike.strike_price - currentPrice) <= atmRange) {
      atmCallVol += strike.call_volume;
      atmPutVol += strike.put_volume;
    }
  }

  const totalVolume = totalCallVol + totalPutVol;
  const volumePcr = totalCallVol > 0 ? totalPutVol / totalCallVol : 1;
  const avgVolumePerStrike = totalVolume / data.length;

  // Find volume spikes (>2x average)
  const volumeSpikes: VolumeSpike[] = [];
  const spikeThreshold = avgVolumePerStrike * 2;

  for (const strike of data) {
    const strikeVolume = strike.call_volume + strike.put_volume;
    if (strikeVolume > spikeThreshold) {
      volumeSpikes.push({
        strike: strike.strike_price,
        total_volume: strikeVolume,
        call_volume: strike.call_volume,
        put_volume: strike.put_volume,
        volume_ratio: avgVolumePerStrike > 0 ? strikeVolume / avgVolumePerStrike : 0,
        is_call_dominant: strike.call_volume > strike.put_volume,
        near_price: Math.abs(strike.strike_price - currentPrice) <= atmRange,
      });
    }
  }

  // Sort by volume
  volumeSpikes.sort((a, b) => b.total_volume - a.total_volume);

  // ATM concentration
  const atmTotalVol = atmCallVol + atmPutVol;
  const atmConcentration = totalVolume > 0 ? (atmTotalVol / totalVolume) * 100 : 0;

  // Determine volume signal
  let signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  let confidence = 50;
  let description: string;

  // Analyze volume spikes near price
  const nearPriceSpikes = volumeSpikes.filter(s => s.near_price);
  const callDominantSpikes = nearPriceSpikes.filter(s => s.is_call_dominant);
  const putDominantSpikes = nearPriceSpikes.filter(s => !s.is_call_dominant);

  if (volumePcr < 0.7) {
    // Low PCR = Call heavy = Bullish
    signal = "BULLISH";
    confidence = 65 + Math.min(20, (0.7 - volumePcr) * 50);
    description = `Volume PCR ต่ำ (${volumePcr.toFixed(2)}) - Call Volume สูงกว่า Put = มีแรงซื้อ`;
  } else if (volumePcr > 1.2) {
    // High PCR = Put heavy = Bearish
    signal = "BEARISH";
    confidence = 65 + Math.min(20, (volumePcr - 1.2) * 30);
    description = `Volume PCR สูง (${volumePcr.toFixed(2)}) - Put Volume สูงกว่า Call = มีแรงขาย/Hedging`;
  } else if (callDominantSpikes.length > putDominantSpikes.length * 1.5) {
    // More call-dominant spikes = Bullish
    signal = "BULLISH";
    confidence = 55 + Math.min(15, callDominantSpikes.length * 5);
    description = `Volume Spikes ใกล้ราคาเป็น Call-dominant (${callDominantSpikes.length}/${nearPriceSpikes.length}) = มีแรงซื้อ`;
  } else if (putDominantSpikes.length > callDominantSpikes.length * 1.5) {
    // More put-dominant spikes = Bearish
    signal = "BEARISH";
    confidence = 55 + Math.min(15, putDominantSpikes.length * 5);
    description = `Volume Spikes ใกล้ราคาเป็น Put-dominant (${putDominantSpikes.length}/${nearPriceSpikes.length}) = มีแรงขาย`;
  } else {
    signal = "NEUTRAL";
    confidence = 40 + Math.min(10, atmConcentration / 5);
    description = `Volume สมดุล - ไม่มีสัญญาณชัดเจนจาก Volume`;
  }

  // Boost confidence if high ATM concentration
  if (atmConcentration > 30) {
    confidence = Math.min(100, confidence + 10);
  }

  return {
    total_call_volume: totalCallVol,
    total_put_volume: totalPutVol,
    total_volume: totalVolume,
    volume_pcr: Math.round(volumePcr * 100) / 100,
    avg_volume_per_strike: Math.round(avgVolumePerStrike),
    volume_spikes: volumeSpikes.slice(0, 10), // Top 10 spikes
    atm_volume_concentration: Math.round(atmConcentration * 10) / 10,
    signal,
    confidence: Math.round(confidence),
    description,
  };
}

/**
 * Check if volume confirms the signal direction
 * Returns a score from -10 to +10
 */
export function getVolumeConfirmation(
  volumeAnalysis: VolumeAnalysis,
  signalDirection: "BUY" | "SELL" | "NEUTRAL"
): { score: number; confirms: boolean; description: string } {
  if (signalDirection === "NEUTRAL") {
    return {
      score: 0,
      confirms: true,
      description: "Signal is neutral - no volume confirmation needed",
    };
  }

  const volumeSignal = volumeAnalysis.signal;
  const volumeConfidence = volumeAnalysis.confidence;

  // Check if volume confirms signal direction
  const confirms =
    (signalDirection === "BUY" && volumeSignal === "BULLISH") ||
    (signalDirection === "SELL" && volumeSignal === "BEARISH");

  // Check for contradiction
  const contradicts =
    (signalDirection === "BUY" && volumeSignal === "BEARISH") ||
    (signalDirection === "SELL" && volumeSignal === "BULLISH");

  let score: number;
  let description: string;

  if (confirms) {
    // Volume confirms signal - boost score based on confidence
    score = Math.round((volumeConfidence - 50) / 5); // 0 to +10
    description = `Volume ยืนยัน ${signalDirection}: ${volumeAnalysis.description}`;
  } else if (contradicts) {
    // Volume contradicts signal - reduce score
    score = -Math.round((volumeConfidence - 50) / 5); // 0 to -10
    description = `⚠️ Volume ขัดแย้ง ${signalDirection}: ${volumeAnalysis.description}`;
  } else {
    // Volume neutral - no effect
    score = 0;
    description = `Volume ไม่มีสัญญาณชัดเจน`;
  }

  return {
    score: Math.max(-10, Math.min(10, score)),
    confirms: confirms || volumeSignal === "NEUTRAL",
    description,
  };
}

// ============================================
// 5. Signal Generation
// ============================================

/**
 * Generate Trading Signal based on comprehensive analysis
 * 
 * Advanced Scoring System:
 * - Base Score: 50 (Neutral)
 * - PCR Factor: +10 (bullish) / -10 (bearish)
 * - Trend (VWAP): +15 / -15
 * - OI Flow: +15 / -15
 * - Wall Interaction: +20 / -20
 * - Max Pain: +10 / -10
 * 
 * Final Score: 0-100 (0 = Strong Sell, 50 = Neutral, 100 = Strong Buy)
 */
export function generateSignal(market: MarketData): TradingSignal {
  const { current_price, vwap, strikes } = market;

  // Calculate all metrics
  const walls = getLiquidityWalls(strikes);
  const pcr = calculatePCR(strikes, current_price);
  const maxPain = calculateMaxPain(strikes, current_price);

  // Calculate OI Flow (net change)
  const netCallOiChange = strikes.reduce((sum, s) => sum + s.call_oi_change, 0);
  const netPutOiChange = strikes.reduce((sum, s) => sum + s.put_oi_change, 0);

  // ============================================
  // Advanced Scoring System
  // ============================================
  
  // Base Score: Start at 50 (Neutral)
  let score = 50;
  
  // Track individual scores for debugging
  let pcrScoreVal = 0;
  let vwapScoreVal = 0;
  let wallScoreVal = 0;
  let maxPainScoreVal = 0;
  let flowScoreVal = 0;

  // Separate factors into positive (bullish) and negative (bearish)
  const positiveFactors: string[] = [];
  const negativeFactors: string[] = [];
  const breakdown: string[] = [];

  // ============================================
  // 1. PCR Factor (+10 / -10)
  // PCR (Volume) < 0.6 = Bullish, > 1.0 = Bearish
  // ============================================
  const volumePcr = pcr.volume_pcr;
  
  if (volumePcr < 0.6) {
    score += 10;
    pcrScoreVal = 10;
    positiveFactors.push(`PCR ต่ำมาก (${volumePcr.toFixed(2)}) = นักลงทุนซื้อ Call มากกว่า Put อย่างชัดเจน`);
    breakdown.push(`[+10] PCR ${volumePcr.toFixed(2)} < 0.6 → Bullish Sentiment`);
  } else if (volumePcr < 0.8) {
    score += 5;
    pcrScoreVal = 5;
    positiveFactors.push(`PCR ค่อนข้างต่ำ (${volumePcr.toFixed(2)}) = มีแนวโน้ม Bullish`);
    breakdown.push(`[+5] PCR ${volumePcr.toFixed(2)} < 0.8 → Mild Bullish`);
  } else if (volumePcr > 1.2) {
    score -= 10;
    pcrScoreVal = -10;
    negativeFactors.push(`PCR สูงมาก (${volumePcr.toFixed(2)}) = นักลงทุนซื้อ Put มากกว่า Call อย่างชัดเจน`);
    breakdown.push(`[-10] PCR ${volumePcr.toFixed(2)} > 1.2 → Bearish Sentiment`);
  } else if (volumePcr > 1.0) {
    score -= 5;
    pcrScoreVal = -5;
    negativeFactors.push(`PCR ค่อนข้างสูง (${volumePcr.toFixed(2)}) = มีแนวโน้ม Bearish`);
    breakdown.push(`[-5] PCR ${volumePcr.toFixed(2)} > 1.0 → Mild Bearish`);
  } else {
    breakdown.push(`[0] PCR ${volumePcr.toFixed(2)} = Neutral`);
  }

  // ============================================
  // 2. Trend Factor - VWAP (+15 / -15)
  // Price > VWAP = Bullish, Price < VWAP = Bearish
  // ============================================
  if (current_price > 0 && vwap > 0) {
    const vwapDiff = ((current_price - vwap) / vwap) * 100;
    
    if (current_price > vwap) {
      score += 15;
      vwapScoreVal = 15;
      positiveFactors.push(`ราคาเหนือ VWAP (+${vwapDiff.toFixed(2)}%) = แรงซื้อเหนือกว่าแรงขาย`);
      breakdown.push(`[+15] Price ${current_price.toFixed(1)} > VWAP ${vwap.toFixed(1)} → Bullish Trend`);
    } else if (current_price < vwap) {
      score -= 15;
      vwapScoreVal = -15;
      negativeFactors.push(`ราคาใต้ VWAP (${vwapDiff.toFixed(2)}%) = แรงขายเหนือกว่าแรงซื้อ`);
      breakdown.push(`[-15] Price ${current_price.toFixed(1)} < VWAP ${vwap.toFixed(1)} → Bearish Trend`);
    } else {
      breakdown.push(`[0] Price = VWAP → Neutral Trend`);
    }
  }

  // ============================================
  // 3. OI Flow Factor (+15 / -15)
  // Net Call OI Change > Net Put = Bullish (Smart money buying calls)
  // Net Put OI Change > Net Call = Bearish (Smart money hedging)
  // ============================================
  if (netCallOiChange > netPutOiChange && netCallOiChange > 0) {
    score += 15;
    flowScoreVal = 15;
    const diff = netCallOiChange - netPutOiChange;
    positiveFactors.push(`เงินไหลเข้า Call มากกว่า Put (+${diff.toLocaleString()}) = Smart Money คาดราคาขึ้น`);
    breakdown.push(`[+15] Net Call OI (+${netCallOiChange.toLocaleString()}) > Net Put OI (+${netPutOiChange.toLocaleString()}) → Smart Money Bullish`);
  } else if (netPutOiChange > netCallOiChange && netPutOiChange > 0) {
    score -= 15;
    flowScoreVal = -15;
    const diff = netPutOiChange - netCallOiChange;
    negativeFactors.push(`เงินไหลเข้า Put มากกว่า Call (+${diff.toLocaleString()}) = Smart Money คาดราคาลง/Hedging`);
    breakdown.push(`[-15] Net Put OI (+${netPutOiChange.toLocaleString()}) > Net Call OI (+${netCallOiChange.toLocaleString()}) → Smart Money Bearish`);
  } else {
    breakdown.push(`[0] OI Flow Balanced → Neutral`);
  }

  // ============================================
  // 4. Wall Interaction (+20 / -20)
  // Price near Put Wall (Support) = Bullish bounce expected
  // Price near Call Wall (Resistance) = Bearish rejection expected
  // ============================================
  const supportDistance = current_price - walls.support.strike;
  const resistanceDistance = walls.resistance.strike - current_price;
  const priceRange = walls.resistance.strike - walls.support.strike;
  
  if (priceRange > 0) {
    const supportProximityPct = (supportDistance / priceRange) * 100;
    const resistanceProximityPct = (resistanceDistance / priceRange) * 100;

    // Near Put Wall (Support) - within 20% of range
    if (supportProximityPct >= 0 && supportProximityPct < 20) {
      score += 20;
      wallScoreVal = 20;
      positiveFactors.push(`ราคาใกล้แนวรับ ${walls.support.strike} (Put Wall) = คาดเด้งขึ้น`);
      breakdown.push(`[+20] Price near Put Wall ${walls.support.strike} (${supportProximityPct.toFixed(0)}% from support) → Bounce Expected`);
    }
    // Near Call Wall (Resistance) - within 20% of range
    else if (resistanceProximityPct >= 0 && resistanceProximityPct < 20) {
      score -= 20;
      wallScoreVal = -20;
      negativeFactors.push(`ราคาใกล้แนวต้าน ${walls.resistance.strike} (Call Wall) = คาดถูกกดลง`);
      breakdown.push(`[-20] Price near Call Wall ${walls.resistance.strike} (${resistanceProximityPct.toFixed(0)}% from resistance) → Rejection Expected`);
    }
    // Breaking above resistance = Strong bullish (+25 bonus)
    else if (current_price > walls.resistance.strike) {
      score += 25;
      wallScoreVal = 25;
      positiveFactors.push(`ราคาทะลุแนวต้าน ${walls.resistance.strike} = Breakout ขาขึ้น!`);
      breakdown.push(`[+25] BREAKOUT! Price ${current_price.toFixed(1)} > Call Wall ${walls.resistance.strike}`);
    }
    // Breaking below support = Strong bearish (-25)
    else if (current_price < walls.support.strike) {
      score -= 25;
      wallScoreVal = -25;
      negativeFactors.push(`ราคาหลุดแนวรับ ${walls.support.strike} = Breakdown ขาลง!`);
      breakdown.push(`[-25] BREAKDOWN! Price ${current_price.toFixed(1)} < Put Wall ${walls.support.strike}`);
    }
    else {
      // Price in middle of range
      breakdown.push(`[0] Price in middle of range (${supportProximityPct.toFixed(0)}% from support) → Neutral`);
    }
  }

  // ============================================
  // 5. Max Pain Factor (+10 / -10)
  // Price below Max Pain = Bullish pull up
  // Price above Max Pain = Bearish pull down
  // ============================================
  if (maxPain.distance_percent > 2) {
    score += 10;
    maxPainScoreVal = 10;
    positiveFactors.push(`Max Pain (${maxPain.max_pain_strike}) อยู่เหนือราคา ${maxPain.distance_percent.toFixed(1)}% = แรงดึงขึ้น`);
    breakdown.push(`[+10] Max Pain ${maxPain.max_pain_strike} is ${maxPain.distance_percent.toFixed(1)}% above price → Upward Magnet`);
  } else if (maxPain.distance_percent < -2) {
    score -= 10;
    maxPainScoreVal = -10;
    negativeFactors.push(`Max Pain (${maxPain.max_pain_strike}) อยู่ใต้ราคา ${Math.abs(maxPain.distance_percent).toFixed(1)}% = แรงดึงลง`);
    breakdown.push(`[-10] Max Pain ${maxPain.max_pain_strike} is ${Math.abs(maxPain.distance_percent).toFixed(1)}% below price → Downward Magnet`);
  } else {
    breakdown.push(`[0] Price near Max Pain ${maxPain.max_pain_strike} (${maxPain.distance_percent.toFixed(1)}%) → Sideways Expected`);
  }

  // ============================================
  // 6. Volume Analysis & Confirmation (NEW)
  // Volume confirms or contradicts the signal
  // ============================================
  const volumeAnalysis = analyzeVolume(strikes, current_price);
  let volumeScoreVal = 0;

  // Calculate preliminary signal direction for volume confirmation
  const preliminarySignal: "BUY" | "SELL" | "NEUTRAL" = 
    score >= 55 ? "BUY" : score <= 45 ? "SELL" : "NEUTRAL";

  const volumeConfirmation = getVolumeConfirmation(volumeAnalysis, preliminarySignal);
  volumeScoreVal = volumeConfirmation.score;
  score += volumeScoreVal;

  if (volumeScoreVal > 0) {
    positiveFactors.push(volumeConfirmation.description);
    breakdown.push(`[+${volumeScoreVal}] Volume Confirmation: ${volumeAnalysis.signal} (${volumeAnalysis.confidence}% confidence)`);
  } else if (volumeScoreVal < 0) {
    negativeFactors.push(volumeConfirmation.description);
    breakdown.push(`[${volumeScoreVal}] Volume Contradiction: ${volumeAnalysis.signal} (${volumeAnalysis.confidence}% confidence)`);
  } else {
    breakdown.push(`[0] Volume: ${volumeAnalysis.signal} - ไม่มีสัญญาณชัดเจน`);
  }

  // ============================================
  // Find Significant Strikes (Unusual Volume Spikes)
  // Strikes with volume > 2x average are highlighted
  // ============================================
  const significantStrikes = volumeAnalysis.volume_spikes
    .map(s => s.strike)
    .sort((a, b) => a - b);

  if (significantStrikes.length > 0) {
    const spikeInfo = volumeAnalysis.volume_spikes
      .slice(0, 5)
      .map(s => `${s.strike}(${s.volume_ratio.toFixed(1)}x)`)
      .join(', ');
    breakdown.push(`[INFO] Volume Spikes: ${spikeInfo}`);
  }

  // ============================================
  // Clamp Score to 0-100
  // ============================================
  score = Math.max(0, Math.min(100, score));

  // ============================================
  // Determine Signal and Sentiment
  // ============================================
  let signal: "BUY" | "SELL" | "NEUTRAL";
  let sentiment: "Bullish" | "Bearish" | "Sideway";
  let reason: string;

  if (score >= 75) {
    signal = "BUY";
    sentiment = "Bullish";
    reason = "สัญญาณซื้อแข็งแกร่ง: หลายปัจจัยสนับสนุนขาขึ้น (PCR ต่ำ, ราคาเหนือ VWAP, เงินไหลเข้า Call, ใกล้แนวรับ)";
  } else if (score >= 60) {
    signal = "BUY";
    sentiment = "Bullish";
    reason = "หลายปัจจัยเอียงขาขึ้น: ตลาด Options บ่งชี้แนวโน้มขึ้น";
  } else if (score >= 55) {
    signal = "BUY";
    sentiment = "Bullish";
    reason = "มีแนวโน้มขึ้นเล็กน้อยจากข้อมูล Options";
  } else if (score <= 25) {
    signal = "SELL";
    sentiment = "Bearish";
    reason = "สัญญาณขายแข็งแกร่ง: หลายปัจจัยสนับสนุนขาลง (PCR สูง, ราคาใต้ VWAP, เงินไหลเข้า Put, ใกล้แนวต้าน)";
  } else if (score <= 40) {
    signal = "SELL";
    sentiment = "Bearish";
    reason = "หลายปัจจัยเอียงขาลง: ตลาด Options บ่งชี้แนวโน้มลง";
  } else if (score <= 45) {
    signal = "SELL";
    sentiment = "Bearish";
    reason = "มีแนวโน้มลงเล็กน้อยจากข้อมูล Options";
  } else {
    signal = "NEUTRAL";
    sentiment = "Sideway";
    reason = "สัญญาณผสม: ไม่มีทิศทางชัดเจน รอความชัดเจนก่อนเข้าเทรด";
  }

  // Add score summary to breakdown
  breakdown.unshift(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  breakdown.unshift(`FINAL SCORE: ${score}/100 → ${signal} (${sentiment})`);
  breakdown.unshift(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // ============================================
  // Generate Human-Readable Summary (Thai)
  // ============================================
  const summary = generateHumanSummary({
    signal,
    score,
    sentiment,
    current_price,
    vwap,
    volumePcr,
    maxPain,
    walls,
    netCallOiChange,
    netPutOiChange,
    positiveFactors,
    negativeFactors,
    pcrScoreVal,
    vwapScoreVal,
    wallScoreVal,
    maxPainScoreVal,
    flowScoreVal,
    volumeScoreVal,
    volumeAnalysis,
  });

  return {
    signal,
    score,
    sentiment,
    reason,
    summary,
    factors: {
      positive: positiveFactors,
      negative: negativeFactors,
    },
    key_levels: {
      max_pain: maxPain.max_pain_strike,
      call_wall: walls.resistance.strike,
      put_wall: walls.support.strike,
      significant_strikes: significantStrikes,
    },
    factor_scores: {
      pcr_score: pcrScoreVal,
      vwap_score: vwapScoreVal,
      wall_score: wallScoreVal,
      max_pain_score: maxPainScoreVal,
      flow_score: flowScoreVal,
      volume_score: volumeScoreVal,
    },
    volume_analysis: volumeAnalysis,
    breakdown,
  };
}

// ============================================
// Human-Readable Summary Generator
// ============================================

interface SummaryInput {
  signal: "BUY" | "SELL" | "NEUTRAL";
  score: number;
  sentiment: "Bullish" | "Bearish" | "Sideway";
  current_price: number;
  vwap: number;
  volumePcr: number;
  maxPain: MaxPainResult;
  walls: LiquidityWalls;
  netCallOiChange: number;
  netPutOiChange: number;
  positiveFactors: string[];
  negativeFactors: string[];
  pcrScoreVal: number;
  vwapScoreVal: number;
  wallScoreVal: number;
  maxPainScoreVal: number;
  flowScoreVal: number;
  volumeScoreVal: number;
  volumeAnalysis: VolumeAnalysis;
}

function generateHumanSummary(input: SummaryInput): string {
  const {
    signal,
    score,
    sentiment,
    current_price,
    vwap,
    volumePcr,
    maxPain,
    walls,
    netCallOiChange,
    netPutOiChange,
    positiveFactors,
    negativeFactors,
    pcrScoreVal,
    vwapScoreVal,
    wallScoreVal,
    maxPainScoreVal,
    flowScoreVal,
    volumeScoreVal,
    volumeAnalysis,
  } = input;

  const lines: string[] = [];

  // ============================================
  // Opening - What is the signal?
  // ============================================
  if (signal === "BUY") {
    if (score >= 75) {
      lines.push(`🟢 สรุป: สัญญาณ "ซื้อ" ชัดเจนมาก (คะแนน ${score}/100)`);
      lines.push(`ตลาดส่งสัญญาณขาขึ้นค่อนข้างแข็งแกร่ง มีโอกาสสูงที่ราคาจะปรับตัวขึ้นในระยะสั้น`);
    } else if (score >= 60) {
      lines.push(`🟢 สรุป: สัญญาณ "ซื้อ" ค่อนข้างดี (คะแนน ${score}/100)`);
      lines.push(`หลายปัจจัยสนับสนุนขาขึ้น แต่ยังไม่ถึงขั้นแข็งแกร่งมาก ควรระวังจุดกลับตัว`);
    } else {
      lines.push(`🟢 สรุป: สัญญาณ "ซื้อ" เบาๆ (คะแนน ${score}/100)`);
      lines.push(`มีแนวโน้มขึ้นเล็กน้อย แต่ไม่ชัดเจนมาก ควรรอสัญญาณยืนยันเพิ่ม`);
    }
  } else if (signal === "SELL") {
    if (score <= 25) {
      lines.push(`🔴 สรุป: สัญญาณ "ขาย" ชัดเจนมาก (คะแนน ${score}/100)`);
      lines.push(`ตลาดส่งสัญญาณขาลงค่อนข้างแข็งแกร่ง มีโอกาสสูงที่ราคาจะปรับตัวลงในระยะสั้น`);
    } else if (score <= 40) {
      lines.push(`🔴 สรุป: สัญญาณ "ขาย" ค่อนข้างชัด (คะแนน ${score}/100)`);
      lines.push(`หลายปัจจัยสนับสนุนขาลง แต่ยังไม่ถึงขั้นแข็งแกร่งมาก ควรระวังจุดกลับตัว`);
    } else {
      lines.push(`🔴 สรุป: สัญญาณ "ขาย" เบาๆ (คะแนน ${score}/100)`);
      lines.push(`มีแนวโน้มลงเล็กน้อย แต่ไม่ชัดเจนมาก ควรรอสัญญาณยืนยันเพิ่ม`);
    }
  } else {
    lines.push(`⚪ สรุป: สัญญาณ "ไซด์เวย์" (คะแนน ${score}/100)`);
    lines.push(`ตลาดยังไม่มีทิศทางชัดเจน ปัจจัยบวกและลบค่อนข้างสมดุลกัน ควรรอให้ตลาดเลือกทางก่อน`);
  }

  lines.push("");
  lines.push("📊 เหตุผลแบบเข้าใจง่าย:");
  lines.push("");

  // ============================================
  // Explain PCR (Put/Call Ratio)
  // ============================================
  if (pcrScoreVal !== 0) {
    if (pcrScoreVal > 0) {
      lines.push(`✅ นักลงทุนซื้อ "Call Option" มากกว่า "Put Option"`);
      lines.push(`   → หมายความว่า: คนส่วนใหญ่คาดว่าราคาจะขึ้น เพราะ Call คือสิทธิ์ซื้อ ถ้าราคาขึ้นก็กำไร`);
      if (volumePcr < 0.6) {
        lines.push(`   → PCR = ${volumePcr.toFixed(2)} (ต่ำมาก = Bullish แรง)`);
      } else {
        lines.push(`   → PCR = ${volumePcr.toFixed(2)} (ต่ำ = Bullish)`);
      }
    } else {
      lines.push(`⚠️ นักลงทุนซื้อ "Put Option" มากกว่า "Call Option"`);
      lines.push(`   → หมายความว่า: คนส่วนใหญ่คาดว่าราคาจะลง หรือต้องการป้องกันความเสี่ยง`);
      lines.push(`   → Put คือสิทธิ์ขาย ถ้าราคาลงก็กำไร`);
      if (volumePcr > 1.2) {
        lines.push(`   → PCR = ${volumePcr.toFixed(2)} (สูงมาก = Bearish แรง)`);
      } else {
        lines.push(`   → PCR = ${volumePcr.toFixed(2)} (สูง = Bearish)`);
      }
    }
    lines.push("");
  }

  // ============================================
  // Explain VWAP
  // ============================================
  if (vwapScoreVal !== 0) {
    const vwapDiff = ((current_price - vwap) / vwap) * 100;
    if (vwapScoreVal > 0) {
      lines.push(`✅ ราคาปัจจุบันอยู่เหนือ "ราคาเฉลี่ยถ่วงน้ำหนัก" (VWAP)`);
      lines.push(`   → หมายความว่า: คนที่ซื้อวันนี้ส่วนใหญ่ยังกำไรอยู่ มีแรงซื้อมากกว่าแรงขาย`);
      lines.push(`   → ราคา ${current_price.toFixed(1)} เหนือ VWAP ${vwap.toFixed(1)} (+${vwapDiff.toFixed(2)}%)`);
    } else {
      lines.push(`⚠️ ราคาปัจจุบันอยู่ใต้ "ราคาเฉลี่ยถ่วงน้ำหนัก" (VWAP)`);
      lines.push(`   → หมายความว่า: คนที่ซื้อวันนี้ส่วนใหญ่ขาดทุนอยู่ มีแรงขายกดราคาลง`);
      lines.push(`   → ราคา ${current_price.toFixed(1)} ใต้ VWAP ${vwap.toFixed(1)} (${vwapDiff.toFixed(2)}%)`);
    }
    lines.push("");
  }

  // ============================================
  // Explain OI Flow (Smart Money)
  // ============================================
  if (flowScoreVal !== 0) {
    if (flowScoreVal > 0) {
      lines.push(`✅ "เงินใหญ่" (Smart Money) กำลังเพิ่มสถานะ Call`);
      lines.push(`   → หมายความว่า: นักลงทุนสถาบันคาดว่าราคาจะขึ้น จึงซื้อ Call เพิ่ม`);
      lines.push(`   → Call OI เพิ่ม ${netCallOiChange.toLocaleString()} สัญญา > Put OI เพิ่ม ${netPutOiChange.toLocaleString()} สัญญา`);
    } else {
      lines.push(`⚠️ "เงินใหญ่" (Smart Money) กำลังเพิ่มสถานะ Put`);
      lines.push(`   → หมายความว่า: นักลงทุนสถาบันกำลังป้องกันความเสี่ยง หรือคาดว่าราคาจะลง`);
      lines.push(`   → Put OI เพิ่ม ${netPutOiChange.toLocaleString()} สัญญา > Call OI เพิ่ม ${netCallOiChange.toLocaleString()} สัญญา`);
    }
    lines.push("");
  }

  // ============================================
  // Explain Wall Position
  // ============================================
  if (wallScoreVal !== 0) {
    if (wallScoreVal >= 25) {
      lines.push(`✅ ราคาทะลุ "แนวต้านหลัก" แล้ว! (Breakout)`);
      lines.push(`   → หมายความว่า: ราคาเบรคแนวต้านที่ ${walls.resistance.strike} ได้สำเร็จ`);
      lines.push(`   → มักเป็นสัญญาณขาขึ้นต่อ เพราะ Short ต้อง Cover`);
    } else if (wallScoreVal > 0) {
      lines.push(`✅ ราคาอยู่ใกล้ "แนวรับหลัก" (Put Wall)`);
      lines.push(`   → หมายความว่า: ที่ราคา ${walls.support.strike} มี Put OI สูงมาก (${walls.support.put_oi.toLocaleString()} สัญญา)`);
      lines.push(`   → คนขาย Put จะพยายามไม่ให้ราคาหลุด เพราะจะขาดทุน → มักเด้งขึ้น`);
    } else if (wallScoreVal <= -25) {
      lines.push(`⚠️ ราคาหลุด "แนวรับหลัก" แล้ว! (Breakdown)`);
      lines.push(`   → หมายความว่า: ราคาหลุดแนวรับที่ ${walls.support.strike} ไปแล้ว`);
      lines.push(`   → มักเป็นสัญญาณขาลงต่อ เพราะ Stop Loss ถูก Trigger`);
    } else {
      lines.push(`⚠️ ราคาอยู่ใกล้ "แนวต้านหลัก" (Call Wall)`);
      lines.push(`   → หมายความว่า: ที่ราคา ${walls.resistance.strike} มี Call OI สูงมาก (${walls.resistance.call_oi.toLocaleString()} สัญญา)`);
      lines.push(`   → คนขาย Call จะพยายามกดราคาไม่ให้ทะลุ เพราะจะขาดทุน → มักถูกกดลง`);
    }
    lines.push("");
  }

  // ============================================
  // Explain Max Pain
  // ============================================
  if (maxPainScoreVal !== 0) {
    if (maxPainScoreVal > 0) {
      lines.push(`✅ ราคาอยู่ต่ำกว่า "Max Pain" (${maxPain.max_pain_strike})`);
      lines.push(`   → Max Pain คือจุดที่คนซื้อ Option ขาดทุนมากที่สุด`);
      lines.push(`   → Market Maker มักดึงราคาเข้าหา Max Pain → คาดว่าราคาจะถูกดึงขึ้น`);
    } else {
      lines.push(`⚠️ ราคาอยู่สูงกว่า "Max Pain" (${maxPain.max_pain_strike})`);
      lines.push(`   → Max Pain คือจุดที่คนซื้อ Option ขาดทุนมากที่สุด`);
      lines.push(`   → Market Maker มักดึงราคาเข้าหา Max Pain → คาดว่าราคาจะถูกดึงลง`);
    }
    lines.push("");
  }

  // ============================================
  // Explain Volume Confirmation (NEW)
  // ============================================
  if (volumeScoreVal !== 0 || volumeAnalysis.volume_spikes.length > 0) {
    if (volumeScoreVal > 0) {
      lines.push(`✅ Volume ยืนยันสัญญาณ (เชื่อมั่น ${volumeAnalysis.confidence}%)`);
      lines.push(`   → หมายความว่า: ปริมาณการซื้อขายสอดคล้องกับทิศทางของสัญญาณ`);
      lines.push(`   → Volume PCR: ${volumeAnalysis.volume_pcr.toFixed(2)} | ${volumeAnalysis.description}`);
    } else if (volumeScoreVal < 0) {
      lines.push(`⚠️ Volume ขัดแย้งกับสัญญาณ (ระวัง!)`);
      lines.push(`   → หมายความว่า: ปริมาณการซื้อขายไม่สอดคล้องกับทิศทางของสัญญาณ`);
      lines.push(`   → Volume PCR: ${volumeAnalysis.volume_pcr.toFixed(2)} | ${volumeAnalysis.description}`);
      lines.push(`   → ควรรอการยืนยันเพิ่มเติมก่อนเข้าเทรด`);
    }

    // Show volume spikes if any
    if (volumeAnalysis.volume_spikes.length > 0) {
      const topSpikes = volumeAnalysis.volume_spikes.slice(0, 3);
      const spikeStrikes = topSpikes.map(s => {
        const type = s.is_call_dominant ? 'Call' : 'Put';
        return `${s.strike} (${type}, ${s.volume_ratio.toFixed(1)}x)`;
      }).join(', ');
      lines.push(`   → Volume Spikes ที่สำคัญ: ${spikeStrikes}`);
    }
    lines.push("");
  }

  // ============================================
  // Key Levels Summary
  // ============================================
  lines.push("📍 ระดับราคาสำคัญ:");
  lines.push(`   • แนวรับหลัก (Put Wall): ${walls.support.strike} - ถ้าราคาลงมาถึงนี่ มักเด้งขึ้น`);
  lines.push(`   • แนวต้านหลัก (Call Wall): ${walls.resistance.strike} - ถ้าราคาขึ้นมาถึงนี่ มักถูกกดลง`);
  lines.push(`   • Max Pain: ${maxPain.max_pain_strike} - ราคามักถูกดึงเข้าหาจุดนี้ใกล้หมดอายุ`);
  lines.push("");

  // ============================================
  // Confidence Explanation
  // ============================================
  lines.push("💡 ความมั่นใจในสัญญาณ:");
  if (score >= 70 || score <= 30) {
    lines.push(`   คะแนน ${score}/100 = ความมั่นใจสูง เพราะหลายปัจจัยชี้ไปทางเดียวกัน`);
  } else if (score >= 55 || score <= 45) {
    lines.push(`   คะแนน ${score}/100 = ความมั่นใจปานกลาง มีบางปัจจัยขัดแย้งกัน`);
  } else {
    lines.push(`   คะแนน ${score}/100 = ความมั่นใจต่ำ ปัจจัยค่อนข้างสมดุล รอความชัดเจน`);
  }

  // ============================================
  // Trading Suggestion
  // ============================================
  lines.push("");
  lines.push("🎯 คำแนะนำ:");
  if (signal === "BUY" && score >= 60) {
    lines.push(`   พิจารณาเปิดสถานะ "ซื้อ" ได้ โดยตั้ง Stop Loss ใต้แนวรับ ${walls.support.strike}`);
    lines.push(`   เป้าหมายแรกอยู่ที่ ${walls.resistance.strike} (แนวต้าน) หรือ ${maxPain.max_pain_strike} (Max Pain)`);
  } else if (signal === "SELL" && score <= 40) {
    lines.push(`   พิจารณาเปิดสถานะ "ขาย" ได้ โดยตั้ง Stop Loss เหนือแนวต้าน ${walls.resistance.strike}`);
    lines.push(`   เป้าหมายแรกอยู่ที่ ${walls.support.strike} (แนวรับ) หรือ ${maxPain.max_pain_strike} (Max Pain)`);
  } else {
    lines.push(`   รอความชัดเจนก่อน ยังไม่ควรเข้าเทรดในตอนนี้`);
    lines.push(`   รอดูว่าราคาจะทะลุ ${walls.resistance.strike} (ขาขึ้น) หรือหลุด ${walls.support.strike} (ขาลง)`);
  }

  return lines.join("\n");
}

// ============================================
// Utility Functions
// ============================================

/**
 * Convert database format to OptionStrike format
 */
export function toOptionStrike(dbData: {
  strike: number;
  putOi?: number | null;
  callOi?: number | null;
  putVol?: number | null;
  callVol?: number | null;
  putChange?: number | null;
  callChange?: number | null;
}): OptionStrike {
  return {
    strike_price: dbData.strike,
    put_oi: dbData.putOi || 0,
    call_oi: dbData.callOi || 0,
    put_volume: dbData.putVol || 0,
    call_volume: dbData.callVol || 0,
    put_oi_change: dbData.putChange || 0,
    call_oi_change: dbData.callChange || 0,
  };
}

/**
 * Calculate VWAP from volume data
 */
export function calculateVWAP(data: OptionStrike[]): number {
  let volumeWeightedSum = 0;
  let totalVolume = 0;

  for (const strike of data) {
    const volume = strike.put_volume + strike.call_volume;
    volumeWeightedSum += strike.strike_price * volume;
    totalVolume += volume;
  }

  return totalVolume > 0 ? volumeWeightedSum / totalVolume : 0;
}

/**
 * Quick analysis - runs all analyses and returns summary
 */
export function quickAnalysis(
  strikes: OptionStrike[],
  currentPrice: number
): {
  walls: LiquidityWalls;
  pcr: PCRResult;
  maxPain: MaxPainResult;
  vwap: number;
  signal: TradingSignal;
} {
  const walls = getLiquidityWalls(strikes);
  const pcr = calculatePCR(strikes, currentPrice);
  const maxPain = calculateMaxPain(strikes, currentPrice);
  const vwap = calculateVWAP(strikes);

  const market: MarketData = {
    current_price: currentPrice,
    vwap,
    strikes,
  };

  const signal = generateSignal(market);

  return {
    walls,
    pcr,
    maxPain,
    vwap,
    signal,
  };
}

// ============================================
// Factor Generation System
// ============================================

/**
 * Factor type enumeration
 */
export type FactorType = 
  | "PCR_BULLISH" | "PCR_BEARISH" | "PCR_NEUTRAL"
  | "VWAP_ABOVE" | "VWAP_BELOW" | "VWAP_NEUTRAL"
  | "FLOW_CALL" | "FLOW_PUT" | "FLOW_NEUTRAL"
  | "WALL_SUPPORT" | "WALL_RESISTANCE" | "WALL_BREAKOUT" | "WALL_BREAKDOWN" | "WALL_NEUTRAL"
  | "MAXPAIN_BELOW" | "MAXPAIN_ABOVE" | "MAXPAIN_NEUTRAL"
  | "VOLUME_SPIKE" | "OI_BUILDUP" | "OI_UNWINDING";

/**
 * Factor with bilingual text
 */
export interface Factor {
  type: FactorType;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  score: number;
  thai: {
    short: string;
    long: string;
    explanation: string;
  };
  english: {
    short: string;
    long: string;
    explanation: string;
  };
  values?: Record<string, number | string>;
}

/**
 * Market conditions input for factor generation
 */
export interface MarketConditions {
  current_price: number;
  vwap: number;
  pcr: PCRResult;
  maxPain: MaxPainResult;
  walls: LiquidityWalls;
  netCallOiChange: number;
  netPutOiChange: number;
  volumeSpikes?: number[];
}

/**
 * Generate all factors based on market conditions
 * This is the main helper function for translating conditions into human-readable strings
 */
export function generateFactors(conditions: MarketConditions): Factor[] {
  const factors: Factor[] = [];
  const {
    current_price,
    vwap,
    pcr,
    maxPain,
    walls,
    netCallOiChange,
    netPutOiChange,
    volumeSpikes = [],
  } = conditions;

  // ============================================
  // 1. PCR Factor
  // ============================================
  const pcrFactor = generatePCRFactor(pcr.volume_pcr);
  if (pcrFactor) factors.push(pcrFactor);

  // ============================================
  // 2. VWAP Factor
  // ============================================
  const vwapFactor = generateVWAPFactor(current_price, vwap);
  if (vwapFactor) factors.push(vwapFactor);

  // ============================================
  // 3. OI Flow Factor
  // ============================================
  const flowFactor = generateFlowFactor(netCallOiChange, netPutOiChange);
  if (flowFactor) factors.push(flowFactor);

  // ============================================
  // 4. Wall Interaction Factor
  // ============================================
  const wallFactor = generateWallFactor(current_price, walls);
  if (wallFactor) factors.push(wallFactor);

  // ============================================
  // 5. Max Pain Factor
  // ============================================
  const maxPainFactor = generateMaxPainFactor(current_price, maxPain);
  if (maxPainFactor) factors.push(maxPainFactor);

  // ============================================
  // 6. Volume Spike Factor
  // ============================================
  if (volumeSpikes.length > 0) {
    const spikeFactor = generateVolumeSpikesFactor(volumeSpikes, current_price);
    if (spikeFactor) factors.push(spikeFactor);
  }

  return factors;
}

/**
 * Generate PCR factor
 */
function generatePCRFactor(volumePcr: number): Factor | null {
  if (volumePcr < 0.6) {
    return {
      type: "PCR_BULLISH",
      sentiment: "BULLISH",
      score: 10,
      thai: {
        short: `PCR ต่ำมาก (${volumePcr.toFixed(2)})`,
        long: `PCR ต่ำมาก (${volumePcr.toFixed(2)}) = นักลงทุนซื้อ Call มากกว่า Put อย่างชัดเจน`,
        explanation: `Put/Call Ratio อยู่ที่ ${volumePcr.toFixed(2)} ซึ่งต่ำมาก หมายความว่านักลงทุนส่วนใหญ่กำลังซื้อ Call Option (เดิมพันขาขึ้น) มากกว่า Put Option (เดิมพันขาลง) แสดงถึงความเชื่อมั่นในตลาดขาขึ้น`,
      },
      english: {
        short: `Very Low PCR (${volumePcr.toFixed(2)})`,
        long: `Very Low PCR (${volumePcr.toFixed(2)}) = Investors buying Calls over Puts significantly`,
        explanation: `Put/Call Ratio is ${volumePcr.toFixed(2)}, which is very low. This means most investors are buying Call Options (betting on upside) more than Put Options (betting on downside), indicating strong bullish sentiment.`,
      },
      values: { pcr: volumePcr },
    };
  } else if (volumePcr < 0.8) {
    return {
      type: "PCR_BULLISH",
      sentiment: "BULLISH",
      score: 5,
      thai: {
        short: `PCR ค่อนข้างต่ำ (${volumePcr.toFixed(2)})`,
        long: `PCR ค่อนข้างต่ำ (${volumePcr.toFixed(2)}) = มีแนวโน้ม Bullish`,
        explanation: `Put/Call Ratio อยู่ที่ ${volumePcr.toFixed(2)} ต่ำกว่าระดับกลาง แสดงว่ามีความต้องการ Call มากกว่า Put เล็กน้อย เป็นสัญญาณ Bullish เบาๆ`,
      },
      english: {
        short: `Low PCR (${volumePcr.toFixed(2)})`,
        long: `Low PCR (${volumePcr.toFixed(2)}) = Mild Bullish Sentiment`,
        explanation: `Put/Call Ratio at ${volumePcr.toFixed(2)} is below neutral, showing slightly more demand for Calls than Puts - a mild bullish signal.`,
      },
      values: { pcr: volumePcr },
    };
  } else if (volumePcr > 1.2) {
    return {
      type: "PCR_BEARISH",
      sentiment: "BEARISH",
      score: -10,
      thai: {
        short: `PCR สูงมาก (${volumePcr.toFixed(2)})`,
        long: `PCR สูงมาก (${volumePcr.toFixed(2)}) = นักลงทุนซื้อ Put มากกว่า Call อย่างชัดเจน`,
        explanation: `Put/Call Ratio อยู่ที่ ${volumePcr.toFixed(2)} ซึ่งสูงมาก หมายความว่านักลงทุนกำลังซื้อ Put Option (ป้องกันความเสี่ยงหรือเดิมพันขาลง) มากกว่า Call แสดงถึงความกังวลในตลาด`,
      },
      english: {
        short: `Very High PCR (${volumePcr.toFixed(2)})`,
        long: `Very High PCR (${volumePcr.toFixed(2)}) = Investors buying Puts over Calls significantly`,
        explanation: `Put/Call Ratio is ${volumePcr.toFixed(2)}, which is very high. This means investors are buying Put Options (hedging or betting on downside) more than Calls, indicating strong bearish sentiment or fear.`,
      },
      values: { pcr: volumePcr },
    };
  } else if (volumePcr > 1.0) {
    return {
      type: "PCR_BEARISH",
      sentiment: "BEARISH",
      score: -5,
      thai: {
        short: `PCR ค่อนข้างสูง (${volumePcr.toFixed(2)})`,
        long: `PCR ค่อนข้างสูง (${volumePcr.toFixed(2)}) = มีแนวโน้ม Bearish`,
        explanation: `Put/Call Ratio อยู่ที่ ${volumePcr.toFixed(2)} สูงกว่าระดับกลาง แสดงว่ามีความต้องการ Put มากกว่า Call เล็กน้อย เป็นสัญญาณ Bearish เบาๆ`,
      },
      english: {
        short: `High PCR (${volumePcr.toFixed(2)})`,
        long: `High PCR (${volumePcr.toFixed(2)}) = Mild Bearish Sentiment`,
        explanation: `Put/Call Ratio at ${volumePcr.toFixed(2)} is above neutral, showing slightly more demand for Puts than Calls - a mild bearish signal.`,
      },
      values: { pcr: volumePcr },
    };
  }

  return {
    type: "PCR_NEUTRAL",
    sentiment: "NEUTRAL",
    score: 0,
    thai: {
      short: `PCR ปกติ (${volumePcr.toFixed(2)})`,
      long: `PCR อยู่ในระดับปกติ (${volumePcr.toFixed(2)})`,
      explanation: `Put/Call Ratio อยู่ที่ ${volumePcr.toFixed(2)} ซึ่งอยู่ในช่วงปกติ (0.8-1.0) แสดงว่าความต้องการ Put และ Call ค่อนข้างสมดุลกัน`,
    },
    english: {
      short: `Neutral PCR (${volumePcr.toFixed(2)})`,
      long: `PCR at Neutral Level (${volumePcr.toFixed(2)})`,
      explanation: `Put/Call Ratio at ${volumePcr.toFixed(2)} is in normal range (0.8-1.0), indicating balanced demand for Puts and Calls.`,
    },
    values: { pcr: volumePcr },
  };
}

/**
 * Generate VWAP factor
 */
function generateVWAPFactor(price: number, vwap: number): Factor | null {
  if (price <= 0 || vwap <= 0) return null;

  const diff = ((price - vwap) / vwap) * 100;
  const diffStr = diff > 0 ? `+${diff.toFixed(2)}%` : `${diff.toFixed(2)}%`;

  if (price > vwap) {
    return {
      type: "VWAP_ABOVE",
      sentiment: "BULLISH",
      score: 15,
      thai: {
        short: `ราคาเหนือ VWAP (${diffStr})`,
        long: `ราคาเหนือ VWAP (${diffStr}) = แรงซื้อเหนือกว่าแรงขาย`,
        explanation: `ราคาปัจจุบัน ${price.toFixed(1)} อยู่เหนือ VWAP (ราคาเฉลี่ยถ่วงน้ำหนักปริมาณ) ที่ ${vwap.toFixed(1)} หมายความว่าผู้ซื้อส่วนใหญ่ในวันนี้ยังมีกำไร มีแรงซื้อมากกว่าแรงขาย`,
      },
      english: {
        short: `Price Above VWAP (${diffStr})`,
        long: `Price Above VWAP (${diffStr}) = Buyers in Control`,
        explanation: `Current price ${price.toFixed(1)} is above VWAP (Volume Weighted Average Price) at ${vwap.toFixed(1)}. This means most buyers today are in profit, indicating buying pressure dominates.`,
      },
      values: { price, vwap, diff },
    };
  } else if (price < vwap) {
    return {
      type: "VWAP_BELOW",
      sentiment: "BEARISH",
      score: -15,
      thai: {
        short: `ราคาใต้ VWAP (${diffStr})`,
        long: `ราคาใต้ VWAP (${diffStr}) = แรงขายเหนือกว่าแรงซื้อ`,
        explanation: `ราคาปัจจุบัน ${price.toFixed(1)} อยู่ใต้ VWAP ที่ ${vwap.toFixed(1)} หมายความว่าผู้ซื้อส่วนใหญ่ในวันนี้ขาดทุน มีแรงขายกดราคาลง`,
      },
      english: {
        short: `Price Below VWAP (${diffStr})`,
        long: `Price Below VWAP (${diffStr}) = Sellers in Control`,
        explanation: `Current price ${price.toFixed(1)} is below VWAP at ${vwap.toFixed(1)}. This means most buyers today are at a loss, indicating selling pressure dominates.`,
      },
      values: { price, vwap, diff },
    };
  }

  return {
    type: "VWAP_NEUTRAL",
    sentiment: "NEUTRAL",
    score: 0,
    thai: {
      short: `ราคาใกล้ VWAP`,
      long: `ราคาอยู่ใกล้ VWAP = ตลาดสมดุล`,
      explanation: `ราคาปัจจุบันอยู่ใกล้เคียงกับ VWAP แสดงว่าแรงซื้อและแรงขายค่อนข้างสมดุลกัน`,
    },
    english: {
      short: `Price at VWAP`,
      long: `Price at VWAP = Market Balanced`,
      explanation: `Current price is near VWAP, indicating balanced buying and selling pressure.`,
    },
    values: { price, vwap, diff: 0 },
  };
}

/**
 * Generate OI Flow factor
 */
function generateFlowFactor(netCallChange: number, netPutChange: number): Factor | null {
  const diff = netCallChange - netPutChange;

  if (netCallChange > netPutChange && netCallChange > 0) {
    return {
      type: "FLOW_CALL",
      sentiment: "BULLISH",
      score: 15,
      thai: {
        short: `เงินไหลเข้า Call (+${diff.toLocaleString()})`,
        long: `เงินไหลเข้า Call มากกว่า Put (+${diff.toLocaleString()}) = Smart Money คาดราคาขึ้น`,
        explanation: `Open Interest ของ Call เพิ่มขึ้น ${netCallChange.toLocaleString()} สัญญา ในขณะที่ Put เพิ่มเพียง ${netPutChange.toLocaleString()} สัญญา แสดงว่านักลงทุนสถาบัน (Smart Money) กำลังวางเดิมพันว่าราคาจะขึ้น`,
      },
      english: {
        short: `Call OI Inflow (+${diff.toLocaleString()})`,
        long: `Call OI Inflow > Put (+${diff.toLocaleString()}) = Smart Money Bullish`,
        explanation: `Call Open Interest increased by ${netCallChange.toLocaleString()} contracts while Put increased only ${netPutChange.toLocaleString()}. This suggests institutional investors (Smart Money) are betting on upside.`,
      },
      values: { callChange: netCallChange, putChange: netPutChange, diff },
    };
  } else if (netPutChange > netCallChange && netPutChange > 0) {
    return {
      type: "FLOW_PUT",
      sentiment: "BEARISH",
      score: -15,
      thai: {
        short: `เงินไหลเข้า Put (+${Math.abs(diff).toLocaleString()})`,
        long: `เงินไหลเข้า Put มากกว่า Call (+${Math.abs(diff).toLocaleString()}) = Smart Money ป้องกัน/ขาลง`,
        explanation: `Open Interest ของ Put เพิ่มขึ้น ${netPutChange.toLocaleString()} สัญญา มากกว่า Call ที่เพิ่ม ${netCallChange.toLocaleString()} สัญญา แสดงว่านักลงทุนสถาบันกำลังป้องกันความเสี่ยง หรือคาดว่าราคาจะลง`,
      },
      english: {
        short: `Put OI Inflow (+${Math.abs(diff).toLocaleString()})`,
        long: `Put OI Inflow > Call (+${Math.abs(diff).toLocaleString()}) = Smart Money Hedging/Bearish`,
        explanation: `Put Open Interest increased by ${netPutChange.toLocaleString()} contracts, more than Call's ${netCallChange.toLocaleString()}. This suggests institutional investors are hedging or betting on downside.`,
      },
      values: { callChange: netCallChange, putChange: netPutChange, diff },
    };
  }

  return {
    type: "FLOW_NEUTRAL",
    sentiment: "NEUTRAL",
    score: 0,
    thai: {
      short: `OI Flow สมดุล`,
      long: `OI Flow สมดุล = ไม่มีทิศทางชัด`,
      explanation: `การเปลี่ยนแปลง Open Interest ของ Call และ Put ค่อนข้างสมดุลกัน ไม่มีสัญญาณชัดเจนว่า Smart Money เลือกฝั่งใด`,
    },
    english: {
      short: `Balanced OI Flow`,
      long: `Balanced OI Flow = No Clear Direction`,
      explanation: `Changes in Call and Put Open Interest are balanced, no clear signal on which side Smart Money is betting.`,
    },
    values: { callChange: netCallChange, putChange: netPutChange, diff: 0 },
  };
}

/**
 * Generate Wall Interaction factor
 */
function generateWallFactor(price: number, walls: LiquidityWalls): Factor | null {
  const supportDistance = price - walls.support.strike;
  const resistanceDistance = walls.resistance.strike - price;
  const priceRange = walls.resistance.strike - walls.support.strike;

  if (priceRange <= 0) return null;

  const supportProximityPct = (supportDistance / priceRange) * 100;
  const resistanceProximityPct = (resistanceDistance / priceRange) * 100;

  // Breakout above resistance
  if (price > walls.resistance.strike) {
    return {
      type: "WALL_BREAKOUT",
      sentiment: "BULLISH",
      score: 25,
      thai: {
        short: `Breakout! ทะลุแนวต้าน ${walls.resistance.strike}`,
        long: `ราคาทะลุแนวต้านหลัก ${walls.resistance.strike} = Breakout ขาขึ้น!`,
        explanation: `ราคา ${price.toFixed(1)} ทะลุผ่านแนวต้าน (Call Wall) ที่ ${walls.resistance.strike} ไปแล้ว! เป็นสัญญาณ Breakout ที่แข็งแกร่ง เพราะ Short Sellers ต้อง Cover ทำให้แรงซื้อเพิ่มขึ้น`,
      },
      english: {
        short: `Breakout! Above Resistance ${walls.resistance.strike}`,
        long: `Price Broke Above Key Resistance ${walls.resistance.strike} = Bullish Breakout!`,
        explanation: `Price ${price.toFixed(1)} has broken above the Call Wall (resistance) at ${walls.resistance.strike}! This is a strong breakout signal as short sellers must cover, adding buying pressure.`,
      },
      values: { price, resistance: walls.resistance.strike, support: walls.support.strike },
    };
  }

  // Breakdown below support
  if (price < walls.support.strike) {
    return {
      type: "WALL_BREAKDOWN",
      sentiment: "BEARISH",
      score: -25,
      thai: {
        short: `Breakdown! หลุดแนวรับ ${walls.support.strike}`,
        long: `ราคาหลุดแนวรับหลัก ${walls.support.strike} = Breakdown ขาลง!`,
        explanation: `ราคา ${price.toFixed(1)} หลุดต่ำกว่าแนวรับ (Put Wall) ที่ ${walls.support.strike} ไปแล้ว! เป็นสัญญาณ Breakdown ที่รุนแรง เพราะ Stop Loss ถูก Trigger ทำให้แรงขายเพิ่มขึ้น`,
      },
      english: {
        short: `Breakdown! Below Support ${walls.support.strike}`,
        long: `Price Broke Below Key Support ${walls.support.strike} = Bearish Breakdown!`,
        explanation: `Price ${price.toFixed(1)} has broken below the Put Wall (support) at ${walls.support.strike}! This is a severe breakdown signal as stop losses are triggered, adding selling pressure.`,
      },
      values: { price, resistance: walls.resistance.strike, support: walls.support.strike },
    };
  }

  // Near Put Wall (Support) - within 20%
  if (supportProximityPct >= 0 && supportProximityPct < 20) {
    return {
      type: "WALL_SUPPORT",
      sentiment: "BULLISH",
      score: 20,
      thai: {
        short: `ใกล้แนวรับ ${walls.support.strike} (Bounce Zone)`,
        long: `ราคาใกล้แนวรับหลัก ${walls.support.strike} = คาดเด้งขึ้น`,
        explanation: `ราคา ${price.toFixed(1)} อยู่ใกล้แนวรับ (Put Wall) ที่ ${walls.support.strike} ซึ่งมี Put OI สูงถึง ${walls.support.put_oi.toLocaleString()} สัญญา คนขาย Put จะพยายามไม่ให้ราคาหลุด เพราะจะขาดทุน จึงมักมีแรงซื้อเข้ามาดันราคา`,
      },
      english: {
        short: `Near Support ${walls.support.strike} (Bounce Zone)`,
        long: `Price Near Key Support ${walls.support.strike} = Bounce Expected`,
        explanation: `Price ${price.toFixed(1)} is near the Put Wall (support) at ${walls.support.strike} with ${walls.support.put_oi.toLocaleString()} Put OI. Put sellers will defend this level to avoid losses, often creating buying pressure for a bounce.`,
      },
      values: { price, support: walls.support.strike, putOi: walls.support.put_oi, proximity: supportProximityPct },
    };
  }

  // Near Call Wall (Resistance) - within 20%
  if (resistanceProximityPct >= 0 && resistanceProximityPct < 20) {
    return {
      type: "WALL_RESISTANCE",
      sentiment: "BEARISH",
      score: -20,
      thai: {
        short: `ใกล้แนวต้าน ${walls.resistance.strike} (Rejection Zone)`,
        long: `ราคาใกล้แนวต้านหลัก ${walls.resistance.strike} = คาดถูกกดลง`,
        explanation: `ราคา ${price.toFixed(1)} อยู่ใกล้แนวต้าน (Call Wall) ที่ ${walls.resistance.strike} ซึ่งมี Call OI สูงถึง ${walls.resistance.call_oi.toLocaleString()} สัญญา คนขาย Call จะพยายามกดราคาไม่ให้ทะลุ เพราะจะขาดทุน จึงมักมีแรงขายเข้ามากด`,
      },
      english: {
        short: `Near Resistance ${walls.resistance.strike} (Rejection Zone)`,
        long: `Price Near Key Resistance ${walls.resistance.strike} = Rejection Expected`,
        explanation: `Price ${price.toFixed(1)} is near the Call Wall (resistance) at ${walls.resistance.strike} with ${walls.resistance.call_oi.toLocaleString()} Call OI. Call sellers will defend this level to avoid losses, often creating selling pressure for rejection.`,
      },
      values: { price, resistance: walls.resistance.strike, callOi: walls.resistance.call_oi, proximity: resistanceProximityPct },
    };
  }

  return {
    type: "WALL_NEUTRAL",
    sentiment: "NEUTRAL",
    score: 0,
    thai: {
      short: `อยู่กลางช่วง ${walls.support.strike}-${walls.resistance.strike}`,
      long: `ราคาอยู่กลางช่วง ${walls.support.strike}-${walls.resistance.strike} = ไม่มีแรงกดดัน`,
      explanation: `ราคาปัจจุบันอยู่ตรงกลางระหว่างแนวรับ ${walls.support.strike} และแนวต้าน ${walls.resistance.strike} ไม่มีแรงกดดันจาก Option Wall ที่ชัดเจน`,
    },
    english: {
      short: `Mid-Range ${walls.support.strike}-${walls.resistance.strike}`,
      long: `Price in Mid-Range ${walls.support.strike}-${walls.resistance.strike} = No Pressure`,
      explanation: `Current price is in the middle between support ${walls.support.strike} and resistance ${walls.resistance.strike}, no clear Option Wall pressure.`,
    },
    values: { price, support: walls.support.strike, resistance: walls.resistance.strike },
  };
}

/**
 * Generate Max Pain factor
 */
function generateMaxPainFactor(price: number, maxPain: MaxPainResult): Factor | null {
  const distPct = maxPain.distance_percent;

  // Price far below Max Pain (Gravity pulls up)
  if (distPct > 2) {
    return {
      type: "MAXPAIN_BELOW",
      sentiment: "BULLISH",
      score: 10,
      thai: {
        short: `ราคาต่ำกว่า Max Pain (${distPct.toFixed(1)}%)`,
        long: `ราคาต่ำกว่า Max Pain ${maxPain.max_pain_strike} อยู่ ${distPct.toFixed(1)}% = แรงดึงขึ้น`,
        explanation: `Max Pain (จุดที่คนซื้อ Option ขาดทุนมากที่สุด) อยู่ที่ ${maxPain.max_pain_strike} ซึ่งสูงกว่าราคาปัจจุบัน ${distPct.toFixed(1)}% Market Maker มักจะ "ดึง" ราคาเข้าหา Max Pain เหมือนแรงโน้มถ่วง จึงคาดว่าราคาจะถูกดึงขึ้น`,
      },
      english: {
        short: `Price Below Max Pain (${distPct.toFixed(1)}%)`,
        long: `Price ${distPct.toFixed(1)}% Below Max Pain ${maxPain.max_pain_strike} = Gravity Effect (Upward Pull)`,
        explanation: `Max Pain (strike where option buyers lose the most) is at ${maxPain.max_pain_strike}, ${distPct.toFixed(1)}% above current price. Market Makers tend to "pull" price toward Max Pain like gravity, expecting upward movement.`,
      },
      values: { price, maxPain: maxPain.max_pain_strike, distancePercent: distPct },
    };
  }

  // Price far above Max Pain (Gravity pulls down)
  if (distPct < -2) {
    return {
      type: "MAXPAIN_ABOVE",
      sentiment: "BEARISH",
      score: -10,
      thai: {
        short: `ราคาสูงกว่า Max Pain (${Math.abs(distPct).toFixed(1)}%)`,
        long: `ราคาสูงกว่า Max Pain ${maxPain.max_pain_strike} อยู่ ${Math.abs(distPct).toFixed(1)}% = แรงดึงลง`,
        explanation: `Max Pain อยู่ที่ ${maxPain.max_pain_strike} ซึ่งต่ำกว่าราคาปัจจุบัน ${Math.abs(distPct).toFixed(1)}% Market Maker มักจะ "ดึง" ราคาลงมาหา Max Pain จึงคาดว่าราคาจะถูกดึงลง`,
      },
      english: {
        short: `Price Above Max Pain (${Math.abs(distPct).toFixed(1)}%)`,
        long: `Price ${Math.abs(distPct).toFixed(1)}% Above Max Pain ${maxPain.max_pain_strike} = Gravity Effect (Downward Pull)`,
        explanation: `Max Pain is at ${maxPain.max_pain_strike}, ${Math.abs(distPct).toFixed(1)}% below current price. Market Makers tend to "pull" price toward Max Pain, expecting downward movement.`,
      },
      values: { price, maxPain: maxPain.max_pain_strike, distancePercent: distPct },
    };
  }

  return {
    type: "MAXPAIN_NEUTRAL",
    sentiment: "NEUTRAL",
    score: 0,
    thai: {
      short: `ราคาใกล้ Max Pain (${distPct.toFixed(1)}%)`,
      long: `ราคาใกล้ Max Pain ${maxPain.max_pain_strike} = คาด Sideways`,
      explanation: `ราคาปัจจุบันอยู่ใกล้ Max Pain ที่ ${maxPain.max_pain_strike} (ห่างเพียง ${Math.abs(distPct).toFixed(1)}%) ราคามักจะ Sideways อยู่ใกล้ Max Pain ใกล้วันหมดอายุ`,
    },
    english: {
      short: `Price Near Max Pain (${distPct.toFixed(1)}%)`,
      long: `Price Near Max Pain ${maxPain.max_pain_strike} = Sideways Expected`,
      explanation: `Current price is near Max Pain at ${maxPain.max_pain_strike} (only ${Math.abs(distPct).toFixed(1)}% away). Price tends to stay sideways near Max Pain as expiration approaches.`,
    },
    values: { price, maxPain: maxPain.max_pain_strike, distancePercent: distPct },
  };
}

/**
 * Generate Volume Spikes factor
 */
function generateVolumeSpikesFactor(spikes: number[], price: number): Factor | null {
  if (spikes.length === 0) return null;

  const nearSpikes = spikes.filter(s => Math.abs(s - price) / price < 0.02);
  const aboveSpikes = spikes.filter(s => s > price);
  const belowSpikes = spikes.filter(s => s < price);

  return {
    type: "VOLUME_SPIKE",
    sentiment: nearSpikes.length > 0 ? "NEUTRAL" : aboveSpikes.length > belowSpikes.length ? "BEARISH" : "BULLISH",
    score: 0,
    thai: {
      short: `Volume สูงผิดปกติที่ ${spikes.slice(0, 3).join(", ")}`,
      long: `พบ Volume สูงผิดปกติที่ Strike ${spikes.slice(0, 5).join(", ")}`,
      explanation: `มี Strike ที่มีปริมาณการซื้อขายสูงผิดปกติ (มากกว่า 2 เท่าของค่าเฉลี่ย) ได้แก่ ${spikes.join(", ")} ซึ่งมักเป็นจุดที่นักลงทุนสถาบันให้ความสนใจ อาจเป็นแนวรับ/แนวต้านที่สำคัญ`,
    },
    english: {
      short: `Volume Spikes at ${spikes.slice(0, 3).join(", ")}`,
      long: `Unusual Volume Spikes at Strikes ${spikes.slice(0, 5).join(", ")}`,
      explanation: `There are strikes with unusually high volume (>2x average): ${spikes.join(", ")}. These often indicate institutional interest and may act as key support/resistance levels.`,
    },
    values: { spikes, count: spikes.length },
  };
}

/**
 * Get factors as simple string array (for backward compatibility)
 */
export function getFactorStrings(
  factors: Factor[], 
  lang: "thai" | "english" = "thai",
  format: "short" | "long" | "explanation" = "long"
): { positive: string[]; negative: string[]; neutral: string[] } {
  const positive: string[] = [];
  const negative: string[] = [];
  const neutral: string[] = [];

  for (const factor of factors) {
    const text = lang === "thai" ? factor.thai[format] : factor.english[format];
    
    if (factor.sentiment === "BULLISH") {
      positive.push(text);
    } else if (factor.sentiment === "BEARISH") {
      negative.push(text);
    } else {
      neutral.push(text);
    }
  }

  return { positive, negative, neutral };
}

/**
 * Calculate total score from factors
 */
export function calculateFactorScore(factors: Factor[]): number {
  const baseScore = 50;
  const factorSum = factors.reduce((sum, f) => sum + f.score, 0);
  return Math.max(0, Math.min(100, baseScore + factorSum));
}
