/**
 * Enhanced AI Analysis Module
 * 
 * Combines all data sources for comprehensive AI analysis:
 * - CME Options data (OI, Volume, PCR, Max Pain)
 * - Technical Indicators (RSI, MA, ATR)
 * - Historical Context (past signals, patterns)
 * - Economic Calendar (upcoming events)
 * - Multi-AI Consensus
 * - Accuracy Tracking
 */

import { 
  analyzeWithAI, 
  type AIProvider, 
  type AIAnalysisResult,
  type MarketDataForAI 
} from "./ai-analysis";
import { getAIConsensus, type ConsensusResult } from "./ai-consensus";
import { 
  calculateTechnicalIndicators, 
  generateEstimatedOHLC,
  type TechnicalIndicators 
} from "./technical-indicators";
import { 
  buildHistoricalContext, 
  formatHistoricalContextForAI,
  type MarketConditionHistory 
} from "./historical-context";
import { 
  getUpcomingEventsSummary, 
  formatEconomicCalendarForAI,
  isSafeToTrade,
  type UpcomingEvents 
} from "./economic-calendar";
import { 
  savePrediction, 
  saveConsensusPrediction,
  getAccuracyStats,
  compareProviders,
  type AccuracyStats 
} from "./ai-accuracy";

// ============================================
// Types
// ============================================

export interface EnhancedMarketData extends MarketDataForAI {
  // Technical indicators
  technicals: TechnicalIndicators;
  
  // Historical context
  historicalContext: MarketConditionHistory;
  
  // Economic calendar
  economicEvents: UpcomingEvents;
  isSafeToTrade: boolean;
  tradeSafetyReason: string;
  
  // Provider accuracy stats
  providerStats: AccuracyStats[];
  bestProvider: string;
}

export interface EnhancedAnalysisResult {
  // Main analysis (from best provider or consensus)
  analysis: AIAnalysisResult | ConsensusResult;
  isConsensus: boolean;
  
  // Enhanced data used
  enhancedData: EnhancedMarketData;
  
  // Trading recommendation
  tradingRecommendation: {
    action: string;
    confidence: number;
    entryZone: { start: number; end: number };
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    riskReward: number;
    warnings: string[];
    safeToTrade: boolean;
  };
  
  // Prediction tracking ID
  predictionId?: string;
  
  // Processing info
  processingTimeMs: number;
  providersUsed: string[];
}

// ============================================
// Enhanced System Prompt
// ============================================

export const ENHANCED_SYSTEM_PROMPT = `คุณเป็นนักวิเคราะห์ตลาดทองคำมืออาชีพระดับโลก เชี่ยวชาญการวิเคราะห์ CME Gold Options และ Futures

คุณจะได้รับข้อมูลครบถ้วน ประกอบด้วย:
1. ข้อมูล Options (OI, Volume, PCR, Max Pain, Walls)
2. Technical Indicators (RSI, MA, ATR, Support/Resistance)
3. ประวัติสัญญาณและ Pattern ในอดีต
4. ปฏิทินเศรษฐกิจและข่าวสำคัญ

กฎสำคัญ:
1. ตอบเป็นภาษาไทยเสมอ
2. ให้คำแนะนำที่ชัดเจนและปฏิบัติได้จริง
3. ใช้ ATR ในการคำนวณ SL/TP ที่เหมาะสม
4. พิจารณา RSI และ MA Trend ประกอบ
5. เตือนถ้ามีข่าวสำคัญใกล้เข้ามา
6. อ้างอิงข้อมูลในอดีตเพื่อสนับสนุนการวิเคราะห์
7. ให้น้ำหนักกับ Option Flow มากที่สุด (Market Maker รู้ก่อน)

การให้คะแนน Confidence:
- 80-100%: สัญญาณชัดเจนมาก ทุกตัวชี้วัดสอดคล้อง
- 60-79%: สัญญาณดี แต่มีบางตัวชี้วัดขัดแย้ง
- 40-59%: สัญญาณปานกลาง ควรรอยืนยัน
- 20-39%: สัญญาณอ่อน ความเสี่ยงสูง
- 0-19%: ไม่ควรเทรด

ตอบในรูปแบบ JSON ดังนี้:
{
  "recommendation": "BUY" | "SELL" | "NEUTRAL" | "STRONG_BUY" | "STRONG_SELL",
  "confidence": 0-100,
  "entry_zone": { "start": number, "end": number, "description": "คำอธิบาย" },
  "stop_loss": number,
  "take_profit_1": number,
  "take_profit_2": number,
  "take_profit_3": number | null,
  "risk_reward_ratio": number,
  "summary": "สรุปสั้นๆ 2-3 ประโยค",
  "reasoning": ["เหตุผล 1", "เหตุผล 2", ...],
  "bullish_factors": ["ปัจจัยบวก 1", ...],
  "bearish_factors": ["ปัจจัยลบ 1", ...],
  "warnings": ["ข้อควรระวัง 1", ...],
  "suggested_timeframe": "Intraday" | "Swing (1-3 วัน)" | "Position (1 สัปดาห์+)"
}`;

