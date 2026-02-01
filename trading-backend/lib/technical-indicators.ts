/**
 * Technical Indicators Module
 * 
 * Calculates RSI, Moving Averages, ATR, and Support/Resistance levels
 * for enhanced AI analysis
 */

// ============================================
// Types
// ============================================

export interface OHLC {
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: Date;
}

export interface TechnicalIndicators {
  // RSI
  rsi: number;
  rsi_signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  
  // Moving Averages
  ma20: number;
  ma50: number;
  ma200: number;
  ma_trend: "BULLISH" | "BEARISH" | "SIDEWAYS";
  price_vs_ma: {
    above_ma20: boolean;
    above_ma50: boolean;
    above_ma200: boolean;
  };
  
  // ATR (Average True Range)
  atr: number;
  atr_percent: number;
  volatility: "HIGH" | "MEDIUM" | "LOW";
  
  // Suggested SL/TP based on ATR
  suggested_sl_distance: number;
  suggested_tp1_distance: number;
  suggested_tp2_distance: number;
  
  // Support/Resistance from price action
  support_levels: number[];
  resistance_levels: number[];
  
  // Trend
  trend: "STRONG_UP" | "UP" | "SIDEWAYS" | "DOWN" | "STRONG_DOWN";
  trend_strength: number; // 0-100
  
  // Summary for AI
  summary: string;
}

// ============================================
// RSI Calculation
// ============================================

/**
 * Calculate RSI (Relative Strength Index)
 * @param prices Array of closing prices (oldest first)
 * @param period RSI period (default 14)
 */
export function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) {
    return 50; // Default to neutral if not enough data
  }

  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  let avgGain = 0;
  let avgLoss = 0;

  // Initial average
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      avgGain += changes[i];
    } else {
      avgLoss += Math.abs(changes[i]);
    }
  }

  avgGain /= period;
  avgLoss /= period;

  // Smoothed average
  for (let i = period; i < changes.length; i++) {
    if (changes[i] > 0) {
      avgGain = (avgGain * (period - 1) + changes[i]) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(changes[i])) / period;
    }
  }

  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return Math.round(rsi * 100) / 100;
}

/**
 * Get RSI signal
 */
export function getRSISignal(rsi: number): "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL" {
  if (rsi >= 70) return "OVERBOUGHT";
  if (rsi <= 30) return "OVERSOLD";
  return "NEUTRAL";
}

// ============================================
// Moving Averages
// ============================================

/**
 * Calculate Simple Moving Average
 */
export function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) {
    return prices[prices.length - 1] || 0;
  }
  
  const slice = prices.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return Math.round((sum / period) * 100) / 100;
}

/**
 * Calculate EMA (Exponential Moving Average)
 */
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) {
    return prices[prices.length - 1] || 0;
  }

  const multiplier = 2 / (period + 1);
  let ema = calculateSMA(prices.slice(0, period), period);

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }

  return Math.round(ema * 100) / 100;
}

/**
 * Determine MA trend
 */
export function getMATrend(
  currentPrice: number,
  ma20: number,
  ma50: number,
  ma200: number
): "BULLISH" | "BEARISH" | "SIDEWAYS" {
  const aboveAll = currentPrice > ma20 && currentPrice > ma50 && currentPrice > ma200;
  const belowAll = currentPrice < ma20 && currentPrice < ma50 && currentPrice < ma200;
  const maAligned = ma20 > ma50 && ma50 > ma200;
  const maReversed = ma20 < ma50 && ma50 < ma200;

  if (aboveAll && maAligned) return "BULLISH";
  if (belowAll && maReversed) return "BEARISH";
  return "SIDEWAYS";
}

// ============================================
// ATR (Average True Range)
// ============================================

/**
 * Calculate ATR
 */
export function calculateATR(ohlcData: OHLC[], period = 14): number {
  if (ohlcData.length < period + 1) {
    // Estimate from last candle
    const last = ohlcData[ohlcData.length - 1];
    return last ? last.high - last.low : 10;
  }

  const trueRanges: number[] = [];
  
  for (let i = 1; i < ohlcData.length; i++) {
    const current = ohlcData[i];
    const previous = ohlcData[i - 1];
    
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );
    
    trueRanges.push(tr);
  }

  // Calculate ATR using Wilder's smoothing
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < trueRanges.length; i++) {
    atr = ((atr * (period - 1)) + trueRanges[i]) / period;
  }

  return Math.round(atr * 100) / 100;
}

