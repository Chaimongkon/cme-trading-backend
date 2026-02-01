import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  getLiquidityWalls,
  calculatePCR,
  calculateMaxPain,
  generateSignal,
  calculateVWAP,
  type OptionStrike,
  type MarketData,
} from "@/lib/analysis";
import {
  NoDataError,
  DatabaseError,
  formatErrorResponse,
  isAppError,
} from "@/lib/errors";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// ============================================
// Internal Types for DB -> Analysis conversion
// ============================================

interface InternalStrike {
  strike: number;
  callOi: number;
  putOi: number;
  callVolume: number;
  putVolume: number;
  callOiChange: number;
  putOiChange: number;
  volSettle: number | null;
  range: string | null;
}

// ============================================
// API Handler
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const product = searchParams.get("product");
    const dateParam = searchParams.get("date");

    // Build where clause
    const where: any = product ? { product } : {};

    // Date filtering
    if (dateParam) {
      const startOfDay = new Date(dateParam);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(dateParam);
      endOfDay.setHours(23, 59, 59, 999);

      if (!isNaN(startOfDay.getTime())) {
        where.extractedAt = {
          gte: startOfDay,
          lte: endOfDay,
        };
      }
    }

    // Fetch latest data from all 3 tables in parallel
    const [volumeSnapshot, oiSnapshot, oiChangeSnapshot] = await Promise.all([
      prisma.intradayVolumeSnapshot.findFirst({
        where,
        orderBy: { extractedAt: "desc" },
        include: { strikes: { orderBy: { strike: "asc" } } },
      }),
      prisma.oiSnapshot.findFirst({
        where,
        orderBy: { extractedAt: "desc" },
        include: { strikes: { orderBy: { strike: "asc" } } },
      }),
      prisma.oiChangeSnapshot.findFirst({
        where,
        orderBy: { extractedAt: "desc" },
        include: { strikes: { orderBy: { strike: "asc" } } },
      }),
    ]);

    // Need at least OI data
    if (!oiSnapshot) {
      throw new NoDataError("ข้อมูล OI", { product });
    }

    // Find the most recent snapshot for current price
    // Use the snapshot with the latest extractedAt timestamp
    const allSnapshots = [
      volumeSnapshot ? { source: 'volume', snapshot: volumeSnapshot, price: volumeSnapshot.futurePrice } : null,
      oiSnapshot ? { source: 'oi', snapshot: oiSnapshot, price: oiSnapshot.futurePrice } : null,
      oiChangeSnapshot ? { source: 'oichange', snapshot: oiChangeSnapshot, price: oiChangeSnapshot.futurePrice } : null,
    ].filter(Boolean) as Array<{ source: string; snapshot: any; price: number | null }>;
    
    // Sort by extractedAt descending to get most recent
    allSnapshots.sort((a, b) => 
      new Date(b.snapshot.extractedAt).getTime() - new Date(a.snapshot.extractedAt).getTime()
    );
    
    // Use the most recent snapshot with a valid price
    const latestWithPrice = allSnapshots.find(s => s.price && s.price > 0);
    const currentPrice = latestWithPrice?.price || oiSnapshot.futurePrice || 0;
    
    // Use OI snapshot for metadata (product, expiry) but price from latest
    const primarySource = oiSnapshot;
    
    console.log('[API Analysis] Price source:', latestWithPrice?.source || 'oi', 'Price:', currentPrice);

    // Merge data from all sources into unified strike format
    const strikeMap = new Map<number, InternalStrike>();

    // Initialize with OI data (primary)
    for (const s of oiSnapshot.strikes) {
      strikeMap.set(s.strike, {
        strike: s.strike,
        callOi: s.callOi || 0,
        putOi: s.putOi || 0,
        callVolume: 0,
        putVolume: 0,
        callOiChange: 0,
        putOiChange: 0,
        volSettle: s.volSettle,
        range: s.range,
      });
    }

    // Add volume data
    if (volumeSnapshot) {
      for (const s of volumeSnapshot.strikes) {
        const existing = strikeMap.get(s.strike);
        if (existing) {
          existing.callVolume = s.callVol || 0;
          existing.putVolume = s.putVol || 0;
        } else {
          strikeMap.set(s.strike, {
            strike: s.strike,
            callOi: 0,
            putOi: 0,
            callVolume: s.callVol || 0,
            putVolume: s.putVol || 0,
            callOiChange: 0,
            putOiChange: 0,
            volSettle: s.volSettle,
            range: s.range,
          });
        }
      }
    }

    // Add OI change data
    if (oiChangeSnapshot) {
      for (const s of oiChangeSnapshot.strikes) {
        const existing = strikeMap.get(s.strike);
        if (existing) {
          existing.callOiChange = s.callChange || 0;
          existing.putOiChange = s.putChange || 0;
        }
      }
    }

    // Convert to sorted array
    const internalStrikes = Array.from(strikeMap.values()).sort((a, b) => a.strike - b.strike);

    // Convert to OptionStrike format for analysis functions
    const optionStrikes: OptionStrike[] = internalStrikes.map((s) => ({
      strike_price: s.strike,
      call_oi: s.callOi,
      put_oi: s.putOi,
      call_volume: s.callVolume,
      put_volume: s.putVolume,
      call_oi_change: s.callOiChange,
      put_oi_change: s.putOiChange,
    }));

    // ============================================
    // Run Analysis using lib/analysis.ts
    // ============================================

    // 1. Liquidity Walls (Support/Resistance)
    const walls = getLiquidityWalls(optionStrikes);

    // 2. PCR Analysis
    const pcr = calculatePCR(optionStrikes, currentPrice);

    // 3. Max Pain
    const maxPain = calculateMaxPain(optionStrikes, currentPrice);

    // 4. VWAP
    const vwap = calculateVWAP(optionStrikes);

    // 5. Generate Signal
    const marketData: MarketData = {
      current_price: currentPrice,
      vwap: vwap,
      strikes: optionStrikes,
    };
    const signal = generateSignal(marketData);

    // ============================================
    // Build Response
    // ============================================

    // OPTIMIZATION: Combined array iterations (js-combine-iterations rule)
    // Previously had 4 separate reduce calls, now combined into single loop
    let totalCallChange = 0;
    let totalPutChange = 0;
    let totalPutVol = 0;
    let totalCallVol = 0;
    
    for (const s of internalStrikes) {
      totalCallChange += s.callOiChange;
      totalPutChange += s.putOiChange;
      totalPutVol += s.putVolume;
      totalCallVol += s.callVolume;
    }
    
    const netOiChange = totalCallChange + totalPutChange;

    let oiFlowSignal: "BULLISH" | "BEARISH" | "NEUTRAL" | "REVERSAL" = "NEUTRAL";
    let oiFlowInterpretation = "";
    const priceUp = totalCallChange > totalPutChange;
    const oiIncreasing = netOiChange > 0;

    if (oiIncreasing && priceUp) {
      oiFlowSignal = "BULLISH";
      oiFlowInterpretation = "OI เพิ่ม + Call > Put = เงินใหม่ไหลเข้าซื้อ (Strong Buy)";
    } else if (oiIncreasing && !priceUp) {
      oiFlowSignal = "BEARISH";
      oiFlowInterpretation = "OI เพิ่ม + Put > Call = เงินใหม่ไหลเข้าขาย (Strong Sell)";
    } else if (!oiIncreasing && priceUp) {
      oiFlowSignal = "REVERSAL";
      oiFlowInterpretation = "OI ลด + Call > Put = Short Covering (ระวังกลับตัว)";
    } else if (!oiIncreasing && !priceUp) {
      oiFlowSignal = "REVERSAL";
      oiFlowInterpretation = "OI ลด + Put > Call = Long Liquidation (ใกล้จบขาลง)";
    } else {
      oiFlowInterpretation = "ไม่มีสัญญาณชัดเจน";
    }

    // Volume analysis (totals already calculated above)

    const hotStrikes = [...internalStrikes]
      .map((s) => ({
        strike: s.strike,
        totalVolume: s.putVolume + s.callVolume,
        putVolume: s.putVolume,
        callVolume: s.callVolume,
        isNearPrice: Math.abs(s.strike - currentPrice) <= currentPrice * 0.02,
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 5);

    let volumeSkew: "PUT_HEAVY" | "CALL_HEAVY" | "BALANCED" = "BALANCED";
    const skewRatio = totalCallVol > 0 ? totalPutVol / totalCallVol : 1;
    if (skewRatio > 1.2) volumeSkew = "PUT_HEAVY";
    else if (skewRatio < 0.8) volumeSkew = "CALL_HEAVY";

    // Build full response
    // Use the most recent extractedAt from all snapshots
    const latestExtractedAt = allSnapshots[0]?.snapshot.extractedAt || primarySource.extractedAt;
    
    const analysis = {
      marketData: {
        product: primarySource.product,
        expiry: primarySource.expiry,
        currentPrice,
        extractedAt: latestExtractedAt.toISOString(),
        strikesCount: internalStrikes.length,
      },
      // From lib/analysis.ts
      walls: {
        support: walls.support,
        resistance: walls.resistance,
        supportLevels: walls.support_levels,
        resistanceLevels: walls.resistance_levels,
      },
      pcr: {
        oiPcr: pcr.oi_pcr,
        oiPcrSignal: pcr.signal,
        volumePcr: pcr.volume_pcr,
        volumePcrSignal: pcr.signal,
        atmPcr: pcr.atm_pcr,
        atmPcrSignal: pcr.signal,
        totals: pcr.totals,
      },
      maxPain: {
        maxPainStrike: maxPain.max_pain_strike,
        distanceFromPrice: maxPain.distance_from_price,
        distancePercent: maxPain.distance_percent,
        signal: maxPain.signal,
        description: maxPain.description,
      },
      vwap,
      // Signal from lib/analysis.ts
      signal: {
        type: signal.signal,
        strength: Math.ceil(signal.score / 20), // 0-100 -> 1-5 scale
        confidence: signal.score, // 0-100 confidence
        score: signal.score,
        sentiment: signal.sentiment,
        reason: signal.reason,
        summary: signal.summary,
        factors: signal.breakdown,
        positiveFactors: signal.factors.positive,
        negativeFactors: signal.factors.negative,
        factorScores: signal.factor_scores,
        keyLevels: signal.key_levels,
      },
      // Key levels (from walls)
      keyLevels: {
        support: walls.support_levels.map((s, i) => ({
          strike: s.strike,
          putOi: s.put_oi,
          strength: (3 - i) as 1 | 2 | 3,
        })),
        resistance: walls.resistance_levels.map((s, i) => ({
          strike: s.strike,
          callOi: s.call_oi,
          strength: (3 - i) as 1 | 2 | 3,
        })),
      },
      // OI Flow (compatibility)
      oiFlow: {
        netOiChange,
        callFlow: totalCallChange,
        putFlow: totalPutChange,
        signal: oiFlowSignal,
        interpretation: oiFlowInterpretation,
      },
      // Volume (compatibility)
      volume: {
        hotStrikes,
        vwap: Math.round(vwap * 100) / 100,
        volumeSkew,
      },
      // Raw strike data for charts
      strikeData: internalStrikes,
    };

    return NextResponse.json(
      {
        success: true,
        analysis,
        // Legacy compatibility fields
        currentSnapshot: {
          id: oiSnapshot.id,
          product: oiSnapshot.product,
          expiry: oiSnapshot.expiry,
          futurePrice: currentPrice,
          extractedAt: oiSnapshot.extractedAt,
          strikesCount: internalStrikes.length,
        },
        // Chart data format
        intradayData: volumeSnapshot?.strikes.map((s) => ({
          strike: s.strike,
          put: s.putVol,
          call: s.callVol,
          volSettle: s.volSettle,
          range: s.range,
        })),
        intradaySummary: volumeSnapshot ? {
          put: volumeSnapshot.totalPut || 0,
          call: volumeSnapshot.totalCall || 0,
          vol: volumeSnapshot.vol || 0,
          volChg: volumeSnapshot.volChg || 0,
          futureChg: volumeSnapshot.futureChg || 0,
        } : undefined,
        generatedAt: new Date().toISOString(),
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error running analysis:", error);

    // Use custom error formatting
    const statusCode = isAppError(error) ? error.statusCode : 500;

    return NextResponse.json(
      formatErrorResponse(error),
      { status: statusCode, headers: corsHeaders }
    );
  }
}
