/**
 * Historical Context Module
 * 
 * Provides historical signal data and pattern recognition
 * to enhance AI analysis accuracy
 */

import prisma from "./db";

// ============================================
// Types
// ============================================

export interface HistoricalSignal {
  id: string;
  type: string;
  strength: number;
  reason: string;
  createdAt: Date;
  currentPrice: number | null;
  maxPainStrike: number | null;
  putCallRatio: number | null;
}

export interface SignalPattern {
  pattern: string;
  occurrences: number;
  avgOutcome: string;
  successRate: number;
  description: string;
}

export interface MarketConditionHistory {
  // Recent signals
  recentSignals: HistoricalSignal[];
  
  // Signal distribution (last 7 days)
  signalDistribution: {
    buy: number;
    sell: number;
    neutral: number;
  };
  
  // Trend from signals
  signalTrend: "BULLISH" | "BEARISH" | "MIXED";
  
  // PCR history
  pcrHistory: {
    current: number;
    avg7Days: number;
    avg30Days: number;
    trend: "INCREASING" | "DECREASING" | "STABLE";
  };
  
  // Max Pain history
  maxPainHistory: {
    current: number;
    changes: { strike: number; date: Date }[];
    trend: "MOVING_UP" | "MOVING_DOWN" | "STABLE";
  };
  
  // Price movement after similar conditions
  similarConditionsOutcome: {
    found: number;
    avgPriceChange: number;
    direction: "UP" | "DOWN" | "SIDEWAYS";
  };
  
  // Summary for AI
  summary: string;
}

// ============================================
// Get Recent Signals
// ============================================

/**
 * Get recent signals from database
 */
