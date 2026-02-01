import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/signals
 * Get signal history with filtering options
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const product = searchParams.get("product");
    const type = searchParams.get("type"); // BUY, SELL, NEUTRAL
    const minStrength = parseInt(searchParams.get("minStrength") || "0");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: Record<string, unknown> = {};
    if (product) where.product = product;
    if (type) where.type = type;
    if (minStrength > 0) where.strength = { gte: minStrength };

    // Get total count
    const totalCount = await prisma.signal.count({ where });

    // Get signals with pagination
    const signals = await prisma.signal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Get summary stats
    const stats = await prisma.signal.groupBy({
      by: ["type"],
      where: product ? { product } : {},
      _count: { type: true },
    });

    const statsSummary = {
      BUY: stats.find((s) => s.type === "BUY")?._count.type || 0,
      SELL: stats.find((s) => s.type === "SELL")?._count.type || 0,
      NEUTRAL: stats.find((s) => s.type === "NEUTRAL")?._count.type || 0,
    };

    // Get latest signal
    const latestSignal = signals.length > 0 ? signals[0] : null;

    return NextResponse.json(
      {
        success: true,
        signals,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + signals.length < totalCount,
        },
        stats: statsSummary,
        latestSignal,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error fetching signals:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
