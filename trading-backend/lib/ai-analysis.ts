/**
 * AI-Powered Market Analysis
 * 
 * Uses OpenAI GPT-4 or Google Gemini to analyze CME options data
 * and provide trading recommendations
 */

import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ============================================
// Types
// ============================================

export interface MarketDataForAI {
  // Current prices
  cme_futures_price: number;
  xau_spot_price: number | null;
  spread: number | null;

  // PCR data
  oi_pcr: number;
  volume_pcr: number;

  // Key levels
  max_pain: number;
  call_wall: number;  // Resistance
  put_wall: number;   // Support

  // OI Flow
  net_oi_change: number;
  call_oi_change: number;
  put_oi_change: number;

  // Volume data
  total_call_volume: number;
  total_put_volume: number;
  hot_strikes: Array<{
    strike: number;
    volume: number;
    type: "call" | "put" | "mixed";
  }>;

  // VWAP
  vwap: number;

  // Current signal from system
  system_signal: "BUY" | "SELL" | "NEUTRAL";
  system_confidence: number;

  // Timestamp
  data_timestamp: string;

  // Advanced Analysis
  gex?: {
    totalGex: number;
    zeroGammaLevel: number | null;
    interpretation: string;
  };

  economic_events?: {
    tradingCaution: "HIGH" | "MEDIUM" | "LOW" | "NONE";
    warnings: string[];
    upcomingHighImpact: string[];
  };
}

export interface AIAnalysisResult {
  // Main recommendation
  recommendation: "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";
  confidence: number; // 0-100

  // Entry/Exit levels (in XAU prices if available, otherwise CME)
  entry_zone: {
    start: number;
    end: number;
    description: string;
  };
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  take_profit_3?: number;

  // Risk/Reward
  risk_reward_ratio: number;

  // Analysis summary
  summary: string;

  // Detailed reasoning
  reasoning: string[];

  // Key observations
  bullish_factors: string[];
  bearish_factors: string[];

  // Warnings/Cautions
  warnings: string[];

  // Timeframe
  suggested_timeframe: string;

  // AI model used
  model: string;

  // Processing time
  processing_time_ms: number;
}

// ============================================
// System Prompt for AI
// ============================================

const SYSTEM_PROMPT = `คุณเป็น AI ผู้ช่วยเทรดทองคำ (XAU/USD) มืออาชีพ หน้าที่ของคุณคือวิเคราะห์ข้อมูลจาก CME Options เพื่อหาจุดเข้าเทรด XAU

กฎการวิเคราะห์ (เคร่งครัด):
1. **หาทิศทาง (Direction)**: ดูที่ "Intraday Volume" เป็นหลัก
   - ถ้า Call Volume > Put Volume -> มองขึ้น (Bullish)
   - ถ้า Put Volume > Call Volume -> มองลง (Bearish)
   - **กรณีไม่มี Intraday Volume (เช่น วันจันทร์เช้า)**:
     - ให้ดู "Net OI Change" แทน (บวก = Bullish, ลบ = Bearish)
     - หรือดู Technical Trend (MA/RSI) ประกอบ
     - ระบุในเหตุผลว่า "ใช้ OI Change แทนเนื่องจากไม่มี Volume"

2. **หาแนวรับ/ต้าน (Levels)**: ดูที่ "Open Interest (OI)" เท่านั้น
   - แนวต้าน = Strike ที่มี Call OI สูงสุด (Call Wall)
   - แนวรับ = Strike ที่มี Put OI สูงสุด (Put Wall)
   - *เสริม*: ดู Zero Gamma Level ประกอบ ถ้ามี (มักเป็น Magnet ดูดราคา)

3. **GEX & News (Advanced)**:
   - Positive GEX: ราคาจะแกว่งตัว (Mean Reversion) -> เน้น Swing Trade
   - Negative GEX: ราคาจะวิ่งแรง (Trend) -> เน้น Breakout
   - ข่าวแดง: ถ้ามีข่าว High Impact ใน < 2 ชม. ให้เตือน "ระวังความผันผวน"

4. **การคำนวณราคา XAU (สำคัญมาก)**:
   - ข้อมูลที่ได้เป็นราคา CME Futures
   - คุณต้องแปลงเป็นราคา XAU เสมอ โดยใช้สูตร: "ราคา CME - Spread = ราคา XAU"
   - จุดเข้า (Entry), Stop Loss, Take Profit ต้องเป็นราคา XAU เท่านั้น

รูปแบบการตอบ (JSON เท่านั้น):
{
  "recommendation": "BUY" | "SELL" | "NEUTRAL" | "STRONG_BUY" | "STRONG_SELL",
  "confidence": 0-100,
  "entry_zone": { 
    "start": number (ราคา XAU), 
    "end": number (ราคา XAU), 
    "description": "ระบุว่าอ้างอิงจากแนวรับ/ต้าน CME Strike ไหน" 
  },
  "stop_loss": number (ราคา XAU),
  "take_profit_1": number (ราคา XAU),
  "take_profit_2": number (ราคา XAU),
  "take_profit_3": number | null,
  "risk_reward_ratio": number,
  "summary": "สรุปทิศทางจาก Volume และแนวรับต้านจาก OI",
  "reasoning": [
    "วิเคราะห์ Volume: ...",
    "วิเคราะห์ OI: ...",
    "การแปลงราคา: ใช้ Spread ... ในการคำนวณ"
  ],
  "bullish_factors": ["ปัจจัยบวก..."],
  "bearish_factors": ["ปัจจัยลบ..."],
  "warnings": ["ข้อควรระวัง..."],
  "suggested_timeframe": "Intraday" | "Swing"
}`;