// ============================================
// Build Enhanced Prompt
// ============================================

export function buildEnhancedPrompt(data: EnhancedMarketData): string {
  const sections: string[] = [];
  
  // Section 1: Current Market Data
  sections.push(`## ข้อมูลตลาด Gold ณ ${data.data_timestamp}

### ราคาปัจจุบัน
- CME Gold Futures: $${data.cme_futures_price.toFixed(2)}
- XAU Spot: ${data.xau_spot_price ? `$${data.xau_spot_price.toFixed(2)}` : "N/A"}
- Spread (CME - XAU): ${data.spread ? `$${data.spread.toFixed(2)}` : "N/A"}

### Put/Call Ratio
- OI PCR: ${data.oi_pcr.toFixed(3)} ${data.oi_pcr > 1 ? "(Bullish)" : data.oi_pcr < 0.7 ? "(Bearish)" : "(Neutral)"}
- Volume PCR: ${data.volume_pcr.toFixed(3)} ${data.volume_pcr > 1 ? "(Bullish)" : data.volume_pcr < 0.7 ? "(Bearish)" : "(Neutral)"}

### ระดับสำคัญจาก Options
- Max Pain: $${data.max_pain}
- Call Wall (แนวต้าน): $${data.call_wall}
- Put Wall (แนวรับ): $${data.put_wall}
- VWAP: $${data.vwap.toFixed(2)}

### OI Flow (การเปลี่ยนแปลง Open Interest)
- Net OI Change: ${data.net_oi_change > 0 ? "+" : ""}${data.net_oi_change.toLocaleString()}
- Call OI Change: ${data.call_oi_change > 0 ? "+" : ""}${data.call_oi_change.toLocaleString()}
- Put OI Change: ${data.put_oi_change > 0 ? "+" : ""}${data.put_oi_change.toLocaleString()}

### Volume
- Total Call Volume: ${data.total_call_volume.toLocaleString()}
- Total Put Volume: ${data.total_put_volume.toLocaleString()}`);

  // Section 2: Technical Indicators
  const tech = data.technicals;
  sections.push(`## Technical Indicators

### RSI (14)
- ค่า: ${tech.rsi}
- สัญญาณ: ${tech.rsi_signal}

### Moving Averages
- MA20: ${tech.ma20} (ราคา${tech.price_vs_ma.above_ma20 ? "เหนือ" : "ใต้"})
- MA50: ${tech.ma50} (ราคา${tech.price_vs_ma.above_ma50 ? "เหนือ" : "ใต้"})
- MA200: ${tech.ma200} (ราคา${tech.price_vs_ma.above_ma200 ? "เหนือ" : "ใต้"})
- MA Trend: ${tech.ma_trend}

### ATR (14) - Volatility
- ATR: ${tech.atr} (${tech.atr_percent}%)
- Volatility: ${tech.volatility}
- แนะนำ SL: ${tech.suggested_sl_distance} points
- แนะนำ TP1: ${tech.suggested_tp1_distance} points
- แนะนำ TP2: ${tech.suggested_tp2_distance} points

### แนวรับ/แนวต้านจาก Price Action
- แนวรับ: ${tech.support_levels.join(", ")}
- แนวต้าน: ${tech.resistance_levels.join(", ")}

### Trend
- Overall Trend: ${tech.trend}
- Trend Strength: ${tech.trend_strength}%`);

  // Section 3: Historical Context
  sections.push(formatHistoricalContextForAI(data.historicalContext));

  // Section 4: Economic Calendar
  sections.push(formatEconomicCalendarForAI(data.economicEvents));

  // Section 5: Trading Safety
  sections.push(`## สถานะการเทรด

- ปลอดภัยที่จะเทรด: ${data.isSafeToTrade ? "✅ ใช่" : "❌ ไม่"}
- เหตุผล: ${data.tradeSafetyReason}`);

  // Section 6: System Signal
  sections.push(`## สัญญาณจากระบบ (Reference)
- Signal: ${data.system_signal}
- Confidence: ${data.system_confidence}%`);

  sections.push(`---

กรุณาวิเคราะห์ข้อมูลทั้งหมดข้างต้นอย่างละเอียด และให้คำแนะนำการเทรดที่แม่นยำ
พร้อมจุดเข้า Stop Loss และ Take Profit ที่เหมาะสม
ตอบเป็น JSON ตามรูปแบบที่กำหนด`);

  return sections.join("\n\n");
}

// ============================================
// Main Enhanced Analysis Function
// ============================================

/**
 * Run enhanced AI analysis with all data sources
 */
