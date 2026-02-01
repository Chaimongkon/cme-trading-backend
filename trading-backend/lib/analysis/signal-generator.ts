import { calculatePCR, calculateAtmPCR, type PcrResult } from "./put-call-ratio";
import { calculateMaxPain, findKeyLevels, type MaxPainResult } from "./max-pain";
import { analyzeOiChanges, analyzeOiBuildupNearPrice, type OiAnalysisResult } from "./oi-analyzer";

export interface StrikeDataInput {
  strike: number;
  putOi: number | null;
  callOi: number | null;
}

export interface Signal {
  type: "BUY" | "SELL" | "NEUTRAL";
  strength: 1 | 2 | 3 | 4 | 5;
  reason: string;
  factors: {
    pcr: {
      value: number;
      signal: string;
      weight: number;
    };
    atmPcr: {
      value: number;
      signal: string;
      weight: number;
    };
    maxPain: {
      value: number;
      priceDistance: number;
      signal: string;
      weight: number;
    };
    oiTrend: {
      putChange: number;
      callChange: number;
      signal: string;
      weight: number;
    };
    atmOiBuildup: {
      signal: string;
      weight: number;
    };
    keyLevels: {
      support: number[];
      resistance: number[];
    };
  };
}

export interface AnalysisResult {
  currentSnapshot: {
    product: string;
    expiry: string;
    futurePrice: number;
    extractedAt: string;
    strikes: StrikeDataInput[];
  };
  previousSnapshot: {
    product: string;
    expiry: string;
    futurePrice: number;
    extractedAt: string;
    strikes: StrikeDataInput[];
  } | null;
  pcr: PcrResult;
  atmPcr: PcrResult;
  maxPain: MaxPainResult;
  oiChanges: OiAnalysisResult | null;
  signal: Signal;
}

/**
 * Generate trading signal based on comprehensive analysis
 */
export function generateSignal(
  currentStrikes: StrikeDataInput[],
  previousStrikes: StrikeDataInput[] | null,
  currentPrice: number
): Signal {
  let bullishScore = 0;
  let bearishScore = 0;

  // 1. Overall PCR Analysis (weight: 2)
  const pcr = calculatePCR(currentStrikes);
  if (pcr.signal === "BULLISH") bullishScore += 2;
  else if (pcr.signal === "BEARISH") bearishScore += 2;

  // 2. ATM PCR Analysis (weight: 2)
  const atmPcr = calculateAtmPCR(currentStrikes, currentPrice, 5);
  if (atmPcr.signal === "BULLISH") bullishScore += 2;
  else if (atmPcr.signal === "BEARISH") bearishScore += 2;

  // 3. Max Pain Analysis (weight: 1.5)
  const maxPain = calculateMaxPain(currentStrikes, currentPrice);
  if (maxPain.signal === "BULLISH") bullishScore += 1.5;
  else if (maxPain.signal === "BEARISH") bearishScore += 1.5;

  // 4. OI Change Analysis (weight: 2)
  let oiChanges: OiAnalysisResult | null = null;
  let oiTrendSignal = "NEUTRAL";
  let oiPutChange = 0;
  let oiCallChange = 0;

  if (previousStrikes && previousStrikes.length > 0) {
    oiChanges = analyzeOiChanges(currentStrikes, previousStrikes);
    oiTrendSignal = oiChanges.summary.signal;
    oiPutChange = oiChanges.summary.totalPutChange;
    oiCallChange = oiChanges.summary.totalCallChange;

    if (oiTrendSignal === "BULLISH") bullishScore += 2;
    else if (oiTrendSignal === "BEARISH") bearishScore += 2;

    // 5. ATM OI Buildup (weight: 1.5)
    const atmBuildup = analyzeOiBuildupNearPrice(oiChanges.changes, currentPrice);
    if (atmBuildup.signal === "BULLISH") bullishScore += 1.5;
    else if (atmBuildup.signal === "BEARISH") bearishScore += 1.5;
  }

  // 6. Key Levels Analysis
  const keyLevels = findKeyLevels(currentStrikes, currentPrice);

  // Calculate final signal
  const totalScore = bullishScore + bearishScore;
  const netScore = bullishScore - bearishScore;

  let type: "BUY" | "SELL" | "NEUTRAL";
  let strength: 1 | 2 | 3 | 4 | 5;
  let reason: string;

  if (netScore >= 4) {
    type = "BUY";
    strength = 5;
    reason = "สัญญาณขาขึ้นแข็งแกร่งจากหลายตัวชี้วัด";
  } else if (netScore >= 2.5) {
    type = "BUY";
    strength = 4;
    reason = "หลายตัวชี้วัดบ่งบอกขาขึ้นด้วยความเชื่อมั่นปานกลาง";
  } else if (netScore >= 1) {
    type = "BUY";
    strength = 3;
    reason = "แนวโน้มขาขึ้นเล็กน้อยจากข้อมูล Options";
  } else if (netScore <= -4) {
    type = "SELL";
    strength = 5;
    reason = "สัญญาณขาลงแข็งแกร่งจากหลายตัวชี้วัด";
  } else if (netScore <= -2.5) {
    type = "SELL";
    strength = 4;
    reason = "หลายตัวชี้วัดบ่งบอกขาลงด้วยความเชื่อมั่นปานกลาง";
  } else if (netScore <= -1) {
    type = "SELL";
    strength = 3;
    reason = "แนวโน้มขาลงเล็กน้อยจากข้อมูล Options";
  } else {
    type = "NEUTRAL";
    strength = totalScore > 3 ? 2 : 1;
    reason = "สัญญาณผสม - ไม่มีทิศทางที่ชัดเจน";
  }

  return {
    type,
    strength,
    reason,
    factors: {
      pcr: {
        value: pcr.ratio,
        signal: pcr.signal,
        weight: 2,
      },
      atmPcr: {
        value: atmPcr.ratio,
        signal: atmPcr.signal,
        weight: 2,
      },
      maxPain: {
        value: maxPain.maxPainStrike,
        priceDistance: maxPain.priceToMaxPain,
        signal: maxPain.signal,
        weight: 1.5,
      },
      oiTrend: {
        putChange: oiPutChange,
        callChange: oiCallChange,
        signal: oiTrendSignal,
        weight: 2,
      },
      atmOiBuildup: {
        signal: oiChanges
          ? analyzeOiBuildupNearPrice(oiChanges.changes, currentPrice).signal
          : "NEUTRAL",
        weight: 1.5,
      },
      keyLevels,
    },
  };
}

/**
 * Run full analysis and generate signal
 */
export function runAnalysis(
  currentData: {
    product: string;
    expiry: string;
    futurePrice: number;
    extractedAt: string;
    strikes: StrikeDataInput[];
  },
  previousData: {
    product: string;
    expiry: string;
    futurePrice: number;
    extractedAt: string;
    strikes: StrikeDataInput[];
  } | null
): AnalysisResult {
  const currentPrice = currentData.futurePrice;
  const currentStrikes = currentData.strikes;
  const previousStrikes = previousData?.strikes || null;

  const pcr = calculatePCR(currentStrikes);
  const atmPcr = calculateAtmPCR(currentStrikes, currentPrice, 5);
  const maxPain = calculateMaxPain(currentStrikes, currentPrice);
  const oiChanges = previousStrikes
    ? analyzeOiChanges(currentStrikes, previousStrikes)
    : null;

  const signal = generateSignal(currentStrikes, previousStrikes, currentPrice);

  return {
    currentSnapshot: currentData,
    previousSnapshot: previousData,
    pcr,
    atmPcr,
    maxPain,
    oiChanges,
    signal,
  };
}
