import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  analyzeWithAI,
  type AIProvider,
  type MarketDataForAI,
} from "@/lib/ai-analysis";
import { getAIConsensus } from "@/lib/ai-consensus";
import { runEnhancedAnalysis } from "@/lib/ai-enhanced-analysis";
import { getAccuracyStats, compareProviders } from "@/lib/ai-accuracy";
import {
  calculatePCR,
  calculateMaxPain,
  getLiquidityWalls,
  calculateVWAP,
  generateSignal,
  type OptionStrike,
  type MarketData,
} from "@/lib/analysis";
import { fetchXauSpotPrice, calculateSpread } from "@/lib/price-feed";
import { calculateGEX } from "@/lib/greeks";
import { getUpcomingEventsSummary } from "@/lib/economic-calendar";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// ============================================
// POST /api/ai-analyze - Get AI-powered analysis
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log("[API] Received AI Analysis Request");

  try {
    const body = await request.json().catch(() => ({}));
    const provider = (body.provider || "auto") as AIProvider;
    const mode = body.mode || "standard"; // "standard" | "enhanced" | "consensus"
    const trackPrediction = body.trackPrediction !== false;

    console.log(`[API] Mode: ${mode}, Provider: ${provider}`);

    // Get latest OI snapshot
    const oiSnapshot = await prisma.oiSnapshot.findFirst({
      orderBy: { extractedAt: "desc" },
      include: { strikes: { orderBy: { strike: "asc" } } },
    });

    if (!oiSnapshot) {
      return NextResponse.json(
        { success: false, error: "ไม่มีข้อมูล OI ในระบบ กรุณา Sync ข้อมูลก่อน" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get latest volume snapshot
    const volumeSnapshot = await prisma.intradayVolumeSnapshot.findFirst({
      orderBy: { extractedAt: "desc" },
      include: { strikes: { orderBy: { strike: "asc" } } },
    });

    // Get latest OI change snapshot
    const oiChangeSnapshot = await prisma.oiChangeSnapshot.findFirst({
      orderBy: { extractedAt: "desc" },
      include: { strikes: { orderBy: { strike: "asc" } } },
    });

    // Build OptionStrike array
    const strikeMap = new Map<number, OptionStrike>();

    // Add OI data
    for (const s of oiSnapshot.strikes) {
      strikeMap.set(s.strike, {
        strike_price: s.strike,
        call_oi: s.callOi || 0,
        put_oi: s.putOi || 0,
        call_volume: 0,
        put_volume: 0,
        call_oi_change: 0,
        put_oi_change: 0,
      });
    }

    // Add volume data
    if (volumeSnapshot) {
      for (const s of volumeSnapshot.strikes) {
        const existing = strikeMap.get(s.strike);
        if (existing) {
          existing.call_volume = s.callVol || 0;
          existing.put_volume = s.putVol || 0;
        } else {
          strikeMap.set(s.strike, {
            strike_price: s.strike,
            call_oi: 0,
            put_oi: 0,
            call_volume: s.callVol || 0,
            put_volume: s.putVol || 0,
            call_oi_change: 0,
            put_oi_change: 0,
          });
        }
      }
    }

    // Add OI change data
    if (oiChangeSnapshot) {
      for (const s of oiChangeSnapshot.strikes) {
        const existing = strikeMap.get(s.strike);
        if (existing) {
          existing.call_oi_change = s.callChange || 0;
          existing.put_oi_change = s.putChange || 0;
        }
      }
    }

    const optionStrikes = Array.from(strikeMap.values()).sort(
      (a, b) => a.strike_price - b.strike_price
    );

    const currentPrice = oiSnapshot.futurePrice || 0;

    // Calculate analytics
    const pcr = calculatePCR(optionStrikes, currentPrice);
    const maxPain = calculateMaxPain(optionStrikes, currentPrice);
    const walls = getLiquidityWalls(optionStrikes);
    const vwap = calculateVWAP(optionStrikes);

    // Get XAU spot price
    let xauSpot: number | null = null;
    let spread: number | null = null;

    try {
      const xauData = await fetchXauSpotPrice();
      if (xauData.price > 0) {
        xauSpot = xauData.price;
        spread = calculateSpread(currentPrice, xauSpot).spread;
      }
    } catch {
      console.warn("Could not fetch XAU price");
    }

    // Calculate OI flow
    let netOiChange = 0;
    let callOiChange = 0;
    let putOiChange = 0;

    for (const strike of optionStrikes) {
      callOiChange += strike.call_oi_change;
      putOiChange += strike.put_oi_change;
    }
    netOiChange = callOiChange - putOiChange;

    // Get hot strikes by volume
    const hotStrikes = optionStrikes
      .map((s) => ({
        strike: s.strike_price,
        volume: s.call_volume + s.put_volume,
        type: (s.call_volume > s.put_volume
          ? "call"
          : s.put_volume > s.call_volume
            ? "put"
            : "mixed") as "call" | "put" | "mixed",
      }))
      .filter((s) => s.volume > 0)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);

    // Get system signal
    const marketData: MarketData = {
      current_price: currentPrice,
      vwap,
      strikes: optionStrikes,
    };
    const systemSignal = generateSignal(marketData);

    // Calculate GEX
    console.log("[API] Calculating GEX...");
    const gex = calculateGEX(optionStrikes, currentPrice);
    console.log("[API] GEX Calculated");

    // Get Economic Events
    console.log("[API] Fetching Economic Events...");
    const economicEvents = await getUpcomingEventsSummary();
    console.log("[API] Economic Events Fetched");

    // Build data for AI
    const aiData: MarketDataForAI = {
      cme_futures_price: currentPrice,
      xau_spot_price: xauSpot,
      spread,
      oi_pcr: pcr.oi_pcr,
      volume_pcr: pcr.volume_pcr,
      max_pain: maxPain.max_pain_strike,
      call_wall: walls.resistance.strike,
      put_wall: walls.support.strike,
      net_oi_change: netOiChange,
      call_oi_change: callOiChange,
      put_oi_change: putOiChange,
      total_call_volume: optionStrikes.reduce((sum, s) => sum + s.call_volume, 0),
      total_put_volume: optionStrikes.reduce((sum, s) => sum + s.put_volume, 0),
      hot_strikes: hotStrikes,
      vwap,
      system_signal: systemSignal.signal,
      system_confidence: systemSignal.score,
      data_timestamp: new Date(oiSnapshot.extractedAt).toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
      }),
      // Advanced Analysis
      gex: {
        totalGex: gex.totalGex,
        zeroGammaLevel: gex.zeroGammaLevel,
        interpretation: gex.interpretation,
      },
      economic_events: {
        tradingCaution: economicEvents.tradingCaution,
        warnings: economicEvents.warnings,
        upcomingHighImpact: economicEvents.today
          .filter((e) => e.impact === "HIGH")
          .map((e) => `${e.time} ET: ${e.titleTh}`),
      },
    };

    // Call AI for analysis based on mode
    if (mode === "enhanced") {
      console.log("[API] Starting Enhanced Analysis...");

      // Enhanced mode with technical indicators, historical context, economic calendar
      const enhancedResult = await runEnhancedAnalysis(aiData, {
        useConsensus: false,
        provider,
        trackPrediction,
      });

      console.log("[API] Enhanced Analysis Completed");

      return NextResponse.json(
        {
          success: true,
          mode: "enhanced",
          analysis: enhancedResult.analysis,
          tradingRecommendation: enhancedResult.tradingRecommendation,
          technicals: enhancedResult.enhancedData.technicals,
          historicalContext: enhancedResult.enhancedData.historicalContext.summary,
          economicEvents: enhancedResult.enhancedData.economicEvents.warnings,
          isSafeToTrade: enhancedResult.enhancedData.isSafeToTrade,
          predictionId: enhancedResult.predictionId,
          input_data: aiData,
          processing_time_ms: Date.now() - startTime,
          generated_at: new Date().toISOString(),
        },
        { headers: corsHeaders }
      );
    } else if (mode === "consensus") {
      // Multi-AI Consensus mode
      const consensusResult = await getAIConsensus(aiData);

      return NextResponse.json(
        {
          success: true,
          mode: "consensus",
          consensus: consensusResult.consensus,
          confidence: consensusResult.consensus_confidence,
          agreement: consensusResult.agreement_level,
          votes: consensusResult.votes,
          entry: consensusResult.suggested_entry,
          stopLoss: consensusResult.suggested_sl,
          takeProfit1: consensusResult.suggested_tp1,
          takeProfit2: consensusResult.suggested_tp2,
          summary: consensusResult.summary,
          warnings: consensusResult.warnings,
          individual_results: consensusResult.results,
          providers_used: consensusResult.providers_used,
          providers_failed: consensusResult.providers_failed,
          input_data: aiData,
          processing_time_ms: Date.now() - startTime,
          generated_at: new Date().toISOString(),
        },
        { headers: corsHeaders }
      );
    } else {
      // Standard mode - single AI provider
      const aiResult = await analyzeWithAI(aiData, provider);

      return NextResponse.json(
        {
          success: true,
          mode: "standard",
          analysis: aiResult,
          input_data: aiData,
          processing_time_ms: Date.now() - startTime,
          generated_at: new Date().toISOString(),
        },
        { headers: corsHeaders }
      );
    }
  } catch (error) {
    console.error("AI Analysis error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Check for common errors
    if (errorMessage.includes("API key")) {
      return NextResponse.json(
        {
          success: false,
          error: "ยังไม่ได้ตั้งค่า AI API Key",
          suggestion: "เพิ่ม OPENAI_API_KEY หรือ GEMINI_API_KEY ใน .env",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        processing_time_ms: Date.now() - startTime,
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// ============================================
// GET /api/ai-analyze - Check AI availability
// ============================================

export async function GET() {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;

  const hasAny = hasOpenAI || hasGemini || hasDeepSeek;

  // Determine preferred provider (DeepSeek is cheapest)
  let preferred = null;
  if (hasDeepSeek) preferred = "deepseek";
  else if (hasGemini) preferred = "gemini";
  else if (hasOpenAI) preferred = "openai";

  // Get accuracy stats
  let accuracyStats = null;
  let bestProvider = null;

  try {
    accuracyStats = await getAccuracyStats();
    const comparison = await compareProviders();
    bestProvider = comparison.bestProvider;
  } catch {
    // Stats not available yet
  }

  return NextResponse.json(
    {
      success: true,
      available: hasAny,
      providers: {
        openai: hasOpenAI,
        gemini: hasGemini,
        deepseek: hasDeepSeek,
      },
      preferred,
      bestProvider,
      accuracyStats,
      modes: ["standard", "enhanced", "consensus"],
      features: {
        technicalIndicators: true,
        historicalContext: true,
        economicCalendar: true,
        multiAIConsensus: hasAny && Object.values({ hasOpenAI, hasGemini, hasDeepSeek }).filter(Boolean).length >= 2,
        accuracyTracking: true,
      },
      message: hasAny
        ? "AI Analysis พร้อมใช้งาน"
        : "กรุณาเพิ่ม DEEPSEEK_API_KEY, GEMINI_API_KEY หรือ OPENAI_API_KEY ใน .env",
    },
    { headers: corsHeaders }
  );
}
