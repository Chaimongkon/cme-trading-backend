import { NextRequest, NextResponse } from "next/server";
import {
  getLiquidityWalls,
  calculatePCR,
  calculateMaxPain,
  generateSignal,
  calculateVWAP,
  quickAnalysis,
  type OptionStrike,
  type MarketData,
  type LiquidityWalls,
  type PCRResult,
  type MaxPainResult,
  type TradingSignal,
} from "@/lib/analysis";

// ============================================
// CORS Headers
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// ============================================
// Request/Response Types
// ============================================

/**
 * Request body for POST /api/analyze
 */
interface AnalyzeRequest {
  /** Current market price */
  current_price: number;
  /** Volume Weighted Average Price (optional - will be calculated if not provided) */
  vwap?: number;
  /** Array of option strike data */
  strikes: Array<{
    strike_price: number;
    call_oi: number;
    put_oi: number;
    call_volume: number;
    put_volume: number;
    call_oi_change?: number;
    put_oi_change?: number;
  }>;
  /** Optional metadata */
  metadata?: {
    product?: string;
    expiry?: string;
    timestamp?: string;
  };
}

/**
 * Response from POST /api/analyze
 */
interface AnalyzeResponse {
  success: boolean;
  data?: {
    /** Market context */
    market: {
      current_price: number;
      vwap: number;
      strikes_count: number;
    };
    /** Liquidity walls - key support/resistance levels */
    walls: LiquidityWalls;
    /** Put/Call Ratio analysis */
    pcr: PCRResult;
    /** Max Pain calculation */
    max_pain: MaxPainResult;
    /** Trading signal with enhanced structure */
    signal: TradingSignal;
    /** Quick summary for display */
    summary: {
      signal: "BUY" | "SELL" | "NEUTRAL";
      score: number;
      sentiment: "Bullish" | "Bearish" | "Sideway";
      factors: {
        positive: string[];
        negative: string[];
      };
      key_levels: {
        max_pain: number;
        call_wall: number;
        put_wall: number;
        significant_strikes: number[];
      };
    };
  };
  error?: string;
  generated_at: string;
}

// ============================================
// Validation
// ============================================

function validateRequest(body: unknown): { valid: boolean; error?: string; data?: AnalyzeRequest } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const req = body as Record<string, unknown>;

  // Validate current_price
  if (typeof req.current_price !== "number" || req.current_price <= 0) {
    return { valid: false, error: "current_price must be a positive number" };
  }

  // Validate strikes array
  if (!Array.isArray(req.strikes) || req.strikes.length === 0) {
    return { valid: false, error: "strikes must be a non-empty array" };
  }

  // Validate each strike
  for (let i = 0; i < req.strikes.length; i++) {
    const strike = req.strikes[i] as Record<string, unknown>;
    
    if (typeof strike.strike_price !== "number") {
      return { valid: false, error: `strikes[${i}].strike_price must be a number` };
    }
    if (typeof strike.call_oi !== "number") {
      return { valid: false, error: `strikes[${i}].call_oi must be a number` };
    }
    if (typeof strike.put_oi !== "number") {
      return { valid: false, error: `strikes[${i}].put_oi must be a number` };
    }
    if (typeof strike.call_volume !== "number") {
      return { valid: false, error: `strikes[${i}].call_volume must be a number` };
    }
    if (typeof strike.put_volume !== "number") {
      return { valid: false, error: `strikes[${i}].put_volume must be a number` };
    }
  }

  return { valid: true, data: req as unknown as AnalyzeRequest };
}

// ============================================
// POST /api/analyze - Analyze raw JSON data
// ============================================

