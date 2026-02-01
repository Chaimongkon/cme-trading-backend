export interface MaxPainResult {
  maxPainStrike: number;
  painValues: { strike: number; totalPain: number }[];
  signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  description: string;
  priceToMaxPain: number;
}

export interface StrikeDataInput {
  strike: number;
  putOi: number | null;
  callOi: number | null;
}

/**
 * Calculate Max Pain - the strike price where option buyers lose the most money
 * This is often where the price tends to gravitate towards at expiration
 *
 * For each strike price:
 * - Calculate total loss for put holders if price settles at that strike
 * - Calculate total loss for call holders if price settles at that strike
 * - Sum them up to get total pain
 * - Max Pain strike is where total pain is highest (option writers profit most)
 */
export function calculateMaxPain(
  strikes: StrikeDataInput[],
  currentPrice: number
): MaxPainResult {
  if (strikes.length === 0) {
    return {
      maxPainStrike: 0,
      painValues: [],
      signal: "NEUTRAL",
      description: "No strike data available",
      priceToMaxPain: 0,
    };
  }

  // Get all unique strikes
  const allStrikes = [...new Set(strikes.map((s) => s.strike))].sort(
    (a, b) => a - b
  );

  const painValues: { strike: number; totalPain: number }[] = [];

  // For each potential settlement price (each strike)
  for (const settlementPrice of allStrikes) {
    let totalPain = 0;

    for (const strike of strikes) {
      // Put pain: if settlement is below strike, put buyers profit (writers lose)
      // We want pain to option buyers, so: if settlement > strike, put expires worthless = loss for put buyer
      if (strike.putOi && strike.putOi > 0) {
        if (settlementPrice < strike.strike) {
          // Put is ITM - buyer profits, not pain
          // Pain to buyer = 0
        } else {
          // Put is OTM - buyer loses premium
          // Approximation: assume pain proportional to OI
          totalPain += strike.putOi * (strike.strike - Math.min(settlementPrice, strike.strike));
        }
      }

      // Call pain: if settlement is above strike, call buyers profit
      // if settlement <= strike, call expires worthless = loss for call buyer
      if (strike.callOi && strike.callOi > 0) {
        if (settlementPrice > strike.strike) {
          // Call is ITM - buyer profits
          // Pain to buyer = 0
        } else {
          // Call is OTM - buyer loses premium
          totalPain += strike.callOi * (Math.max(settlementPrice, strike.strike) - strike.strike);
        }
      }
    }

    painValues.push({ strike: settlementPrice, totalPain });
  }

  // Find strike with maximum pain (minimum payout to option holders)
  const maxPainEntry = painValues.reduce(
    (max, curr) => (curr.totalPain > max.totalPain ? curr : max),
    { strike: 0, totalPain: -Infinity }
  );

  const maxPainStrike = maxPainEntry.strike;
  const priceToMaxPain = maxPainStrike - currentPrice;
  const percentDiff = (priceToMaxPain / currentPrice) * 100;

  let signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  let description: string;

  if (percentDiff > 1) {
    signal = "BULLISH";
    description = `Price below Max Pain by ${Math.abs(percentDiff).toFixed(1)}% - potential upward pressure`;
  } else if (percentDiff < -1) {
    signal = "BEARISH";
    description = `Price above Max Pain by ${Math.abs(percentDiff).toFixed(1)}% - potential downward pressure`;
  } else {
    signal = "NEUTRAL";
    description = "Price near Max Pain - consolidation expected";
  }

  return {
    maxPainStrike,
    painValues: painValues.sort((a, b) => a.strike - b.strike),
    signal,
    description,
    priceToMaxPain,
  };
}

/**
 * Find key support/resistance levels based on high OI strikes
 */
export function findKeyLevels(
  strikes: StrikeDataInput[],
  currentPrice: number,
  topN: number = 5
): { support: number[]; resistance: number[] } {
  // Strikes with high Put OI below current price = Support
  const putStrikes = strikes
    .filter((s) => s.strike < currentPrice && (s.putOi || 0) > 0)
    .sort((a, b) => (b.putOi || 0) - (a.putOi || 0))
    .slice(0, topN)
    .map((s) => s.strike);

  // Strikes with high Call OI above current price = Resistance
  const callStrikes = strikes
    .filter((s) => s.strike > currentPrice && (s.callOi || 0) > 0)
    .sort((a, b) => (b.callOi || 0) - (a.callOi || 0))
    .slice(0, topN)
    .map((s) => s.strike);

  return {
    support: putStrikes.sort((a, b) => b - a),
    resistance: callStrikes.sort((a, b) => a - b),
  };
}
