import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { events } = body;

        if (!Array.isArray(events)) {
            return NextResponse.json(
                { success: false, error: "Invalid data format" },
                { status: 400, headers: corsHeaders }
            );
        }

        console.log(`Received ${events.length} calendar events`);

        let upsertedCount = 0;

        for (const event of events) {
            // Basic validation
            if (!event.id || !event.title || !event.date) continue;

            // Parse date
            const eventDate = new Date(event.date);

            await prisma.economicEvent.upsert({
                where: { externalId: event.id },
                update: {
                    title: event.title,
                    date: eventDate,
                    time: event.time,
                    currency: event.currency,
                    impact: event.impact,
                    forecast: event.forecast,
                    actual: event.actual,
                    previous: event.previous,
                },
                create: {
                    externalId: event.id,
                    title: event.title,
                    date: eventDate,
                    time: event.time,
                    currency: event.currency,
                    impact: event.impact,
                    forecast: event.forecast,
                    actual: event.actual,
                    previous: event.previous,
                },
            });
            upsertedCount++;
        }

        return NextResponse.json(
            { success: true, count: upsertedCount },
            { headers: corsHeaders }
        );
    } catch (error) {
        console.error("Calendar sync error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500, headers: corsHeaders }
        );
    }
}