/**
 * POST /api/analyze
 * 
 * Receives raw option chain data and returns comprehensive analysis.
 * 
 * @example Request:
 * ```json
 * {
 *   "current_price": 2750.5,
 *   "strikes": [
 *     {
 *       "strike_price": 2700,
 *       "call_oi": 1234,
 *       "put_oi": 5678,
 *       "call_volume": 100,
 *       "put_volume": 200,
 *       "call_oi_change": 50,
 *       "put_oi_change": -30
 *     }
 *   ],
 *   "metadata": {
 *     "product": "Gold (OG|GC)",
 *     "expiry": "Feb 2026"
 *   }
 * }
 * ```
 * 
 * @example Response:
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "signal": {
 *       "signal": "BUY",
 *       "score": 4,
 *       "confidence": 72,
 *       "reason": "Multiple bullish factors aligned"
 *     },
 *     "walls": { ... },
 *     "pcr": { ... },
 *     "max_pain": { ... }
 *   }
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON in request body",
          generated_at: new Date().toISOString(),
        } as AnalyzeResponse,
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
          generated_at: new Date().toISOString(),
        } as AnalyzeResponse,
        { status: 400, headers: corsHeaders }
      );
    }

    const req = validation.data;

    // Convert to OptionStrike format
    const optionStrikes: OptionStrike[] = req.strikes.map((s) => ({
      strike_price: s.strike_price,
      call_oi: s.call_oi,
      put_oi: s.put_oi,
      call_volume: s.call_volume,
      put_volume: s.put_volume,
      call_oi_change: s.call_oi_change || 0,
      put_oi_change: s.put_oi_change || 0,
    }));

    // Calculate VWAP if not provided
    const vwap = req.vwap && req.vwap > 0 ? req.vwap : calculateVWAP(optionStrikes);

    // Build MarketData
    const marketData: MarketData = {
      current_price: req.current_price,
      vwap,
      strikes: optionStrikes,
    };

    // ============================================
    // Run Analysis using lib/analysis.ts
    // ============================================

    // 1. Liquidity Walls
    const walls = getLiquidityWalls(optionStrikes);

    // 2. PCR Analysis
    const pcr = calculatePCR(optionStrikes, req.current_price);

    // 3. Max Pain
    const maxPain = calculateMaxPain(optionStrikes, req.current_price);

    // 4. Generate Signal
    const signal = generateSignal(marketData);

    // ============================================
    // Build Response
    // ============================================

    const response: AnalyzeResponse = {
      success: true,
      data: {
        market: {
          current_price: req.current_price,
          vwap: Math.round(vwap * 100) / 100,
          strikes_count: optionStrikes.length,
        },
        walls,
        pcr,
        max_pain: maxPain,
        signal,
        summary: {
          signal: signal.signal,
          score: signal.score,
          sentiment: signal.sentiment,
          factors: signal.factors,
          key_levels: signal.key_levels,
        },
      },
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json(response, { headers: corsHeaders });

  } catch (error) {
    console.error("Error in /api/analyze:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        generated_at: new Date().toISOString(),
      } as AnalyzeResponse,
      { status: 500, headers: corsHeaders }
    );
  }
}

// ============================================
// GET /api/analyze - Documentation
// ============================================

/**
 * GET /api/analyze
 * 
 * Returns API documentation and example usage.
 */
export async function GET() {
  const documentation = {
    endpoint: "/api/analyze",
    method: "POST",
    description: "Analyze raw option chain data and generate trading signals",
    content_type: "application/json",
    request_schema: {
      current_price: {
        type: "number",
        required: true,
        description: "Current market price of the underlying asset",
      },
      vwap: {
        type: "number",
        required: false,
        description: "Volume Weighted Average Price (calculated if not provided)",
      },
      strikes: {
        type: "array",
        required: true,
        description: "Array of option strike data",
        items: {
          strike_price: { type: "number", required: true },
          call_oi: { type: "number", required: true, description: "Call Open Interest" },
          put_oi: { type: "number", required: true, description: "Put Open Interest" },
          call_volume: { type: "number", required: true, description: "Call Volume" },
          put_volume: { type: "number", required: true, description: "Put Volume" },
          call_oi_change: { type: "number", required: false, description: "Call OI Change" },
          put_oi_change: { type: "number", required: false, description: "Put OI Change" },
        },
      },
      metadata: {
        type: "object",
        required: false,
        properties: {
          product: { type: "string", description: "Product name" },
          expiry: { type: "string", description: "Expiry date" },
          timestamp: { type: "string", description: "Data timestamp" },
        },
      },
    },
    response_schema: {
      success: { type: "boolean" },
      data: {
        market: { description: "Market context (price, vwap, count)" },
        walls: { description: "Liquidity walls - support/resistance levels" },
        pcr: { description: "Put/Call Ratio analysis" },
        max_pain: { description: "Max Pain calculation" },
        signal: {
          description: "Trading signal",
          properties: {
            signal: "BUY | SELL | NEUTRAL",
            score: "1-5 (5 = strongest)",
            confidence: "0-100%",
            reason: "Human-readable explanation",
            breakdown: "Array of factor explanations",
          },
        },
        summary: { description: "Quick summary for display" },
      },
      error: { type: "string", description: "Error message if success=false" },
      generated_at: { type: "string", description: "ISO timestamp" },
    },
    example_request: {
      current_price: 2750.5,
      strikes: [
        {
          strike_price: 2700,
          call_oi: 1234,
          put_oi: 5678,
          call_volume: 100,
          put_volume: 200,
          call_oi_change: 50,
          put_oi_change: -30,
        },
        {
          strike_price: 2750,
          call_oi: 3456,
          put_oi: 2345,
          call_volume: 250,
          put_volume: 180,
          call_oi_change: 100,
          put_oi_change: 50,
        },
        {
          strike_price: 2800,
          call_oi: 4567,
          put_oi: 1234,
          call_volume: 300,
          put_volume: 100,
          call_oi_change: -20,
          put_oi_change: 10,
        },
      ],
      metadata: {
        product: "Gold (OG|GC)",
        expiry: "Feb 2026",
      },
    },
    example_curl: `curl -X POST ${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/analyze \\
  -H "Content-Type: application/json" \\
  -d '{
    "current_price": 2750.5,
    "strikes": [
      {"strike_price": 2700, "call_oi": 1234, "put_oi": 5678, "call_volume": 100, "put_volume": 200},
      {"strike_price": 2750, "call_oi": 3456, "put_oi": 2345, "call_volume": 250, "put_volume": 180},
      {"strike_price": 2800, "call_oi": 4567, "put_oi": 1234, "call_volume": 300, "put_volume": 100}
    ]
  }'`,
  };

  return NextResponse.json(documentation, { headers: corsHeaders });
}
