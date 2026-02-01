import { NextRequest, NextResponse } from "next/server";

// ============================================
// In-memory storage for sync commands
// In production, use Redis or similar for multi-instance support
// ============================================

interface SyncCommand {
  id: string;
  type: "REFRESH_ALL" | "REFRESH_VOLUME" | "REFRESH_OI" | "REFRESH_OI_CHANGE";
  timestamp: Date;
  acknowledged: boolean;
}

// Store pending sync commands
const pendingSyncCommands: SyncCommand[] = [];

// Store SSE clients
const clients: Set<ReadableStreamDefaultController> = new Set();

// Broadcast to all connected clients
function broadcast(data: object) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach((controller) => {
    try {
      controller.enqueue(new TextEncoder().encode(message));
    } catch (e) {
      // Client disconnected
      clients.delete(controller);
    }
  });
}

// ============================================
// CORS Headers
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ============================================
// OPTIONS - CORS preflight
// ============================================

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// ============================================
// GET - Server-Sent Events stream for extensions
// ============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");

  // Mode: poll - Simple polling for sync commands
  if (mode === "poll") {
    const pendingCommands = pendingSyncCommands.filter((cmd) => !cmd.acknowledged);
    
    return NextResponse.json(
      {
        success: true,
        commands: pendingCommands,
        timestamp: new Date().toISOString(),
      },
      { headers: corsHeaders }
    );
  }

  // Mode: SSE - Real-time stream
  const stream = new ReadableStream({
    start(controller) {
      clients.add(controller);

      // Send initial connection message
      const connectMessage = `data: ${JSON.stringify({
        type: "CONNECTED",
        message: "Connected to sync stream",
        timestamp: new Date().toISOString(),
      })}\n\n`;
      controller.enqueue(new TextEncoder().encode(connectMessage));

      // Send any pending commands
      const pendingCommands = pendingSyncCommands.filter((cmd) => !cmd.acknowledged);
      if (pendingCommands.length > 0) {
        const pendingMessage = `data: ${JSON.stringify({
          type: "PENDING_COMMANDS",
          commands: pendingCommands,
        })}\n\n`;
        controller.enqueue(new TextEncoder().encode(pendingMessage));
      }

      // Keep-alive ping every 30 seconds
      const pingInterval = setInterval(() => {
        try {
          const ping = `data: ${JSON.stringify({ type: "PING", timestamp: new Date().toISOString() })}\n\n`;
          controller.enqueue(new TextEncoder().encode(ping));
        } catch (e) {
          clearInterval(pingInterval);
          clients.delete(controller);
        }
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        clearInterval(pingInterval);
        clients.delete(controller);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

// ============================================
// POST - Trigger sync command from dashboard
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, type = "REFRESH_ALL" } = body;

    if (action === "trigger") {
      // Create new sync command
      const command: SyncCommand = {
        id: `sync-${Date.now()}`,
        type: type as SyncCommand["type"],
        timestamp: new Date(),
        acknowledged: false,
      };

      // Add to pending commands
      pendingSyncCommands.push(command);

      // Keep only last 10 commands
      while (pendingSyncCommands.length > 10) {
        pendingSyncCommands.shift();
      }

      // Broadcast to all connected extensions
      broadcast({
        type: "SYNC_COMMAND",
        command,
      });

      return NextResponse.json(
        {
          success: true,
          message: "Sync command sent to extensions",
          command,
          connectedClients: clients.size,
        },
        { headers: corsHeaders }
      );
    }

    if (action === "acknowledge") {
      // Mark command as acknowledged
      const { commandId } = body;
      const command = pendingSyncCommands.find((cmd) => cmd.id === commandId);
      
      if (command) {
        command.acknowledged = true;
        
        return NextResponse.json(
          {
            success: true,
            message: "Command acknowledged",
          },
          { headers: corsHeaders }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "Command not found",
        },
        { status: 404, headers: corsHeaders }
      );
    }

    if (action === "status") {
      return NextResponse.json(
        {
          success: true,
          connectedClients: clients.size,
          pendingCommands: pendingSyncCommands.filter((cmd) => !cmd.acknowledged).length,
          commands: pendingSyncCommands,
        },
        { headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Invalid action. Use: trigger, acknowledge, or status",
      },
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Sync API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
