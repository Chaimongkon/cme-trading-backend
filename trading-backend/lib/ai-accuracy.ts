/**
 * AI Accuracy Tracking Module
 * 
 * Tracks AI prediction outcomes to measure and improve accuracy
 */

import prisma from "./db";
import type { AIAnalysisResult } from "./ai-analysis";
import type { ConsensusResult } from "./ai-consensus";

// ============================================
// Types
// ============================================

export interface PredictionRecord {
  id: string;
  provider: string;
  recommendation: string;
  confidence: number;
  entryStart: number;
  entryEnd: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  priceAtPrediction: number;
  outcome?: string;
  createdAt: Date;
}

export interface AccuracyStats {
  provider: string;
  totalPredictions: number;
  winRate: number;
  buyAccuracy: number;
  sellAccuracy: number;
  tp1HitRate: number;
  tp2HitRate: number;
  slHitRate: number;
  avgConfidence: number;
  last7DaysWinRate: number;
  last30DaysWinRate: number;
}

export interface ProviderComparison {
  providers: AccuracyStats[];
  bestProvider: string;
  recommendation: string;
}

// ============================================
// Save Prediction
// ============================================

/**
 * Save an AI prediction for accuracy tracking
 */
export async function savePrediction(
  prediction: AIAnalysisResult,
  provider: string,
  currentPrice: number,
  product: string
): Promise<string> {
  const record = await prisma.aIPrediction.create({
    data: {
      provider,
      model: prediction.model,
      recommendation: prediction.recommendation,
      confidence: prediction.confidence,
      entryStart: prediction.entry_zone.start,
      entryEnd: prediction.entry_zone.end,
      stopLoss: prediction.stop_loss,
      takeProfit1: prediction.take_profit_1,
      takeProfit2: prediction.take_profit_2,
      takeProfit3: prediction.take_profit_3,
      priceAtPrediction: currentPrice,
      product,
      analysis: prediction as unknown as object,
      outcome: "PENDING",
      // Set expiry to 24 hours for intraday, 72 hours for swing
      expiresAt: prediction.suggested_timeframe.includes("Intraday")
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 72 * 60 * 60 * 1000),
    },
  });

  return record.id;
}

/**
 * Save a consensus prediction
 */
