import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendTestNotification } from "@/lib/telegram/bot";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/settings
 * Get current settings
 */
export async function GET() {
  try {
    let settings = await prisma.settings.findFirst({
      where: { id: "default" },
    });

    // Create default settings if not exists
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: "default",
          signalThreshold: 3,
          analysisInterval: 5,
        },
      });
    }

    // Mask sensitive data
    return NextResponse.json(
      {
        success: true,
        settings: {
          id: settings.id,
          telegramConfigured: !!(settings.telegramBotToken && settings.telegramChatId),
          telegramChatId: settings.telegramChatId
            ? `***${settings.telegramChatId.slice(-4)}`
            : null,
          signalThreshold: settings.signalThreshold,
          analysisInterval: settings.analysisInterval,
          updatedAt: settings.updatedAt,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error fetching settings:", error);
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
 * POST /api/settings
 * Update settings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      telegramBotToken,
      telegramChatId,
      signalThreshold,
      analysisInterval,
      testNotification,
    } = body;

    // Validate
    if (signalThreshold !== undefined && (signalThreshold < 1 || signalThreshold > 5)) {
      return NextResponse.json(
        { success: false, error: "Signal threshold must be between 1 and 5" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (analysisInterval !== undefined && analysisInterval < 1) {
      return NextResponse.json(
        { success: false, error: "Analysis interval must be at least 1 minute" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Test notification if requested
    if (testNotification && telegramBotToken && telegramChatId) {
      const testResult = await sendTestNotification(telegramBotToken, telegramChatId);
      if (!testResult.ok) {
        return NextResponse.json(
          {
            success: false,
            error: `Telegram test failed: ${testResult.error}`,
          },
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // Update or create settings
    const updateData: Record<string, unknown> = {};
    if (telegramBotToken !== undefined) updateData.telegramBotToken = telegramBotToken;
    if (telegramChatId !== undefined) updateData.telegramChatId = telegramChatId;
    if (signalThreshold !== undefined) updateData.signalThreshold = signalThreshold;
    if (analysisInterval !== undefined) updateData.analysisInterval = analysisInterval;

    const settings = await prisma.settings.upsert({
      where: { id: "default" },
      update: updateData,
      create: {
        id: "default",
        telegramBotToken: telegramBotToken || null,
        telegramChatId: telegramChatId || null,
        signalThreshold: signalThreshold || 3,
        analysisInterval: analysisInterval || 5,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: testNotification
          ? "Settings saved and test notification sent successfully"
          : "Settings saved successfully",
        settings: {
          id: settings.id,
          telegramConfigured: !!(settings.telegramBotToken && settings.telegramChatId),
          signalThreshold: settings.signalThreshold,
          analysisInterval: settings.analysisInterval,
          updatedAt: settings.updatedAt,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