// ============================================
// Format data for AI prompt
// ============================================

function formatDataForPrompt(data: MarketDataForAI): string {
  const hotStrikesStr = data.hot_strikes
    .slice(0, 5)
    .map(s => `  - Strike ${s.strike}: ${s.volume.toLocaleString()} contracts (${s.type})`)
    .join("\n");

  return `
## ข้อมูลตลาด Gold ณ ${data.data_timestamp}

### ราคาปัจจุบัน
- CME Gold Futures: $${data.cme_futures_price.toFixed(2)}
- XAU Spot: ${data.xau_spot_price ? `$${data.xau_spot_price.toFixed(2)}` : "N/A"}
- Spread (CME - XAU): ${data.spread ? `$${data.spread.toFixed(2)}` : "N/A"}

### Put/Call Ratio
- OI PCR: ${data.oi_pcr.toFixed(3)} ${data.oi_pcr > 1 ? "(Bullish)" : data.oi_pcr < 0.7 ? "(Bearish)" : "(Neutral)"}
- Volume PCR: ${data.volume_pcr.toFixed(3)} ${data.volume_pcr > 1 ? "(Bullish)" : data.volume_pcr < 0.7 ? "(Bearish)" : "(Neutral)"}

### ระดับสำคัญ
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
- Total Put Volume: ${data.total_put_volume.toLocaleString()}
- Hot Strikes (Volume สูง):
${hotStrikesStr}

### สัญญาณจากระบบ
- Signal: ${data.system_signal}
- Confidence: ${data.system_confidence}%

### Advanced Analysis (GEX & News)
${data.gex ? `- GEX Interpretation: ${data.gex.interpretation}
- Zero Gamma Level: ${data.gex.zeroGammaLevel ? "$" + data.gex.zeroGammaLevel : "N/A"}` : "- GEX: N/A"}

${data.economic_events ? `- Trading Caution: ${data.economic_events.tradingCaution}
- Warnings: ${data.economic_events.warnings.join(", ") || "None"}
- Upcoming High Impact: ${data.economic_events.upcomingHighImpact.join(", ") || "None"}` : "- Economic Events: N/A"}

---

กรุณาวิเคราะห์ข้อมูลข้างต้นและให้คำแนะนำการเทรด พร้อมจุดเข้า Stop Loss และ Take Profit
ตอบเป็น JSON ตามรูปแบบที่กำหนด
`.trim();
}

// ============================================
// OpenAI Analysis
// ============================================

export async function analyzeWithOpenAI(
  data: MarketDataForAI
): Promise<AIAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const openai = new OpenAI({ apiKey });
  const startTime = Date.now();

  const prompt = formatDataForPrompt(data);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  const result = JSON.parse(content);

  return {
    ...result,
    model: "GPT-4o",
    processing_time_ms: Date.now() - startTime,
  };
}

// ============================================
// Gemini Analysis
// ============================================

export async function analyzeWithGemini(
  data: MarketDataForAI
): Promise<AIAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-001",
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2000,
      responseMimeType: "application/json",
    },
  });

  const startTime = Date.now();
  const prompt = `${SYSTEM_PROMPT}\n\n${formatDataForPrompt(data)}`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  if (!text) {
    throw new Error("No response from Gemini");
  }

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Invalid JSON response from Gemini");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    ...parsed,
    model: "Gemini 1.5 Flash",
    processing_time_ms: Date.now() - startTime,
  };
}

