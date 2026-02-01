export interface OiChange {
  strike: number;
  putOi: number;
  callOi: number;
  prevPutOi: number;
  prevCallOi: number;
  putChange: number;
  callChange: number;
  putChangePercent: number;
  callChangePercent: number;
}

export interface OiAnalysisResult {
  changes: OiChange[];
  summary: {
    totalPutChange: number;
    totalCallChange: number;
    totalPutChangePercent: number;
    totalCallChangePercent: number;
    signal: "BULLISH" | "BEARISH" | "NEUTRAL";
    description: string;
  };
  significantChanges: OiChange[];
}

export interface StrikeDataInput {
  strike: number;
  putOi: number | null;
  callOi: number | null;
}

/**
 * Analyze OI changes between two snapshots
 */
export function analyzeOiChanges(
  current: StrikeDataInput[],
  previous: StrikeDataInput[],
  significantThresholdPercent: number = 10
): OiAnalysisResult {
  // Build lookup map for previous data
  const prevMap = new Map<number, StrikeDataInput>();
  for (const strike of previous) {
    prevMap.set(strike.strike, strike);
  }

  const changes: OiChange[] = [];
  let totalPutChange = 0;
  let totalCallChange = 0;
  let totalPrevPut = 0;
  let totalPrevCall = 0;

  for (const curr of current) {
    const prev = prevMap.get(curr.strike);
    const prevPutOi = prev?.putOi || 0;
    const prevCallOi = prev?.callOi || 0;
    const currPutOi = curr.putOi || 0;
    const currCallOi = curr.callOi || 0;

    const putChange = currPutOi - prevPutOi;
    const callChange = currCallOi - prevCallOi;
    const putChangePercent = prevPutOi > 0 ? (putChange / prevPutOi) * 100 : 0;
    const callChangePercent = prevCallOi > 0 ? (callChange / prevCallOi) * 100 : 0;

    changes.push({
      strike: curr.strike,
      putOi: currPutOi,
      callOi: currCallOi,
      prevPutOi,
      prevCallOi,
      putChange,
      callChange,
      putChangePercent,
      callChangePercent,
    });

    totalPutChange += putChange;
    totalCallChange += callChange;
    totalPrevPut += prevPutOi;
    totalPrevCall += prevCallOi;
  }

  const totalPutChangePercent = totalPrevPut > 0 ? (totalPutChange / totalPrevPut) * 100 : 0;
  const totalCallChangePercent = totalPrevCall > 0 ? (totalCallChange / totalPrevCall) * 100 : 0;

  // Determine signal based on OI changes
  let signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  let description: string;

  // If Call OI increases more than Put OI = Bullish
  // If Put OI increases more than Call OI = Bearish
  const netCallBias = totalCallChange - totalPutChange;
  const threshold = Math.max(totalPrevCall, totalPrevPut) * 0.05; // 5% threshold

  if (netCallBias > threshold) {
    signal = "BULLISH";
    description = "Call OI increasing faster than Put OI - bullish positioning";
  } else if (netCallBias < -threshold) {
    signal = "BEARISH";
    description = "Put OI increasing faster than Call OI - bearish positioning";
  } else {
    signal = "NEUTRAL";
    description = "OI changes balanced - no clear directional bias";
  }

  // Find significant changes
  const significantChanges = changes.filter(
    (c) =>
      Math.abs(c.putChangePercent) >= significantThresholdPercent ||
      Math.abs(c.callChangePercent) >= significantThresholdPercent
  );

  return {
    changes,
    summary: {
      totalPutChange,
      totalCallChange,
      totalPutChangePercent,
      totalCallChangePercent,
      signal,
      description,
    },
    significantChanges,
  };
}

/**
 * Analyze OI buildup around specific price levels
 */
export function analyzeOiBuildupNearPrice(
  changes: OiChange[],
  currentPrice: number,
  rangePercent: number = 3
): {
  nearPriceChanges: OiChange[];
  signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  description: string;
} {
  const lowerBound = currentPrice * (1 - rangePercent / 100);
  const upperBound = currentPrice * (1 + rangePercent / 100);

  const nearPriceChanges = changes.filter(
    (c) => c.strike >= lowerBound && c.strike <= upperBound
  );

  if (nearPriceChanges.length === 0) {
    return {
      nearPriceChanges: [],
      signal: "NEUTRAL",
      description: "No OI changes near current price",
    };
  }

  const totalPutChange = nearPriceChanges.reduce((sum, c) => sum + c.putChange, 0);
  const totalCallChange = nearPriceChanges.reduce((sum, c) => sum + c.callChange, 0);

  let signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  let description: string;

  if (totalCallChange > totalPutChange * 1.5) {
    signal = "BULLISH";
    description = "Strong call buildup near ATM - bullish";
  } else if (totalPutChange > totalCallChange * 1.5) {
    signal = "BEARISH";
    description = "Strong put buildup near ATM - bearish";
  } else {
    signal = "NEUTRAL";
    description = "Mixed OI buildup near ATM";
  }

  return {
    nearPriceChanges,
    signal,
    description,
  };
}
