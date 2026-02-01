export interface PcrResult {
  ratio: number;
  totalPutOi: number;
  totalCallOi: number;
  signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  description: string;
}

export interface StrikeDataInput {
  strike: number;
  putOi: number | null;
  callOi: number | null;
}

/**
 * Calculate Put/Call Ratio (PCR)
 * PCR < 0.7 = Bullish (more calls being traded, expecting upward movement)
 * PCR 0.7-1.0 = Neutral
 * PCR > 1.0 = Bearish (more puts being traded, expecting downward movement)
 */
export function calculatePCR(strikes: StrikeDataInput[]): PcrResult {
  const totalPutOi = strikes.reduce((sum, s) => sum + (s.putOi || 0), 0);
  const totalCallOi = strikes.reduce((sum, s) => sum + (s.callOi || 0), 0);

  const ratio = totalCallOi > 0 ? totalPutOi / totalCallOi : 0;

  let signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  let description: string;

  if (ratio < 0.7) {
    signal = "BULLISH";
    description = "Low PCR indicates bullish sentiment - traders buying more calls";
  } else if (ratio > 1.0) {
    signal = "BEARISH";
    description = "High PCR indicates bearish sentiment - traders buying more puts";
  } else {
    signal = "NEUTRAL";
    description = "PCR in neutral range - no clear directional bias";
  }

  return {
    ratio,
    totalPutOi,
    totalCallOi,
    signal,
    description,
  };
}

/**
 * Calculate PCR for strikes near the current price (ATM region)
 */
export function calculateAtmPCR(
  strikes: StrikeDataInput[],
  currentPrice: number,
  rangePercent: number = 5
): PcrResult {
  const lowerBound = currentPrice * (1 - rangePercent / 100);
  const upperBound = currentPrice * (1 + rangePercent / 100);

  const atmStrikes = strikes.filter(
    (s) => s.strike >= lowerBound && s.strike <= upperBound
  );

  if (atmStrikes.length === 0) {
    return {
      ratio: 0,
      totalPutOi: 0,
      totalCallOi: 0,
      signal: "NEUTRAL",
      description: "No ATM strikes found in range",
    };
  }

  return calculatePCR(atmStrikes);
}
