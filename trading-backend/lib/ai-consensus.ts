/**
 * Multi-AI Consensus Module
 * 
 * Runs analysis on multiple AI providers and combines their opinions
 * for more reliable trading signals
 */

import {
  analyzeWithOpenAI,
  analyzeWithGemini,
  analyzeWithDeepSeek,
  type MarketDataForAI,
  type AIAnalysisResult,
} from "./ai-analysis";

// ============================================
// Types
// ============================================

export interface SingleAIResult {
  provider: string;
  success: boolean;
  result?: AIAnalysisResult;
  error?: string;
  processing_time_ms: number;
}

export interface ConsensusResult {
  // Consensus recommendation
  consensus: "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";
  consensus_confidence: number; // 0-100
  agreement_level: "HIGH" | "MEDIUM" | "LOW" | "CONFLICT";
  
  // Entry/Exit levels (averaged)
  suggested_entry: {
    start: number;
    end: number;
  };
  suggested_sl: number;
  suggested_tp1: number;
  suggested_tp2: number;
  
  // Individual results
  results: SingleAIResult[];
  
  // Vote breakdown
  votes: {
    strong_buy: number;
    buy: number;
    neutral: number;
    sell: number;
    strong_sell: number;
  };
  
  // Summary
  summary: string;
  warnings: string[];
  
  // Processing info
  total_time_ms: number;
  providers_used: string[];
  providers_failed: string[];
}

// ============================================
// Recommendation Scoring
// ============================================

const RECOMMENDATION_SCORES: Record<string, number> = {
  "STRONG_BUY": 2,
  "BUY": 1,
  "NEUTRAL": 0,
  "SELL": -1,
  "STRONG_SELL": -2,
};

function scoreToRecommendation(score: number): ConsensusResult["consensus"] {
  if (score >= 1.5) return "STRONG_BUY";
  if (score >= 0.5) return "BUY";
  if (score <= -1.5) return "STRONG_SELL";
  if (score <= -0.5) return "SELL";
  return "NEUTRAL";
}

// ============================================
// Main Consensus Function
// ============================================

/**
 * Run analysis on multiple AI providers and combine results
 */
export async function getAIConsensus(
  data: MarketDataForAI,
  options: {
    useOpenAI?: boolean;
    useGemini?: boolean;
    useDeepSeek?: boolean;
    minProviders?: number; // Minimum successful providers needed
  } = {}
): Promise<ConsensusResult> {
  const {
    useOpenAI = !!process.env.OPENAI_API_KEY,
    useGemini = !!process.env.GEMINI_API_KEY,
    useDeepSeek = !!process.env.DEEPSEEK_API_KEY,
    minProviders = 2,
  } = options;

  const startTime = Date.now();
  const results: SingleAIResult[] = [];
  const providersUsed: string[] = [];
  const providersFailed: string[] = [];

  // Create promises for each provider
  const promises: Promise<void>[] = [];

  if (useOpenAI) {
    promises.push(
      (async () => {
        const providerStart = Date.now();
        try {
          const result = await analyzeWithOpenAI(data);
          results.push({
            provider: "OpenAI GPT-4",
            success: true,
            result,
            processing_time_ms: Date.now() - providerStart,
          });
          providersUsed.push("OpenAI");
        } catch (error) {
          results.push({
            provider: "OpenAI GPT-4",
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            processing_time_ms: Date.now() - providerStart,
          });
          providersFailed.push("OpenAI");
        }
      })()
    );
  }

  if (useGemini) {
    promises.push(
      (async () => {
        const providerStart = Date.now();
        try {
          const result = await analyzeWithGemini(data);
          results.push({
            provider: "Google Gemini",
            success: true,
            result,
            processing_time_ms: Date.now() - providerStart,
          });
          providersUsed.push("Gemini");
        } catch (error) {
          results.push({
            provider: "Google Gemini",
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            processing_time_ms: Date.now() - providerStart,
          });
          providersFailed.push("Gemini");
        }
      })()
    );
  }

  if (useDeepSeek) {
    promises.push(
      (async () => {
        const providerStart = Date.now();
        try {
          const result = await analyzeWithDeepSeek(data);
          results.push({
            provider: "DeepSeek",
            success: true,
            result,
            processing_time_ms: Date.now() - providerStart,
          });
          providersUsed.push("DeepSeek");
        } catch (error) {
          results.push({
            provider: "DeepSeek",
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            processing_time_ms: Date.now() - providerStart,
          });
          providersFailed.push("DeepSeek");
        }
      })()
    );
  }

  // Wait for all providers
  await Promise.all(promises);

  // Get successful results
  const successfulResults = results.filter(r => r.success && r.result);
  
  if (successfulResults.length < minProviders) {
    throw new Error(
      `ต้องการอย่างน้อย ${minProviders} AI providers สำเร็จ แต่ได้แค่ ${successfulResults.length}`
    );
  }

  // Calculate consensus
  const votes = {
    strong_buy: 0,
    buy: 0,
    neutral: 0,
    sell: 0,
    strong_sell: 0,
  };

  let totalScore = 0;
  let totalConfidence = 0;
  let entryStarts: number[] = [];
  let entryEnds: number[] = [];
  let stopLosses: number[] = [];
  let tp1s: number[] = [];
  let tp2s: number[] = [];
  const allWarnings: string[] = [];

  for (const r of successfulResults) {
    const rec = r.result!.recommendation;
    
    // Count votes
    if (rec === "STRONG_BUY") votes.strong_buy++;
    else if (rec === "BUY") votes.buy++;
    else if (rec === "NEUTRAL") votes.neutral++;
    else if (rec === "SELL") votes.sell++;
    else if (rec === "STRONG_SELL") votes.strong_sell++;
    
    // Sum scores
    totalScore += RECOMMENDATION_SCORES[rec] || 0;
    totalConfidence += r.result!.confidence;
    
    // Collect levels
    entryStarts.push(r.result!.entry_zone.start);
    entryEnds.push(r.result!.entry_zone.end);
    stopLosses.push(r.result!.stop_loss);
    tp1s.push(r.result!.take_profit_1);
    tp2s.push(r.result!.take_profit_2);
    
    // Collect warnings
    allWarnings.push(...r.result!.warnings);
  }

  const numSuccess = successfulResults.length;
  const avgScore = totalScore / numSuccess;
  const avgConfidence = totalConfidence / numSuccess;
  
  // Determine consensus
  const consensus = scoreToRecommendation(avgScore);
  
  // Determine agreement level
  let agreementLevel: ConsensusResult["agreement_level"];
  const maxVote = Math.max(
    votes.strong_buy + votes.buy,
    votes.neutral,
    votes.sell + votes.strong_sell
  );
  const agreementRatio = maxVote / numSuccess;
  
  if (agreementRatio >= 0.9) {
    agreementLevel = "HIGH";
  } else if (agreementRatio >= 0.7) {
    agreementLevel = "MEDIUM";
  } else if (agreementRatio >= 0.5) {
    agreementLevel = "LOW";
  } else {
    agreementLevel = "CONFLICT";
  }

  // Average levels
  const avgEntry = {
    start: Math.round(average(entryStarts) * 100) / 100,
    end: Math.round(average(entryEnds) * 100) / 100,
  };
  const avgSL = Math.round(average(stopLosses) * 100) / 100;
  const avgTP1 = Math.round(average(tp1s) * 100) / 100;
  const avgTP2 = Math.round(average(tp2s) * 100) / 100;

  // Deduplicate warnings
  const uniqueWarnings = [...new Set(allWarnings)];

  // Build summary
  const summary = buildConsensusSummary(
    consensus,
    agreementLevel,
    votes,
    providersUsed,
    avgConfidence
  );

  return {
    consensus,
    consensus_confidence: Math.round(avgConfidence),
    agreement_level: agreementLevel,
    suggested_entry: avgEntry,
    suggested_sl: avgSL,
    suggested_tp1: avgTP1,
    suggested_tp2: avgTP2,
    results,
    votes,
    summary,
    warnings: uniqueWarnings.slice(0, 5), // Top 5 warnings
    total_time_ms: Date.now() - startTime,
    providers_used: providersUsed,
    providers_failed: providersFailed,
  };
}