// ============================================
// DeepSeek Analysis
// ============================================

export async function analyzeWithDeepSeek(
  data: MarketDataForAI
): Promise<AIAnalysisResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }

  // DeepSeek uses OpenAI-compatible API
  const openai = new OpenAI({
    apiKey,
    baseURL: "https://api.deepseek.com/v1",
  });

  const startTime = Date.now();
  const prompt = formatDataForPrompt(data);

  const response = await openai.chat.completions.create({
    model: "deepseek-chat", // หรือ "deepseek-reasoner" สำหรับ R1
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from DeepSeek");
  }

  const result = JSON.parse(content);

  return {
    ...result,
    model: "DeepSeek Chat",
    processing_time_ms: Date.now() - startTime,
  };
}

// ============================================
// DeepSeek R1 (Reasoning Model)
// ============================================

export async function analyzeWithDeepSeekR1(
  data: MarketDataForAI
): Promise<AIAnalysisResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }

  const openai = new OpenAI({
    apiKey,
    baseURL: "https://api.deepseek.com/v1",
  });

  const startTime = Date.now();
  const prompt = formatDataForPrompt(data);

  const response = await openai.chat.completions.create({
    model: "deepseek-reasoner", // DeepSeek R1
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 4000, // R1 needs more tokens for reasoning
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from DeepSeek R1");
  }

  // R1 might include reasoning before JSON, extract JSON part
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Invalid JSON response from DeepSeek R1");
  }

  const result = JSON.parse(jsonMatch[0]);

  return {
    ...result,
    model: "DeepSeek R1",
    processing_time_ms: Date.now() - startTime,
  };
}

// ============================================
// Main Analysis Function
// ============================================

export type AIProvider = "openai" | "gemini" | "deepseek" | "deepseek-r1" | "auto";

export async function analyzeWithAI(
  data: MarketDataForAI,
  provider: AIProvider = "auto"
): Promise<AIAnalysisResult> {
  console.log(`[AI Analysis] Requesting analysis with provider: ${provider}`);

  // Auto-select based on available API keys
  if (provider === "auto") {
    if (process.env.GEMINI_API_KEY) {
      provider = "gemini"; // Prefer Gemini (Fastest & Reliable)
    } else if (process.env.DEEPSEEK_API_KEY) {
      provider = "deepseek";
    } else if (process.env.OPENAI_API_KEY) {
      provider = "openai";
    } else {
      throw new Error("No AI API key configured. Set GEMINI_API_KEY, DEEPSEEK_API_KEY, or OPENAI_API_KEY");
    }
    console.log(`[AI Analysis] Auto-selected provider: ${provider}`);
  }

  const startTime = Date.now();
  try {
    switch (provider) {
      case "openai":
        return await analyzeWithOpenAI(data);
      case "gemini":
        return await analyzeWithGemini(data);
      case "deepseek":
        return await analyzeWithDeepSeek(data);
      case "deepseek-r1":
        return await analyzeWithDeepSeekR1(data);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  } finally {
    console.log(`[AI Analysis] Completed in ${Date.now() - startTime}ms using ${provider}`);
  }
}

// ============================================
// Recommendation Helpers
// ============================================

export function getRecommendationColor(rec: string): string {
  switch (rec) {
    case "STRONG_BUY":
      return "bg-green-600";
    case "BUY":
      return "bg-green-500";
    case "NEUTRAL":
      return "bg-yellow-500";
    case "SELL":
      return "bg-red-500";
    case "STRONG_SELL":
      return "bg-red-600";
    default:
      return "bg-gray-500";
  }
}

export function getRecommendationEmoji(rec: string): string {
  switch (rec) {
    case "STRONG_BUY":
      return "🚀";
    case "BUY":
      return "📈";
    case "NEUTRAL":
      return "➡️";
    case "SELL":
      return "📉";
    case "STRONG_SELL":
      return "💥";
    default:
      return "❓";
  }
}

export function getRecommendationLabel(rec: string): string {
  switch (rec) {
    case "STRONG_BUY":
      return "ซื้อแรง";
    case "BUY":
      return "ซื้อ";
    case "NEUTRAL":
      return "รอดู";
    case "SELL":
      return "ขาย";
    case "STRONG_SELL":
      return "ขายแรง";
    default:
      return rec;
  }
}
