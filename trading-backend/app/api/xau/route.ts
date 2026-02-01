import { NextRequest, NextResponse } from "next/server";
import {
  fetchXauSpotPrice,
  calculateSpread,
  convertLevelsToXau,
  getTradingZones,
  getSpreadStatus,
  type SpotPrice,
  type SpreadInfo,
  type ConvertedLevels,
} from "@/lib/price-feed";
import prisma from "@/lib/db";
import { getLiquidityWalls, calculateMaxPain, type OptionStrike } from "@/lib/analysis";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// ============================================
// GET /api/xau - Get XAU spot price and converted levels
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeLevels = searchParams.get("levels") !== "false";
    const product = searchParams.get("product");

    // Fetch XAU spot price (tries multiple sources automatically)
    const xauPrice: SpotPrice = await fetchXauSpotPrice();

    // Get CME Futures price from latest OI snapshot
    let spreadInfo: SpreadInfo | null = null;
    let convertedLevels: ConvertedLevels | null = null;
    let tradingZones = null;

    if (includeLevels) {
      const where = product ? { product } : {};
      
      // Get latest OI snapshot for CME levels
      const oiSnapshot = await prisma.oiSnapshot.findFirst({
        where,
        orderBy: { extractedAt: "desc" },
        include: { strikes: { orderBy: { strike: "asc" } } },
      });

      if (oiSnapshot && oiSnapshot.futurePrice) {
        // Calculate spread
        spreadInfo = calculateSpread(oiSnapshot.futurePrice, xauPrice.price);
        
        // Convert strikes to OptionStrike format for analysis
        const optionStrikes: OptionStrike[] = oiSnapshot.strikes.map(s => ({
          strike_price: s.strike,
          call_oi: s.callOi || 0,
          put_oi: s.putOi || 0,
          call_volume: 0,
          put_volume: 0,
          call_oi_change: 0,
          put_oi_change: 0,
        }));

        // Get walls and max pain
        const walls = getLiquidityWalls(optionStrikes);
        const maxPain = calculateMaxPain(optionStrikes, oiSnapshot.futurePrice);

        // Get support/resistance levels
        const supportLevels = walls.support_levels.map(l => l.strike);
        const resistanceLevels = walls.resistance_levels.map(l => l.strike);

        // Convert to XAU levels
        convertedLevels = convertLevelsToXau(
          {
            put_wall: walls.support.strike,
            call_wall: walls.resistance.strike,
            max_pain: maxPain.max_pain_strike,
            support_levels: supportLevels,
            resistance_levels: resistanceLevels,
          },
          spreadInfo.spread,
          xauPrice.price
        );

        // Get trading zones
        tradingZones = getTradingZones(convertedLevels, xauPrice.price);
      }
    }

    // Build response
    const response = {
      success: true,
      xau: {
        symbol: xauPrice.symbol,
        price: xauPrice.price,
        change: xauPrice.change,
        changePercent: xauPrice.changePercent,
        previousClose: xauPrice.previousClose,
        timestamp: xauPrice.timestamp.toISOString(),
        source: xauPrice.source,
      },
      spread: spreadInfo ? {
        futures_price: spreadInfo.futures_price,
        spot_price: spreadInfo.spot_price,
        spread: spreadInfo.spread,
        spread_percent: spreadInfo.spread_percent,
        status: getSpreadStatus(spreadInfo.spread),
        updated_at: spreadInfo.updated_at.toISOString(),
      } : null,
      levels: convertedLevels,
      trading_zones: tradingZones,
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json(response, { 
      headers: {
        ...corsHeaders,
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Error fetching XAU data:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch XAU price",
        suggestion: "ลองใหม่อีกครั้ง หรือตรวจสอบการเชื่อมต่ออินเทอร์เน็ต",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// ============================================
// POST /api/xau - Manual XAU price input (for backup)
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { xau_price, cme_price } = body;

    if (!xau_price || typeof xau_price !== "number" || xau_price <= 0) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุราคา XAU ที่ถูกต้อง" },
        { status: 400, headers: corsHeaders }
      );
    }

    // OPTIMIZATION: Start database query early, await later (async-api-routes rule)
    // This prevents waterfall - query starts immediately while we process other logic
    const oiSnapshotPromise = prisma.oiSnapshot.findFirst({
      orderBy: { extractedAt: "desc" },
      include: { strikes: { orderBy: { strike: "asc" } } },
    });

    // If CME price provided, use it; otherwise we'll get from snapshot
    let futuresPrice = cme_price;
    
    // Await snapshot - we need it for both price fallback and levels
    const oiSnapshot = await oiSnapshotPromise;
    
    if (!futuresPrice) {
      futuresPrice = oiSnapshot?.futurePrice || 0;
    }

    if (!futuresPrice) {
      return NextResponse.json(
        { success: false, error: "ไม่พบราคา CME Futures กรุณา Sync ข้อมูลก่อน" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Calculate spread
    const spreadInfo = calculateSpread(futuresPrice, xau_price);

    // oiSnapshot already fetched above - no duplicate query needed

    let convertedLevels: ConvertedLevels | null = null;
    let tradingZones = null;

    if (oiSnapshot) {
      const optionStrikes: OptionStrike[] = oiSnapshot.strikes.map(s => ({
        strike_price: s.strike,
        call_oi: s.callOi || 0,
        put_oi: s.putOi || 0,
        call_volume: 0,
        put_volume: 0,
        call_oi_change: 0,
        put_oi_change: 0,
      }));

      const walls = getLiquidityWalls(optionStrikes);
      const maxPain = calculateMaxPain(optionStrikes, futuresPrice);

      convertedLevels = convertLevelsToXau(
        {
          put_wall: walls.support.strike,
          call_wall: walls.resistance.strike,
          max_pain: maxPain.max_pain_strike,
          support_levels: walls.support_levels.map(l => l.strike),
          resistance_levels: walls.resistance_levels.map(l => l.strike),
        },
        spreadInfo.spread,
        xau_price
      );

      tradingZones = getTradingZones(convertedLevels, xau_price);
    }

    return NextResponse.json({
      success: true,
      xau: {
        symbol: "XAU/USD",
        price: xau_price,
        source: "Manual Input",
        timestamp: new Date().toISOString(),
      },
      spread: {
        futures_price: spreadInfo.futures_price,
        spot_price: spreadInfo.spot_price,
        spread: spreadInfo.spread,
        spread_percent: spreadInfo.spread_percent,
        status: getSpreadStatus(spreadInfo.spread),
      },
      levels: convertedLevels,
      trading_zones: tradingZones,
      generated_at: new Date().toISOString(),
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("Error processing manual XAU input:", error);
    
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดในการคำนวณ" },
      { status: 500, headers: corsHeaders }
    );
  }
}