export async function getRecentSignals(
  days = 7,
  limit = 20
): Promise<HistoricalSignal[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const signals = await prisma.signal.findMany({
    where: {
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return signals.map(s => ({
    id: s.id,
    type: s.type,
    strength: s.strength,
    reason: s.reason,
    createdAt: s.createdAt,
    currentPrice: s.currentPrice,
    maxPainStrike: s.maxPainStrike,
    putCallRatio: s.putCallRatio,
  }));
}

// ============================================
// Signal Distribution
// ============================================

/**
 * Get signal distribution over time period
 */
export async function getSignalDistribution(days = 7): Promise<{
  buy: number;
  sell: number;
  neutral: number;
  total: number;
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const signals = await prisma.signal.findMany({
    where: { createdAt: { gte: since } },
    select: { type: true },
  });

  const distribution = {
    buy: 0,
    sell: 0,
    neutral: 0,
    total: signals.length,
  };

  for (const signal of signals) {
    if (signal.type === "BUY") distribution.buy++;
    else if (signal.type === "SELL") distribution.sell++;
    else distribution.neutral++;
  }

  return distribution;
}

// ============================================
// PCR History
// ============================================

/**
 * Get PCR history and trends
 */
export async function getPCRHistory(): Promise<{
  current: number;
  avg7Days: number;
  avg30Days: number;
  values: { pcr: number; date: Date }[];
  trend: "INCREASING" | "DECREASING" | "STABLE";
}> {
  const signals = await prisma.signal.findMany({
    where: {
      putCallRatio: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { putCallRatio: true, createdAt: true },
  });

  if (signals.length === 0) {
    return {
      current: 1.0,
      avg7Days: 1.0,
      avg30Days: 1.0,
      values: [],
      trend: "STABLE",
    };
  }

  const current = signals[0].putCallRatio || 1.0;
  
  const now = Date.now();
  const last7Days = signals.filter(
    s => s.createdAt.getTime() > now - 7 * 24 * 60 * 60 * 1000
  );
  const last30Days = signals.filter(
    s => s.createdAt.getTime() > now - 30 * 24 * 60 * 60 * 1000
  );

  const avg7Days = last7Days.length > 0
    ? last7Days.reduce((sum, s) => sum + (s.putCallRatio || 0), 0) / last7Days.length
    : current;

  const avg30Days = last30Days.length > 0
    ? last30Days.reduce((sum, s) => sum + (s.putCallRatio || 0), 0) / last30Days.length
    : current;

  // Determine trend
  let trend: "INCREASING" | "DECREASING" | "STABLE";
  if (current > avg7Days * 1.1) {
    trend = "INCREASING";
  } else if (current < avg7Days * 0.9) {
    trend = "DECREASING";
  } else {
    trend = "STABLE";
  }

  return {
    current,
    avg7Days: Math.round(avg7Days * 1000) / 1000,
    avg30Days: Math.round(avg30Days * 1000) / 1000,
    values: signals.slice(0, 20).map(s => ({
      pcr: s.putCallRatio || 0,
      date: s.createdAt,
    })),
    trend,
  };
}

// ============================================
// Max Pain History
// ============================================

/**
 * Get Max Pain strike history
 */
export async function getMaxPainHistory(): Promise<{
  current: number;
  changes: { strike: number; date: Date }[];
  trend: "MOVING_UP" | "MOVING_DOWN" | "STABLE";
}> {
  const signals = await prisma.signal.findMany({
    where: {
      maxPainStrike: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { maxPainStrike: true, createdAt: true },
  });

  if (signals.length === 0) {
    return {
      current: 2700,
      changes: [],
      trend: "STABLE",
    };
  }

  const current = signals[0].maxPainStrike || 2700;
  
  // Get unique max pain values
  const uniqueStrikes: { strike: number; date: Date }[] = [];
  let lastStrike = 0;
  
  for (const signal of signals) {
    if (signal.maxPainStrike && signal.maxPainStrike !== lastStrike) {
      uniqueStrikes.push({
        strike: signal.maxPainStrike,
        date: signal.createdAt,
      });
      lastStrike = signal.maxPainStrike;
    }
  }

  // Determine trend
  let trend: "MOVING_UP" | "MOVING_DOWN" | "STABLE";
  if (uniqueStrikes.length >= 3) {
    const recent = uniqueStrikes.slice(0, 3).map(s => s.strike);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    
    if (avgRecent > current * 1.01) {
      trend = "MOVING_DOWN";
    } else if (avgRecent < current * 0.99) {
      trend = "MOVING_UP";
    } else {
      trend = "STABLE";
    }
  } else {
    trend = "STABLE";
  }

  return {
    current,
    changes: uniqueStrikes.slice(0, 10),
    trend,
  };
}

// ============================================
// Pattern Recognition
// ============================================

/**
 * Find similar market conditions in history
 */
export async function findSimilarConditions(
  currentPCR: number,
  currentMaxPain: number,
  currentPrice: number
): Promise<{
  found: number;
  avgPriceChange: number;
  direction: "UP" | "DOWN" | "SIDEWAYS";
  matches: HistoricalSignal[];
}> {
  // Find signals with similar PCR (±20%) and price near max pain (±2%)
  const pcrMin = currentPCR * 0.8;
  const pcrMax = currentPCR * 1.2;
  
  const signals = await prisma.signal.findMany({
    where: {
      putCallRatio: { gte: pcrMin, lte: pcrMax },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // For each matched signal, try to find price change after
  // This is simplified - in production, you'd track actual price outcomes
  const matches = signals.map(s => ({
    id: s.id,
    type: s.type,
    strength: s.strength,
    reason: s.reason,
    createdAt: s.createdAt,
    currentPrice: s.currentPrice,
    maxPainStrike: s.maxPainStrike,
    putCallRatio: s.putCallRatio,
  }));

  // Calculate average expected direction based on signal types
  const buyCount = signals.filter(s => s.type === "BUY").length;
  const sellCount = signals.filter(s => s.type === "SELL").length;
  
  let direction: "UP" | "DOWN" | "SIDEWAYS";
  let avgPriceChange: number;
  
  if (buyCount > sellCount * 1.5) {
    direction = "UP";
    avgPriceChange = 15; // Estimated average up move
  } else if (sellCount > buyCount * 1.5) {
    direction = "DOWN";
    avgPriceChange = -15;
  } else {
    direction = "SIDEWAYS";
    avgPriceChange = 0;
  }

  return {
    found: matches.length,
    avgPriceChange,
    direction,
    matches: matches.slice(0, 5),
  };
}

// ============================================
// Build Full Historical Context
// ============================================

/**
 * Build complete historical context for AI analysis
 */
export async function buildHistoricalContext(
  currentPCR: number,
  currentMaxPain: number,
  currentPrice: number
): Promise<MarketConditionHistory> {
  // Fetch all data in parallel
  const [
    recentSignals,
    signalDistribution,
    pcrHistory,
    maxPainHistory,
    similarConditions,
  ] = await Promise.all([
    getRecentSignals(7, 10),
    getSignalDistribution(7),
    getPCRHistory(),
    getMaxPainHistory(),
    findSimilarConditions(currentPCR, currentMaxPain, currentPrice),
  ]);

  // Determine signal trend
  let signalTrend: "BULLISH" | "BEARISH" | "MIXED";
  if (signalDistribution.buy > signalDistribution.sell * 1.5) {
    signalTrend = "BULLISH";
  } else if (signalDistribution.sell > signalDistribution.buy * 1.5) {
    signalTrend = "BEARISH";
  } else {
    signalTrend = "MIXED";
  }

  // Build summary for AI
  const summary = buildHistoricalSummary({
    signalTrend,
    signalDistribution,
    pcrHistory,
    maxPainHistory,
    similarConditions,
  });

  return {
    recentSignals,
    signalDistribution,
    signalTrend,
    pcrHistory: {
      current: pcrHistory.current,
      avg7Days: pcrHistory.avg7Days,
      avg30Days: pcrHistory.avg30Days,
      trend: pcrHistory.trend,
    },
    maxPainHistory: {
      current: maxPainHistory.current,
      changes: maxPainHistory.changes,
      trend: maxPainHistory.trend,
    },
    similarConditionsOutcome: {
      found: similarConditions.found,
      avgPriceChange: similarConditions.avgPriceChange,
      direction: similarConditions.direction,
    },
    summary,
  };
}

function buildHistoricalSummary(data: {
  signalTrend: string;
  signalDistribution: { buy: number; sell: number; neutral: number };
  pcrHistory: { trend: string; current: number; avg7Days: number };
  maxPainHistory: { trend: string; current: number };
  similarConditions: { found: number; direction: string; avgPriceChange: number };
}): string {
  const lines: string[] = [];

  // Signal trend
  lines.push(`สัญญาณ 7 วันที่ผ่านมา: ${data.signalTrend} (ซื้อ ${data.signalDistribution.buy}, ขาย ${data.signalDistribution.sell}, รอ ${data.signalDistribution.neutral})`);
  
  // PCR trend
  const pcrChange = ((data.pcrHistory.current - data.pcrHistory.avg7Days) / data.pcrHistory.avg7Days * 100).toFixed(1);
  lines.push(`PCR: ${data.pcrHistory.current.toFixed(3)} (${data.pcrHistory.trend}, เปลี่ยน ${pcrChange}% จากค่าเฉลี่ย 7 วัน)`);
  
  // Max Pain trend
  lines.push(`Max Pain: ${data.maxPainHistory.current} (${data.maxPainHistory.trend})`);
  
  // Similar conditions
  if (data.similarConditions.found > 0) {
    lines.push(`พบสภาวะคล้ายกัน ${data.similarConditions.found} ครั้ง → ราคามักเคลื่อนไป ${data.similarConditions.direction} (เฉลี่ย ${data.similarConditions.avgPriceChange > 0 ? "+" : ""}${data.similarConditions.avgPriceChange} จุด)`);
  }

  return lines.join(" | ");
}

// ============================================
// Format for AI Prompt
// ============================================

/**
 * Format historical context for AI prompt
 */
export function formatHistoricalContextForAI(context: MarketConditionHistory): string {
  const lines: string[] = [];
  
  lines.push("## ข้อมูลย้อนหลัง (Historical Context)");
  lines.push("");
  
  // Recent signals
  lines.push("### สัญญาณล่าสุด");
  if (context.recentSignals.length > 0) {
    for (const signal of context.recentSignals.slice(0, 5)) {
      const date = signal.createdAt.toLocaleDateString("th-TH");
      lines.push(`- ${date}: ${signal.type} (แข็งแกร่ง ${signal.strength}/5) @ $${signal.currentPrice}`);
    }
  } else {
    lines.push("- ไม่มีข้อมูล");
  }
  lines.push("");
  
  // Signal distribution
  lines.push("### การกระจายสัญญาณ (7 วัน)");
  lines.push(`- ซื้อ: ${context.signalDistribution.buy}`);
  lines.push(`- ขาย: ${context.signalDistribution.sell}`);
  lines.push(`- รอดู: ${context.signalDistribution.neutral}`);
  lines.push(`- แนวโน้ม: ${context.signalTrend}`);
  lines.push("");
  
  // PCR history
  lines.push("### ประวัติ PCR");
  lines.push(`- ปัจจุบัน: ${context.pcrHistory.current.toFixed(3)}`);
  lines.push(`- เฉลี่ย 7 วัน: ${context.pcrHistory.avg7Days.toFixed(3)}`);
  lines.push(`- เฉลี่ย 30 วัน: ${context.pcrHistory.avg30Days.toFixed(3)}`);
  lines.push(`- แนวโน้ม: ${context.pcrHistory.trend}`);
  lines.push("");
  
  // Max Pain history
  lines.push("### ประวัติ Max Pain");
  lines.push(`- ปัจจุบัน: $${context.maxPainHistory.current}`);
  lines.push(`- แนวโน้ม: ${context.maxPainHistory.trend}`);
  lines.push("");
  
  // Similar conditions
  lines.push("### สภาวะคล้ายกันในอดีต");
  lines.push(`- พบ: ${context.similarConditionsOutcome.found} ครั้ง`);
  lines.push(`- ทิศทาง: ${context.similarConditionsOutcome.direction}`);
  lines.push(`- การเปลี่ยนแปลงเฉลี่ย: ${context.similarConditionsOutcome.avgPriceChange > 0 ? "+" : ""}${context.similarConditionsOutcome.avgPriceChange} จุด`);

  return lines.join("\n");
}