/**
 * Get volatility level
 */
export function getVolatilityLevel(atr: number, price: number): "HIGH" | "MEDIUM" | "LOW" {
  const atrPercent = (atr / price) * 100;
  
  if (atrPercent > 1.5) return "HIGH";
  if (atrPercent > 0.8) return "MEDIUM";
  return "LOW";
}

// ============================================
// Support/Resistance
// ============================================

/**
 * Find support and resistance levels from price data
 */
export function findSupportResistance(
  ohlcData: OHLC[],
  currentPrice: number,
  numLevels = 3
): { support: number[]; resistance: number[] } {
  if (ohlcData.length < 5) {
    return {
      support: [currentPrice - 10, currentPrice - 20, currentPrice - 30],
      resistance: [currentPrice + 10, currentPrice + 20, currentPrice + 30],
    };
  }

  // Find swing highs and lows
  const swingHighs: number[] = [];
  const swingLows: number[] = [];

  for (let i = 2; i < ohlcData.length - 2; i++) {
    const prev2 = ohlcData[i - 2];
    const prev1 = ohlcData[i - 1];
    const current = ohlcData[i];
    const next1 = ohlcData[i + 1];
    const next2 = ohlcData[i + 2];

    // Swing high
    if (
      current.high > prev1.high &&
      current.high > prev2.high &&
      current.high > next1.high &&
      current.high > next2.high
    ) {
      swingHighs.push(current.high);
    }

    // Swing low
    if (
      current.low < prev1.low &&
      current.low < prev2.low &&
      current.low < next1.low &&
      current.low < next2.low
    ) {
      swingLows.push(current.low);
    }
  }

  // Sort and filter
  const support = swingLows
    .filter(l => l < currentPrice)
    .sort((a, b) => b - a)
    .slice(0, numLevels);

  const resistance = swingHighs
    .filter(h => h > currentPrice)
    .sort((a, b) => a - b)
    .slice(0, numLevels);

  // Fill with estimates if not enough levels
  while (support.length < numLevels) {
    const last = support[support.length - 1] || currentPrice;
    support.push(Math.round((last - 15) * 100) / 100);
  }

  while (resistance.length < numLevels) {
    const last = resistance[resistance.length - 1] || currentPrice;
    resistance.push(Math.round((last + 15) * 100) / 100);
  }

  return { support, resistance };
}

// ============================================
// Trend Analysis
// ============================================

/**
 * Analyze overall trend
 */
export function analyzeTrend(
  prices: number[],
  ma20: number,
  ma50: number,
  ma200: number
): { trend: TechnicalIndicators["trend"]; strength: number } {
  if (prices.length < 20) {
    return { trend: "SIDEWAYS", strength: 50 };
  }

  const currentPrice = prices[prices.length - 1];
  const priceChange = ((currentPrice - prices[0]) / prices[0]) * 100;
  
  // Count how many MAs price is above
  let maScore = 0;
  if (currentPrice > ma20) maScore += 1;
  if (currentPrice > ma50) maScore += 1;
  if (currentPrice > ma200) maScore += 1;
  
  // Check MA alignment
  let alignmentScore = 0;
  if (ma20 > ma50) alignmentScore += 1;
  if (ma50 > ma200) alignmentScore += 1;

  const totalScore = maScore + alignmentScore; // 0-5

  let trend: TechnicalIndicators["trend"];
  let strength: number;

  if (totalScore >= 5 && priceChange > 2) {
    trend = "STRONG_UP";
    strength = 90;
  } else if (totalScore >= 4) {
    trend = "UP";
    strength = 70;
  } else if (totalScore <= 0 && priceChange < -2) {
    trend = "STRONG_DOWN";
    strength = 90;
  } else if (totalScore <= 1) {
    trend = "DOWN";
    strength = 70;
  } else {
    trend = "SIDEWAYS";
    strength = 50;
  }

  return { trend, strength };
}

// ============================================
// Main Function
// ============================================

/**
 * Calculate all technical indicators
 */
