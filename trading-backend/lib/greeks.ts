/**
 * Greeks Calculation Module
 * 
 * Calculates Gamma Exposure (GEX) to identify Market Maker positioning.
 * 
 * Theory:
 * - Market Makers (MM) are usually short options (Short Volatility).
 * - To hedge, they must trade the underlying asset.
 * - Gamma tells us how much they need to trade when price moves.
 * 
 * - Positive GEX: MM buys when price drops, sells when price rises -> Stabilizes market (Mean Reversion).
 * - Negative GEX: MM sells when price drops, buys when price rises -> Accelerates moves (Trend Following).
 * - Zero Gamma Level: The flip point, often acts as a magnet.
 */

import { OptionStrike } from "./analysis";

// Standard Normal Cumulative Distribution Function
function cdf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2.0);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
}

// Standard Normal Probability Density Function
function pdf(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Calculate d1 for Black-Scholes
function calculateD1(S: number, K: number, T: number, r: number, sigma: number): number {
    return (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
}

// Calculate Gamma
function calculateGamma(S: number, K: number, T: number, r: number, sigma: number): number {
    if (T <= 0 || sigma <= 0) return 0;
    const d1 = calculateD1(S, K, T, r, sigma);
    return pdf(d1) / (S * sigma * Math.sqrt(T));
}

export interface GEXResult {
    totalGex: number;
    totalCallGex: number;
    totalPutGex: number;
    zeroGammaLevel: number | null;
    gexProfile: Array<{
        strike: number;
        gex: number;
        callGex: number;
        putGex: number;
    }>;
    interpretation: string;
}

/**
 * Calculate Gamma Exposure (GEX)
 * 
 * @param strikes Option strikes data
 * @param currentPrice Current underlying price
 * @param daysToExpiry Days until expiration (default 30 if unknown)
 * @param iv Implied Volatility (default 0.15 or 15% if unknown)
 */
export function calculateGEX(
    strikes: OptionStrike[],
    currentPrice: number,
    daysToExpiry: number = 30,
    iv: number = 0.15
): GEXResult {
    const r = 0.05; // Risk-free rate (5%)
    const T = Math.max(daysToExpiry / 365, 0.001); // Time in years
    const sigma = iv;

    let totalGex = 0;
    let totalCallGex = 0;
    let totalPutGex = 0;
    const gexProfile = [];

    // 1. Calculate GEX for each strike
    for (const s of strikes) {
        const K = s.strike_price;
        const gamma = calculateGamma(currentPrice, K, T, r, sigma);

        // Call GEX = Gamma * Call OI * SpotPrice * 100 (Contract Size)
        // We assume MM is Short Call -> Long Gamma (Wait, usually MM is Short Option -> Short Gamma?)
        // Convention:
        // - Call OI contributes POSITIVE GEX (MM Long Call / Short Future or MM Short Call / Long Future?)
        // Standard GEX Model:
        // - Calls: MM is Short Call -> MM is Short Gamma? NO.
        // - Standard assumption: Dealers are Long Calls and Short Puts? OR Dealers are Short Everything?

        // Let's use the standard SqueezeMetrics / SpotGamma convention:
        // - Dealer Long Call -> Positive Gamma
        // - Dealer Short Put -> Positive Gamma
        // BUT usually customers buy calls (Dealer Short Call -> Negative Gamma)
        // and customers buy puts (Dealer Short Put -> Positive Gamma? No, Dealer Short Put -> Positive Delta, Negative Gamma?)

        // Let's stick to the most common interpretation for "GEX Charts":
        // Call OI -> Positive GEX contribution (Dealers Long Calls to hedge?)
        // Put OI -> Negative GEX contribution (Dealers Short Puts?)

        // Actually, the widely accepted formula is:
        // GEX = Gamma * (Call OI - Put OI) * ContractSize * SpotPrice * 0.01

        // Let's refine:
        // If Customer Buys Call -> Dealer Shorts Call -> Dealer is Short Gamma (Negative GEX)
        // If Customer Buys Put -> Dealer Shorts Put -> Dealer is Short Gamma (Negative GEX)
        // Wait, this implies ALL OI is negative gamma? That's not right.

        // Re-evaluating standard convention (e.g. Tier1Alpha):
        // Call OI is treated as Positive Gamma (Dealers Long)
        // Put OI is treated as Negative Gamma (Dealers Short)
        // This is a simplification but works for identifying "Sticky" vs "Volatile" zones.

        // Formula: GEX = Gamma * (CallOI - PutOI) * Spot * 100

        const callGex = gamma * s.call_oi * currentPrice * 100;
        const putGex = gamma * s.put_oi * currentPrice * 100 * -1; // Put is negative

        const netGex = callGex + putGex;

        totalCallGex += callGex;
        totalPutGex += putGex;
        totalGex += netGex;

        gexProfile.push({
            strike: K,
            gex: netGex,
            callGex,
            putGex
        });
    }

    // 2. Find Zero Gamma Level (Flip Point)
    // Simple interpolation where GEX crosses 0
    let zeroGammaLevel: number | null = null;

    if (currentPrice > 0) {
        // Sort by strike just in case
        gexProfile.sort((a, b) => a.strike - b.strike);

        // Let's do a quick search around current price (+/- 10%)
        const searchRange = currentPrice * 0.1;
        const startPrice = currentPrice - searchRange;
        const endPrice = currentPrice + searchRange;
        const steps = 20;
        const stepSize = Math.max((endPrice - startPrice) / steps, 0.01); // Ensure stepSize is positive

        let minGexAbs = Infinity;
        let bestPrice = currentPrice;

        // Safety break to prevent infinite loops
        let iterations = 0;
        for (let p = startPrice; p <= endPrice; p += stepSize) {
            if (iterations++ > 100) break;

            let tempGex = 0;
            for (const s of strikes) {
                const g = calculateGamma(p, s.strike_price, T, r, sigma);
                tempGex += g * (s.call_oi - s.put_oi) * p * 100;
            }

            if (Math.abs(tempGex) < minGexAbs) {
                minGexAbs = Math.abs(tempGex);
                bestPrice = p;
            }
        }
        zeroGammaLevel = bestPrice;
    }

    // 3. Interpretation
    let interpretation = "";
    if (totalGex > 0) {
        interpretation = "Positive GEX: ตลาดมีความผันผวนต่ำ ราคาอาจแกว่งตัวในกรอบ (Mean Reversion)";
    } else {
        interpretation = "Negative GEX: ตลาดมีความผันผวนสูง ราคาอาจวิ่งแรงตามเทรนด์ (Trend Following)";
    }

    return {
        totalGex,
        totalCallGex,
        totalPutGex,
        zeroGammaLevel,
        gexProfile,
        interpretation
    };
}
