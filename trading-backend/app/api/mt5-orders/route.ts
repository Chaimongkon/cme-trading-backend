import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/mt5-orders
 * Get all MT5 orders with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const symbol = searchParams.get("symbol");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (symbol) where.symbol = symbol;

    // Get orders
    const orders = await prisma.mT5Order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Get stats
    const stats = await prisma.mT5Order.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    // Get result stats for closed orders
    const resultStats = await prisma.mT5Order.groupBy({
      by: ["result"],
      where: { status: "CLOSED" },
      _count: { result: true },
    });

    const totalCount = await prisma.mT5Order.count({ where });

    const statsSummary = {
      PENDING: stats.find((s) => s.status === "PENDING")?._count.status || 0,
      OPEN: stats.find((s) => s.status === "OPEN")?._count.status || 0,
      CLOSED: stats.find((s) => s.status === "CLOSED")?._count.status || 0,
    };

    const resultSummary = {
      TP1_HIT: resultStats.find((s) => s.result === "TP1_HIT")?._count.result || 0,
      TP2_HIT: resultStats.find((s) => s.result === "TP2_HIT")?._count.result || 0,
      TP3_HIT: resultStats.find((s) => s.result === "TP3_HIT")?._count.result || 0,
      SL_HIT: resultStats.find((s) => s.result === "SL_HIT")?._count.result || 0,
      MANUAL_CLOSE: resultStats.find((s) => s.result === "MANUAL_CLOSE")?._count.result || 0,
    };

    // Calculate win rate
    const wins = resultSummary.TP1_HIT + resultSummary.TP2_HIT + resultSummary.TP3_HIT;
    const losses = resultSummary.SL_HIT;
    const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;

    return NextResponse.json(
      {
        success: true,
        orders,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + orders.length < totalCount,
        },
        stats: statsSummary,
        results: resultSummary,
        winRate: winRate.toFixed(1),
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error fetching MT5 orders:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/mt5-orders
 * Create a new MT5 order
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      symbol = "XAUUSD",
      orderType,
      lotSize = 0.01,
      entryPrice,
      stopLoss,
      takeProfit1,
      takeProfit2,
      takeProfit3,
      notes,
      signalSource = "MANUAL",
      aiPredictionId,
      status = "OPEN",
    } = body;

    // Validate required fields
    if (!orderType || !entryPrice || !stopLoss || !takeProfit1) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: orderType, entryPrice, stopLoss, takeProfit1",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate order type
    if (!["BUY", "SELL"].includes(orderType)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid orderType. Must be BUY or SELL",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const order = await prisma.mT5Order.create({
      data: {
        symbol,
        orderType,
        lotSize,
        entryPrice,
        stopLoss,
        takeProfit1,
        takeProfit2,
        takeProfit3,
        notes,
        signalSource,
        aiPredictionId,
        status,
        entryTime: new Date(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        order,
        message: `Order ${orderType} created successfully`,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error creating MT5 order:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * PUT /api/mt5-orders
 * Update an existing MT5 order (for updating TP/SL hit status)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Order ID is required",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // If closing the order, set closeTime
    if (updateData.status === "CLOSED" && !updateData.closeTime) {
      updateData.closeTime = new Date();
    }

    // Calculate profit/loss if closing
    if (updateData.closePrice && updateData.status === "CLOSED") {
      const order = await prisma.mT5Order.findUnique({ where: { id } });
      if (order) {
        if (order.orderType === "BUY") {
          updateData.profitLoss = updateData.closePrice - order.entryPrice;
        } else {
          updateData.profitLoss = order.entryPrice - updateData.closePrice;
        }
      }
    }

    const order = await prisma.mT5Order.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(
      {
        success: true,
        order,
        message: "Order updated successfully",
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error updating MT5 order:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * DELETE /api/mt5-orders
 * Delete an MT5 order
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Order ID is required",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    await prisma.mT5Order.delete({
      where: { id },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Order deleted successfully",
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error deleting MT5 order:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