// ============================================
// Helper Functions
// ============================================

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

function buildConsensusSummary(
  consensus: string,
  agreementLevel: string,
  votes: ConsensusResult["votes"],
  providers: string[],
  confidence: number
): string {
  const consensusLabel = {
    "STRONG_BUY": "ซื้อแรง",
    "BUY": "ซื้อ",
    "NEUTRAL": "รอดู",
    "SELL": "ขาย",
    "STRONG_SELL": "ขายแรง",
  }[consensus] || consensus;

  const agreementLabel = {
    "HIGH": "เห็นตรงกันสูง",
    "MEDIUM": "เห็นตรงกันปานกลาง",
    "LOW": "เห็นตรงกันต่ำ",
    "CONFLICT": "ขัดแย้งกัน",
  }[agreementLevel] || agreementLevel;

  const voteStr = [];
  if (votes.strong_buy > 0) voteStr.push(`ซื้อแรง: ${votes.strong_buy}`);
  if (votes.buy > 0) voteStr.push(`ซื้อ: ${votes.buy}`);
  if (votes.neutral > 0) voteStr.push(`รอดู: ${votes.neutral}`);
  if (votes.sell > 0) voteStr.push(`ขาย: ${votes.sell}`);
  if (votes.strong_sell > 0) voteStr.push(`ขายแรง: ${votes.strong_sell}`);

  return `${providers.length} AI (${providers.join(", ")}) ให้ความเห็น: ${consensusLabel} | ${agreementLabel} | ความมั่นใจเฉลี่ย ${Math.round(confidence)}% | โหวต: ${voteStr.join(", ")}`;
}

// ============================================
// Quick Consensus (2 providers only)
// ============================================

export async function getQuickConsensus(
  data: MarketDataForAI
): Promise<ConsensusResult> {
  // Use only 2 fastest/cheapest providers
  return getAIConsensus(data, {
    useDeepSeek: !!process.env.DEEPSEEK_API_KEY,
    useGemini: !!process.env.GEMINI_API_KEY,
    useOpenAI: !process.env.DEEPSEEK_API_KEY && !process.env.GEMINI_API_KEY,
    minProviders: 1,
  });
}