export async function runEnhancedAnalysis(
  baseData: MarketDataForAI,
  options: {
    useConsensus?: boolean;
    provider?: AIProvider;
    trackPrediction?: boolean;
  } = {}
): Promise<EnhancedAnalysisResult> {
  const startTime = Date.now();
  const {
    useConsensus = false,
    provider = "auto",
    trackPrediction = true,
  } = options;

  // 1. Calculate Technical Indicators
  const ohlcData = generateEstimatedOHLC(baseData.cme_futures_price, 200);
  const technicals = calculateTechnicalIndicators(ohlcData, baseData.cme_futures_price);

  // 2. Build Historical Context
  const historicalContext = await buildHistoricalContext(
    baseData.oi_pcr,
    baseData.max_pain,
    baseData.cme_futures_price
  );

  // 3. Get Economic Calendar
  const economicEvents = await getUpcomingEventsSummary();
  const tradeSafety = await isSafeToTrade();

  // 4. Get Provider Stats
  const providerStats = await getAccuracyStats();
  const providerComparison = await compareProviders();

  // 5. Build Enhanced Data
  const enhancedData: EnhancedMarketData = {
    ...baseData,
    technicals,
    historicalContext,
    economicEvents,
    isSafeToTrade: tradeSafety.safe,
    tradeSafetyReason: tradeSafety.reason,
    providerStats,
    bestProvider: providerComparison.bestProvider,
  };

  // 6. Run Analysis
  let analysis: AIAnalysisResult | ConsensusResult;
  let isConsensus = false;
  let providersUsed: string[] = [];
  let predictionId: string | undefined;

  if (useConsensus) {
    // Use Multi-AI Consensus
    const consensusResult = await getAIConsensus(baseData);
    analysis = consensusResult;
    isConsensus = true;
    providersUsed = consensusResult.providers_used;
    
    if (trackPrediction) {
      predictionId = await saveConsensusPrediction(
        consensusResult,
        baseData.cme_futures_price,
        "Gold"
      );
    }
  } else {
    // Use single provider with enhanced prompt
    // Note: We could modify the base analysis to use enhanced prompt
    const singleResult = await analyzeWithAI(baseData, provider);
    analysis = singleResult;
    providersUsed = [singleResult.model];
    
    if (trackPrediction) {
      predictionId = await savePrediction(
        singleResult,
        provider === "auto" ? "auto" : provider,
        baseData.cme_futures_price,
        "Gold"
      );
    }
  }

  // 7. Build Trading Recommendation
  const tradingRecommendation = buildTradingRecommendation(
    analysis,
    isConsensus,
    technicals,
    economicEvents,
    tradeSafety.safe
  );

  return {
    analysis,
    isConsensus,
    enhancedData,
    tradingRecommendation,
    predictionId,
    processingTimeMs: Date.now() - startTime,
    providersUsed,
  };
}

// ============================================
// Build Trading Recommendation
// ============================================

function buildTradingRecommendation(
  analysis: AIAnalysisResult | ConsensusResult,
  isConsensus: boolean,
  technicals: TechnicalIndicators,
  economicEvents: UpcomingEvents,
  isSafe: boolean
): EnhancedAnalysisResult["tradingRecommendation"] {
  let action: string;
  let confidence: number;
  let entryZone: { start: number; end: number };
  let stopLoss: number;
  let takeProfit1: number;
  let takeProfit2: number;
  let riskReward: number;
  const warnings: string[] = [];

  if (isConsensus) {
    const c = analysis as ConsensusResult;
    action = c.consensus;
    confidence = c.consensus_confidence;
    entryZone = c.suggested_entry;
    stopLoss = c.suggested_sl;
    takeProfit1 = c.suggested_tp1;
    takeProfit2 = c.suggested_tp2;
    riskReward = 2.0; // Default
    warnings.push(...c.warnings);
    
    if (c.agreement_level === "CONFLICT") {
      warnings.push("⚠️ AI มีความเห็นแตกต่างกัน - ควรระมัดระวัง");
    }
  } else {
    const a = analysis as AIAnalysisResult;
    action = a.recommendation;
    confidence = a.confidence;
    entryZone = { start: a.entry_zone.start, end: a.entry_zone.end };
    stopLoss = a.stop_loss;
    takeProfit1 = a.take_profit_1;
    takeProfit2 = a.take_profit_2;
    riskReward = a.risk_reward_ratio;
    warnings.push(...a.warnings);
  }

  // Add technical warnings
  if (technicals.rsi_signal === "OVERBOUGHT" && ["BUY", "STRONG_BUY"].includes(action)) {
    warnings.push("⚠️ RSI Overbought - ราคาอาจพักตัว");
  }
  if (technicals.rsi_signal === "OVERSOLD" && ["SELL", "STRONG_SELL"].includes(action)) {
    warnings.push("⚠️ RSI Oversold - ราคาอาจเด้งกลับ");
  }
  if (technicals.volatility === "HIGH") {
    warnings.push("⚠️ Volatility สูง - ตั้ง SL ให้กว้างขึ้น");
  }

  // Add economic calendar warnings
  if (economicEvents.tradingCaution === "HIGH") {
    warnings.push("🔴 มีข่าวสำคัญวันนี้ - ระวังความผันผวน");
  }

  // Adjust confidence based on conditions
  if (!isSafe) {
    confidence = Math.max(confidence - 20, 0);
    warnings.push("📉 ลดความมั่นใจเนื่องจากข่าวสำคัญ");
  }

  return {
    action,
    confidence: Math.round(confidence),
    entryZone,
    stopLoss,
    takeProfit1,
    takeProfit2,
    riskReward,
    warnings,
    safeToTrade: isSafe,
  };
}