export async function saveConsensusPrediction(
  consensus: ConsensusResult,
  currentPrice: number,
  product: string
): Promise<string> {
  const record = await prisma.aIPrediction.create({
    data: {
      provider: "consensus",
      model: `Multi-AI (${consensus.providers_used.join(", ")})`,
      recommendation: consensus.consensus,
      confidence: consensus.consensus_confidence,
      entryStart: consensus.suggested_entry.start,
      entryEnd: consensus.suggested_entry.end,
      stopLoss: consensus.suggested_sl,
      takeProfit1: consensus.suggested_tp1,
      takeProfit2: consensus.suggested_tp2,
      priceAtPrediction: currentPrice,
      product,
      analysis: consensus as unknown as object,
      outcome: "PENDING",
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });

  return record.id;
}

// ============================================
// Evaluate Predictions
// ============================================

/**
 * Evaluate pending predictions against current price
 */
export async function evaluatePendingPredictions(
  currentPrice: number
): Promise<{ evaluated: number; wins: number; losses: number }> {
  const pendingPredictions = await prisma.aIPrediction.findMany({
    where: {
      outcome: "PENDING",
      expiresAt: { lte: new Date() }, // Only evaluate expired ones
    },
  });

  let evaluated = 0;
  let wins = 0;
  let losses = 0;

  for (const prediction of pendingPredictions) {
    const isBuy = ["BUY", "STRONG_BUY"].includes(prediction.recommendation);
    const isSell = ["SELL", "STRONG_SELL"].includes(prediction.recommendation);
    
    let outcome: "WIN" | "LOSS" | "BREAKEVEN";
    let hitTp1 = false;
    let hitTp2 = false;
    let hitSl = false;

    if (isBuy) {
      // For BUY: win if price went up to TP1, loss if hit SL
      hitTp1 = currentPrice >= prediction.takeProfit1;
      hitTp2 = currentPrice >= prediction.takeProfit2;
      hitSl = currentPrice <= prediction.stopLoss;
      
      if (hitTp1) {
        outcome = "WIN";
        wins++;
      } else if (hitSl) {
        outcome = "LOSS";
        losses++;
      } else {
        outcome = "BREAKEVEN";
      }
    } else if (isSell) {
      // For SELL: win if price went down to TP1, loss if hit SL
      hitTp1 = currentPrice <= prediction.takeProfit1;
      hitTp2 = currentPrice <= prediction.takeProfit2;
      hitSl = currentPrice >= prediction.stopLoss;
      
      if (hitTp1) {
        outcome = "WIN";
        wins++;
      } else if (hitSl) {
        outcome = "LOSS";
        losses++;
      } else {
        outcome = "BREAKEVEN";
      }
    } else {
      // NEUTRAL predictions
      outcome = "BREAKEVEN";
    }

    // Update prediction
    await prisma.aIPrediction.update({
      where: { id: prediction.id },
      data: {
        outcome,
        priceAtOutcome: currentPrice,
        evaluatedAt: new Date(),
        hitTp1,
        hitTp2,
        hitSl,
      },
    });

    evaluated++;
  }

  // Update accuracy stats
  await updateAccuracyStats();

  return { evaluated, wins, losses };
}

/**
 * Manually mark a prediction outcome
 */
export async function markPredictionOutcome(
  predictionId: string,
  outcome: "WIN" | "LOSS" | "BREAKEVEN",
  priceAtOutcome: number,
  notes?: string
): Promise<void> {
  await prisma.aIPrediction.update({
    where: { id: predictionId },
    data: {
      outcome,
      priceAtOutcome,
      outcomeNotes: notes,
      evaluatedAt: new Date(),
    },
  });

  await updateAccuracyStats();
}

// ============================================
// Calculate Accuracy Stats
// ============================================

/**
 * Update accuracy stats for all providers
 */
export async function updateAccuracyStats(): Promise<void> {
  const providers = ["openai", "gemini", "deepseek", "consensus"];

  for (const provider of providers) {
    const predictions = await prisma.aIPrediction.findMany({
      where: { provider },
    });

    if (predictions.length === 0) continue;

    const total = predictions.length;
    const evaluated = predictions.filter(p => p.outcome !== "PENDING");
    const wins = evaluated.filter(p => p.outcome === "WIN").length;
    const losses = evaluated.filter(p => p.outcome === "LOSS").length;
    
    // By recommendation type
    const buyPreds = predictions.filter(p => 
      ["BUY", "STRONG_BUY"].includes(p.recommendation) && p.outcome !== "PENDING"
    );
    const sellPreds = predictions.filter(p => 
      ["SELL", "STRONG_SELL"].includes(p.recommendation) && p.outcome !== "PENDING"
    );

    const buyWins = buyPreds.filter(p => p.outcome === "WIN").length;
    const sellWins = sellPreds.filter(p => p.outcome === "WIN").length;

    // TP hit rates
    const tp1Hits = evaluated.filter(p => p.hitTp1).length;
    const tp2Hits = evaluated.filter(p => p.hitTp2).length;
    const slHits = evaluated.filter(p => p.hitSl).length;

    // Time-based stats
    const last7Days = await prisma.aIPrediction.findMany({
      where: {
        provider,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        outcome: { not: "PENDING" },
      },
    });
    const last30Days = await prisma.aIPrediction.findMany({
      where: {
        provider,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        outcome: { not: "PENDING" },
      },
    });

    const last7Wins = last7Days.filter(p => p.outcome === "WIN").length;
    const last30Wins = last30Days.filter(p => p.outcome === "WIN").length;

    // Average confidence
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / total;

    await prisma.aIAccuracyStats.upsert({
      where: { provider },
      create: {
        provider,
        totalPredictions: total,
        correctPredictions: wins,
        incorrectPredictions: losses,
        pendingPredictions: total - evaluated.length,
        winRate: evaluated.length > 0 ? (wins / evaluated.length) * 100 : 0,
        buyAccuracy: buyPreds.length > 0 ? (buyWins / buyPreds.length) * 100 : 0,
        sellAccuracy: sellPreds.length > 0 ? (sellWins / sellPreds.length) * 100 : 0,
        tp1HitRate: evaluated.length > 0 ? (tp1Hits / evaluated.length) * 100 : 0,
        tp2HitRate: evaluated.length > 0 ? (tp2Hits / evaluated.length) * 100 : 0,
        slHitRate: evaluated.length > 0 ? (slHits / evaluated.length) * 100 : 0,
        avgConfidence,
        last7DaysWinRate: last7Days.length > 0 ? (last7Wins / last7Days.length) * 100 : 0,
        last30DaysWinRate: last30Days.length > 0 ? (last30Wins / last30Days.length) * 100 : 0,
      },
      update: {
        totalPredictions: total,
        correctPredictions: wins,
        incorrectPredictions: losses,
        pendingPredictions: total - evaluated.length,
        winRate: evaluated.length > 0 ? (wins / evaluated.length) * 100 : 0,
        buyAccuracy: buyPreds.length > 0 ? (buyWins / buyPreds.length) * 100 : 0,
        sellAccuracy: sellPreds.length > 0 ? (sellWins / sellPreds.length) * 100 : 0,
        tp1HitRate: evaluated.length > 0 ? (tp1Hits / evaluated.length) * 100 : 0,
        tp2HitRate: evaluated.length > 0 ? (tp2Hits / evaluated.length) * 100 : 0,
        slHitRate: evaluated.length > 0 ? (slHits / evaluated.length) * 100 : 0,
        avgConfidence,
        last7DaysWinRate: last7Days.length > 0 ? (last7Wins / last7Days.length) * 100 : 0,
        last30DaysWinRate: last30Days.length > 0 ? (last30Wins / last30Days.length) * 100 : 0,
      },
    });
  }
}

// ============================================
// Get Stats
// ============================================

/**
 * Get accuracy stats for all providers
 */
export async function getAccuracyStats(): Promise<AccuracyStats[]> {
  const stats = await prisma.aIAccuracyStats.findMany({
    orderBy: { winRate: "desc" },
  });

  return stats.map(s => ({
    provider: s.provider,
    totalPredictions: s.totalPredictions,
    winRate: Math.round(s.winRate * 10) / 10,
    buyAccuracy: Math.round(s.buyAccuracy * 10) / 10,
    sellAccuracy: Math.round(s.sellAccuracy * 10) / 10,
    tp1HitRate: Math.round(s.tp1HitRate * 10) / 10,
    tp2HitRate: Math.round(s.tp2HitRate * 10) / 10,
    slHitRate: Math.round(s.slHitRate * 10) / 10,
    avgConfidence: Math.round(s.avgConfidence * 10) / 10,
    last7DaysWinRate: Math.round(s.last7DaysWinRate * 10) / 10,
    last30DaysWinRate: Math.round(s.last30DaysWinRate * 10) / 10,
  }));
}

/**
 * Compare providers and recommend the best one
 */
export async function compareProviders(): Promise<ProviderComparison> {
  const stats = await getAccuracyStats();

  if (stats.length === 0) {
    return {
      providers: [],
      bestProvider: "consensus",
      recommendation: "ยังไม่มีข้อมูลเพียงพอ แนะนำให้ใช้ Multi-AI Consensus",
    };
  }

  // Find best provider by win rate (with min 10 predictions)
  const qualified = stats.filter(s => s.totalPredictions >= 10);
  
  if (qualified.length === 0) {
    return {
      providers: stats,
      bestProvider: "consensus",
      recommendation: `ยังมีข้อมูลน้อย (${stats.map(s => `${s.provider}: ${s.totalPredictions}`).join(", ")}) แนะนำให้ใช้ Multi-AI Consensus`,
    };
  }

  const best = qualified.reduce((a, b) => 
    (b.last7DaysWinRate > a.last7DaysWinRate) ? b : a
  );

  return {
    providers: stats,
    bestProvider: best.provider,
    recommendation: `${best.provider} มี Win Rate 7 วันล่าสุด ${best.last7DaysWinRate}% (จาก ${best.totalPredictions} การวิเคราะห์)`,
  };
}

/**
 * Get recent predictions with outcomes
 */
export async function getRecentPredictions(limit = 20): Promise<PredictionRecord[]> {
  const predictions = await prisma.aIPrediction.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return predictions.map(p => ({
    id: p.id,
    provider: p.provider,
    recommendation: p.recommendation,
    confidence: p.confidence,
    entryStart: p.entryStart,
    entryEnd: p.entryEnd,
    stopLoss: p.stopLoss,
    takeProfit1: p.takeProfit1,
    takeProfit2: p.takeProfit2,
    priceAtPrediction: p.priceAtPrediction,
    outcome: p.outcome || undefined,
    createdAt: p.createdAt,
  }));
}