export function calculateTechnicalIndicators(
  ohlcData: OHLC[],
  currentPrice: number
): TechnicalIndicators {
  const closePrices = ohlcData.map(d => d.close);
  
  // RSI
  const rsi = calculateRSI(closePrices);
  const rsi_signal = getRSISignal(rsi);
  
  // Moving Averages
  const ma20 = calculateEMA(closePrices, 20);
  const ma50 = calculateEMA(closePrices, 50);
  const ma200 = calculateSMA(closePrices, 200);
  const ma_trend = getMATrend(currentPrice, ma20, ma50, ma200);
  
  // ATR
  const atr = calculateATR(ohlcData);
  const atr_percent = (atr / currentPrice) * 100;
  const volatility = getVolatilityLevel(atr, currentPrice);
  
  // SL/TP suggestions based on ATR
  const suggested_sl_distance = Math.round(atr * 1.5 * 100) / 100;
  const suggested_tp1_distance = Math.round(atr * 2 * 100) / 100;
  const suggested_tp2_distance = Math.round(atr * 3 * 100) / 100;
  
  // Support/Resistance
  const { support: support_levels, resistance: resistance_levels } = 
    findSupportResistance(ohlcData, currentPrice);
  
  // Trend
  const { trend, strength: trend_strength } = analyzeTrend(closePrices, ma20, ma50, ma200);
  
  // Build summary for AI
  const summary = buildTechnicalSummary({
    rsi,
    rsi_signal,
    ma_trend,
    trend,
    volatility,
    currentPrice,
    ma20,
    ma50,
    ma200,
    support_levels,
    resistance_levels,
  });

  return {
    rsi,
    rsi_signal,
    ma20,
    ma50,
    ma200,
    ma_trend,
    price_vs_ma: {
      above_ma20: currentPrice > ma20,
      above_ma50: currentPrice > ma50,
      above_ma200: currentPrice > ma200,
    },
    atr,
    atr_percent: Math.round(atr_percent * 100) / 100,
    volatility,
    suggested_sl_distance,
    suggested_tp1_distance,
    suggested_tp2_distance,
    support_levels,
    resistance_levels,
    trend,
    trend_strength,
    summary,
  };
}

function buildTechnicalSummary(data: {
  rsi: number;
  rsi_signal: string;
  ma_trend: string;
  trend: string;
  volatility: string;
  currentPrice: number;
  ma20: number;
  ma50: number;
  ma200: number;
  support_levels: number[];
  resistance_levels: number[];
}): string {
  const lines: string[] = [];
  
  // RSI
  if (data.rsi_signal === "OVERBOUGHT") {
    lines.push(`RSI ${data.rsi} (Overbought) - ราคาอาจพักตัวหรือย่อลง`);
  } else if (data.rsi_signal === "OVERSOLD") {
    lines.push(`RSI ${data.rsi} (Oversold) - ราคาอาจเด้งกลับขึ้น`);
  } else {
    lines.push(`RSI ${data.rsi} (Neutral)`);
  }
  
  // MA Trend
  if (data.ma_trend === "BULLISH") {
    lines.push(`MA Trend: Bullish - ราคาอยู่เหนือ MA ทั้งหมด`);
  } else if (data.ma_trend === "BEARISH") {
    lines.push(`MA Trend: Bearish - ราคาอยู่ใต้ MA ทั้งหมด`);
  } else {
    lines.push(`MA Trend: Sideways - ราคาเคลื่อนไหวในกรอบ`);
  }
  
  // Support/Resistance
  lines.push(`แนวรับใกล้สุด: ${data.support_levels[0]}`);
  lines.push(`แนวต้านใกล้สุด: ${data.resistance_levels[0]}`);
  
  // Volatility
  lines.push(`Volatility: ${data.volatility}`);
  
  return lines.join(" | ");
}

// ============================================
// Generate mock OHLC data from CME price
// (In production, fetch from a data provider)
// ============================================

export function generateEstimatedOHLC(
  currentPrice: number,
  numCandles = 200
): OHLC[] {
  const ohlcData: OHLC[] = [];
  let price = currentPrice * 0.95; // Start from 5% below current
  
  for (let i = 0; i < numCandles; i++) {
    const change = (Math.random() - 0.48) * 10; // Slight upward bias
    const volatility = Math.random() * 5 + 2;
    
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    
    ohlcData.push({
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      timestamp: new Date(Date.now() - (numCandles - i) * 60 * 60 * 1000),
    });
    
    price = close;
  }
  
  // Adjust last candle to match current price
  if (ohlcData.length > 0) {
    const last = ohlcData[ohlcData.length - 1];
    last.close = currentPrice;
    last.high = Math.max(last.high, currentPrice);
    last.low = Math.min(last.low, currentPrice);
  }
  
  return ohlcData;
}
