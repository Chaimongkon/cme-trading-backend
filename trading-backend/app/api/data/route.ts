import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  generateSignal,
  calculateVWAP,
  getLiquidityWalls,
  calculatePCR,
  calculateMaxPain,
  type OptionStrike,
  type MarketData,
  type TradingSignal,
} from "@/lib/analysis";
import { sendSignalNotification } from "@/lib/telegram/bot";
import { parseProductInfo } from "@/lib/utils";
import type { ExtensionPayload, ExtensionChartData, ChartSummary, DataType } from "@/lib/types";
import { runEnhancedAnalysis } from "@/lib/ai-enhanced-analysis";
import { fetchXauSpotPrice, calculateSpread } from "@/lib/price-feed";
import { calculateGEX } from "@/lib/greeks";
import { getUpcomingEventsSummary } from "@/lib/economic-calendar";
import type { MarketDataForAI } from "@/lib/ai-analysis";

// Enable CORS for extension requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Parse summary from subtitle
function parseSummary(subtitle: string): ChartSummary {
  const summary: ChartSummary = {
    put: null,
    call: null,
    vol: null,
    volChg: null,
    futureChg: null,
  };

  if (!subtitle) return summary;

  // Strip HTML tags and normalize
  const plainText = subtitle
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const putMatch = plainText.match(/Put:\s*([\d,.-]+)/i);
  const callMatch = plainText.match(/Call:\s*([\d,.-]+)/i);
  const volMatch = plainText.match(/Vol:\s*([\d,.-]+)/i);
  const volChgMatch = plainText.match(/Vol Chg:\s*([+-]?[\d,.-]+)/i);
  const futureChgMatch = plainText.match(/Future Chg:\s*([+-]?[\d,.-]+)/i);

  if (putMatch) summary.put = parseFloat(putMatch[1].replace(/,/g, "")) || null;
  if (callMatch) summary.call = parseFloat(callMatch[1].replace(/,/g, "")) || null;
  if (volMatch) summary.vol = parseFloat(volMatch[1].replace(/,/g, "")) || null;
  if (volChgMatch) summary.volChg = parseFloat(volChgMatch[1].replace(/,/g, "")) || null;
  if (futureChgMatch) summary.futureChg = parseFloat(futureChgMatch[1].replace(/,/g, "")) || null;

  return summary;
}

// Detect data type from chart title
function detectDataType(title: string): DataType {
  const lowerTitle = title.toLowerCase().trim();

  // Check for OI Change first (most specific)
  if (lowerTitle.includes("oi change") ||
    lowerTitle.includes("oi chg") ||
    lowerTitle.includes("open interest change")) {
    return "oichange";
  }
  // Check for OI (but not OI Change) - must NOT contain volume/intraday
  else if ((lowerTitle.includes("open interest") ||
    lowerTitle.startsWith("oi ") ||
    lowerTitle.includes(" oi ") ||
    /\boi\b/.test(lowerTitle)) &&
    !lowerTitle.includes("volume") &&
    !lowerTitle.includes("intraday")) {
    return "oi";
  }
  return "volume";
}

// Deduplication threshold in minutes
const DEDUP_THRESHOLD_MINUTES = 5;

// Check if data has changed significantly
function hasDataChanged(
  oldStrikes: Array<{ strike: number; put?: number | null; call?: number | null }>,
  newData: ExtensionChartData["tableData"],
  oldPrice?: number | null,
  newPrice?: number | null
): boolean {
  console.log(`[API /data] Checking change: OldPrice=${oldPrice}, NewPrice=${newPrice}, Strikes=${newData.length}`);

  // Check if price changed significantly (more than 0.1)
  if (oldPrice !== undefined && newPrice !== undefined) {
    const p1 = oldPrice || 0;
    const p2 = newPrice || 0;
    const diff = Math.abs(p1 - p2);
    if (diff > 0.1) {
      console.log(`[API /data] Price changed by ${diff} (> 0.1). Updating.`);
      return true;
    }
  }

  // If strike count is different, data changed
  if (oldStrikes.length !== newData.length) {
    console.log(`[API /data] Strike count changed: ${oldStrikes.length} -> ${newData.length}`);
    return true;
  }

  // Check if put/call values changed significantly (more than 1% or absolute 10)
  for (const newRow of newData) {
    const strike = parseFloat(String(newRow.strike)) || 0;
    const oldRow = oldStrikes.find(s => s.strike === strike);
    if (!oldRow) return true;

    const newPut = newRow.put !== null ? parseFloat(String(newRow.put)) || 0 : 0;
    const newCall = newRow.call !== null ? parseFloat(String(newRow.call)) || 0 : 0;
    const oldPut = oldRow.put || 0;
    const oldCall = oldRow.call || 0;

    // Check if changed more than 10 contracts or 1%
    const putDiff = Math.abs(newPut - oldPut);
    const callDiff = Math.abs(newCall - oldCall);

    if (putDiff > 10 || (oldPut > 0 && putDiff / oldPut > 0.01)) return true;
    if (callDiff > 10 || (oldCall > 0 && callDiff / oldCall > 0.01)) return true;
  }

  return false;
}

// Save Intraday Volume data (with deduplication)
async function saveVolumeSnapshot(
  chartData: ExtensionChartData,
  product: string,
  expiry: string,
  summary: ChartSummary
) {
  const thresholdTime = new Date(Date.now() - DEDUP_THRESHOLD_MINUTES * 60 * 1000);

  // Check for recent snapshot
  const existingSnapshot = await prisma.intradayVolumeSnapshot.findFirst({
    where: {
      product,
      expiry,
      extractedAt: { gte: thresholdTime },
    },
    orderBy: { extractedAt: "desc" },
    include: { strikes: true },
  });

  if (existingSnapshot) {
    // Check if data actually changed
    const oldStrikes = existingSnapshot.strikes.map(s => ({
      strike: s.strike,
      put: s.putVol,
      call: s.callVol,
    }));

    if (!hasDataChanged(oldStrikes, chartData.tableData, existingSnapshot.futurePrice, chartData.futurePrice)) {
      console.log("[API /data] Volume: No significant change, skipping");
      return existingSnapshot;
    }

    // Update existing snapshot
    console.log("[API /data] Volume: Updating existing snapshot", existingSnapshot.id);

    // Delete old strikes and recreate
    await prisma.intradayVolumeStrike.deleteMany({
      where: { snapshotId: existingSnapshot.id },
    });

    const updated = await prisma.intradayVolumeSnapshot.update({
      where: { id: existingSnapshot.id },
      data: {
        futurePrice: chartData.futurePrice || null,
        totalPut: summary.put,
        totalCall: summary.call,
        vol: summary.vol,
        volChg: summary.volChg,
        futureChg: summary.futureChg,
        extractedAt: new Date(chartData.extractedAt),
        strikes: {
          create: chartData.tableData.map((row) => ({
            strike: parseFloat(String(row.strike)) || 0,
            putVol: row.put !== null ? parseFloat(String(row.put)) || 0 : null,
            callVol: row.call !== null ? parseFloat(String(row.call)) || 0 : null,
            volSettle: row.volSettle !== null ? parseFloat(String(row.volSettle)) || null : null,
            range: row.range !== null && row.range !== undefined ? String(row.range) : null,
          })),
        },
      },
      include: { strikes: true },
    });

    return updated;
  }

  // Create new snapshot
  const snapshot = await prisma.intradayVolumeSnapshot.create({
    data: {
      product,
      expiry,
      futurePrice: chartData.futurePrice || null,
      totalPut: summary.put,
      totalCall: summary.call,
      vol: summary.vol,
      volChg: summary.volChg,
      futureChg: summary.futureChg,
      extractedAt: new Date(chartData.extractedAt),
      strikes: {
        create: chartData.tableData.map((row) => ({
          strike: parseFloat(String(row.strike)) || 0,
          putVol: row.put !== null ? parseFloat(String(row.put)) || 0 : null,
          callVol: row.call !== null ? parseFloat(String(row.call)) || 0 : null,
          volSettle: row.volSettle !== null ? parseFloat(String(row.volSettle)) || null : null,
          range: row.range !== null && row.range !== undefined ? String(row.range) : null,
        })),
      },
    },
    include: { strikes: true },
  });

  return snapshot;
}

// Save Open Interest data (with deduplication)
async function saveOiSnapshot(
  chartData: ExtensionChartData,
  product: string,
  expiry: string,
  summary: ChartSummary
) {
  const thresholdTime = new Date(Date.now() - DEDUP_THRESHOLD_MINUTES * 60 * 1000);

  // Check for recent snapshot
  const existingSnapshot = await prisma.oiSnapshot.findFirst({
    where: {
      product,
      expiry,
      extractedAt: { gte: thresholdTime },
    },
    orderBy: { extractedAt: "desc" },
    include: { strikes: true },
  });

  if (existingSnapshot) {
    const oldStrikes = existingSnapshot.strikes.map(s => ({
      strike: s.strike,
      put: s.putOi,
      call: s.callOi,
    }));

    if (!hasDataChanged(oldStrikes, chartData.tableData, existingSnapshot.futurePrice, chartData.futurePrice)) {
      console.log("[API /data] OI: No significant change, skipping");
      return existingSnapshot;
    }

    console.log("[API /data] OI: Updating existing snapshot", existingSnapshot.id);

    await prisma.oiStrike.deleteMany({
      where: { snapshotId: existingSnapshot.id },
    });

    const updated = await prisma.oiSnapshot.update({
      where: { id: existingSnapshot.id },
      data: {
        futurePrice: chartData.futurePrice || null,
        totalPutOi: summary.put,
        totalCallOi: summary.call,
        vol: summary.vol,
        volChg: summary.volChg,
        futureChg: summary.futureChg,
        extractedAt: new Date(chartData.extractedAt),
        strikes: {
          create: chartData.tableData.map((row) => ({
            strike: parseFloat(String(row.strike)) || 0,
            putOi: row.put !== null ? parseFloat(String(row.put)) || 0 : null,
            callOi: row.call !== null ? parseFloat(String(row.call)) || 0 : null,
            volSettle: row.volSettle !== null ? parseFloat(String(row.volSettle)) || null : null,
            range: row.range !== null && row.range !== undefined ? String(row.range) : null,
          })),
        },
      },
      include: { strikes: true },
    });

    return updated;
  }

  const snapshot = await prisma.oiSnapshot.create({
    data: {
      product,
      expiry,
      futurePrice: chartData.futurePrice || null,
      totalPutOi: summary.put,
      totalCallOi: summary.call,
      vol: summary.vol,
      volChg: summary.volChg,
      futureChg: summary.futureChg,
      extractedAt: new Date(chartData.extractedAt),
      strikes: {
        create: chartData.tableData.map((row) => ({
          strike: parseFloat(String(row.strike)) || 0,
          putOi: row.put !== null ? parseFloat(String(row.put)) || 0 : null,
          callOi: row.call !== null ? parseFloat(String(row.call)) || 0 : null,
          volSettle: row.volSettle !== null ? parseFloat(String(row.volSettle)) || null : null,
          range: row.range !== null && row.range !== undefined ? String(row.range) : null,
        })),
      },
    },
    include: { strikes: true },
  });

  return snapshot;
}

// Save OI Change data (with deduplication)
async function saveOiChangeSnapshot(
  chartData: ExtensionChartData,
  product: string,
  expiry: string,
  summary: ChartSummary
) {
  const thresholdTime = new Date(Date.now() - DEDUP_THRESHOLD_MINUTES * 60 * 1000);

  // Check for recent snapshot
  const existingSnapshot = await prisma.oiChangeSnapshot.findFirst({
    where: {
      product,
      expiry,
      extractedAt: { gte: thresholdTime },
    },
    orderBy: { extractedAt: "desc" },
    include: { strikes: true },
  });

  if (existingSnapshot) {
    const oldStrikes = existingSnapshot.strikes.map(s => ({
      strike: s.strike,
      put: s.putChange,
      call: s.callChange,
    }));

    if (!hasDataChanged(oldStrikes, chartData.tableData, existingSnapshot.futurePrice, chartData.futurePrice)) {
      console.log("[API /data] OI Change: No significant change, skipping");
      return existingSnapshot;
    }

    console.log("[API /data] OI Change: Updating existing snapshot", existingSnapshot.id);

    await prisma.oiChangeStrike.deleteMany({
      where: { snapshotId: existingSnapshot.id },
    });

    const updated = await prisma.oiChangeSnapshot.update({
      where: { id: existingSnapshot.id },
      data: {
        futurePrice: chartData.futurePrice || null,
        totalPutChange: summary.put,
        totalCallChange: summary.call,
        vol: summary.vol,
        volChg: summary.volChg,
        futureChg: summary.futureChg,
        extractedAt: new Date(chartData.extractedAt),
        strikes: {
          create: chartData.tableData.map((row) => ({
            strike: parseFloat(String(row.strike)) || 0,
            putChange: row.put !== null ? parseFloat(String(row.put)) || 0 : null,
            callChange: row.call !== null ? parseFloat(String(row.call)) || 0 : null,
            volSettle: row.volSettle !== null ? parseFloat(String(row.volSettle)) || null : null,
            range: row.range !== null && row.range !== undefined ? String(row.range) : null,
          })),
        },
      },
      include: { strikes: true },
    });

    return updated;
  }

  const snapshot = await prisma.oiChangeSnapshot.create({
    data: {
      product,
      expiry,
      futurePrice: chartData.futurePrice || null,
      totalPutChange: summary.put,
      totalCallChange: summary.call,
      vol: summary.vol,
      volChg: summary.volChg,
      futureChg: summary.futureChg,
      extractedAt: new Date(chartData.extractedAt),
      strikes: {
        create: chartData.tableData.map((row) => ({
          strike: parseFloat(String(row.strike)) || 0,
          putChange: row.put !== null ? parseFloat(String(row.put)) || 0 : null,
          callChange: row.call !== null ? parseFloat(String(row.call)) || 0 : null,
          volSettle: row.volSettle !== null ? parseFloat(String(row.volSettle)) || null : null,
          range: row.range !== null && row.range !== undefined ? String(row.range) : null,
        })),
      },
    },
    include: { strikes: true },
  });

  return snapshot;
}

/**
 * POST /api/data
 * Receive data from Chrome Extension
 */
export async function POST(request: NextRequest) {
  try {
    const body: ExtensionPayload = await request.json();

    const results: Array<{
      dataType: DataType;
      snapshotId: string;
      product: string;
      expiry: string;
      strikesCount: number;
    }> = [];

    let volumeSnapshotId: string | null = null;
    let oiSnapshotId: string | null = null;
    let oiChangeSnapshotId: string | null = null;
    let latestProduct = "";
    let latestFuturePrice = 0;

    console.log("[API /data] Payload received:", {
      hasVolumeData: !!body.volumeData?.data?.[0],
      hasOiData: !!body.oiData?.data?.[0],
      hasOiChangeData: !!body.oiChangeData?.data?.[0],
      legacyDataLength: body.data?.length || 0,
    });

    // Process volumeData
    if (body.volumeData?.data?.[0]) {
      const chartData = body.volumeData.data[0];
      const { product, expiry } = parseProductInfo(chartData.title);
      const summary = parseSummary(chartData.subtitle || "");

      console.log("[API /data] Saving Volume:", { product, expiry, strikes: chartData.tableData?.length });

      const snapshot = await saveVolumeSnapshot(chartData, product, expiry, summary);
      volumeSnapshotId = snapshot.id;
      latestProduct = product;
      latestFuturePrice = chartData.futurePrice || 0;

      results.push({
        dataType: "volume",
        snapshotId: snapshot.id,
        product,
        expiry,
        strikesCount: snapshot.strikes.length,
      });
    }

    // Process oiData
    if (body.oiData?.data?.[0]) {
      const chartData = body.oiData.data[0];
      const { product, expiry } = parseProductInfo(chartData.title);
      const summary = parseSummary(chartData.subtitle || "");

      console.log("[API /data] Saving OI:", { product, expiry, strikes: chartData.tableData?.length });

      const snapshot = await saveOiSnapshot(chartData, product, expiry, summary);
      oiSnapshotId = snapshot.id;
      latestProduct = product;
      latestFuturePrice = chartData.futurePrice || latestFuturePrice;

      results.push({
        dataType: "oi",
        snapshotId: snapshot.id,
        product,
        expiry,
        strikesCount: snapshot.strikes.length,
      });
    }

    // Process oiChangeData
    if (body.oiChangeData?.data?.[0]) {
      const chartData = body.oiChangeData.data[0];
      const { product, expiry } = parseProductInfo(chartData.title);
      const summary = parseSummary(chartData.subtitle || "");

      console.log("[API /data] Saving OI Change:", { product, expiry, strikes: chartData.tableData?.length });

      const snapshot = await saveOiChangeSnapshot(chartData, product, expiry, summary);
      oiChangeSnapshotId = snapshot.id;
      latestProduct = product;
      latestFuturePrice = chartData.futurePrice || latestFuturePrice;

      results.push({
        dataType: "oichange",
        snapshotId: snapshot.id,
        product,
        expiry,
        strikesCount: snapshot.strikes.length,
      });
    }

    // Legacy format support
    if (results.length === 0 && body.data && body.data.length > 0) {
      for (const chartData of body.data) {
        const { product, expiry } = parseProductInfo(chartData.title);
        const dataType = detectDataType(chartData.title);
        const summary = parseSummary((chartData as ExtensionChartData & { subtitle?: string }).subtitle || "");

        console.log("[API /data] Legacy format - Saving:", { dataType, product, expiry });

        let snapshot;
        if (dataType === "volume") {
          snapshot = await saveVolumeSnapshot(chartData, product, expiry, summary);
          volumeSnapshotId = snapshot.id;
        } else if (dataType === "oi") {
          snapshot = await saveOiSnapshot(chartData, product, expiry, summary);
          oiSnapshotId = snapshot.id;
        } else {
          snapshot = await saveOiChangeSnapshot(chartData, product, expiry, summary);
          oiChangeSnapshotId = snapshot.id;
        }

        latestProduct = product;
        latestFuturePrice = chartData.futurePrice || latestFuturePrice;

        results.push({
          dataType,
          snapshotId: snapshot.id,
          product,
          expiry,
          strikesCount: snapshot.strikes.length,
        });
      }
    }

    if (results.length === 0) {
      return NextResponse.json(
        { success: false, error: "No data to process" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Run analysis if we have OI data (primary for signal generation)
    let signalResult = null;
    let tradingSignal: TradingSignal | null = null;

    if (oiSnapshotId && latestProduct) {
      // Get current OI snapshot
      const currentOi = await prisma.oiSnapshot.findUnique({
        where: { id: oiSnapshotId },
        include: { strikes: true },
      });

      // Get current Volume snapshot (if available)
      const currentVolume = volumeSnapshotId
        ? await prisma.intradayVolumeSnapshot.findUnique({
          where: { id: volumeSnapshotId },
          include: { strikes: true },
        })
        : null;

      // Get OI Change snapshot (if available)
      const currentOiChange = oiChangeSnapshotId
        ? await prisma.oiChangeSnapshot.findUnique({
          where: { id: oiChangeSnapshotId },
          include: { strikes: true },
        })
        : null;

      if (currentOi) {
        const currentPrice = currentOi.futurePrice || latestFuturePrice || 0;

        // Build strike map to merge data from all sources
        const strikeMap = new Map<number, OptionStrike>();

        // Initialize with OI data (primary)
        for (const s of currentOi.strikes) {
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

        // Add Volume data
        if (currentVolume) {
          for (const s of currentVolume.strikes) {
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

        // Add OI Change data
        if (currentOiChange) {
          for (const s of currentOiChange.strikes) {
            const existing = strikeMap.get(s.strike);
            if (existing) {
              existing.call_oi_change = s.callChange || 0;
              existing.put_oi_change = s.putChange || 0;
            }
          }
        }

        // Convert to sorted array
        const optionStrikes: OptionStrike[] = Array.from(strikeMap.values())
          .sort((a, b) => a.strike_price - b.strike_price);

        // Calculate VWAP
        const vwap = calculateVWAP(optionStrikes);

        // Build MarketData for signal generation
        const marketData: MarketData = {
          current_price: currentPrice,
          vwap,
          strikes: optionStrikes,
        };

        // Generate signal using unified analysis
        tradingSignal = generateSignal(marketData);

        // Calculate PCR for storage
        const pcr = calculatePCR(optionStrikes, currentPrice);
        const maxPain = calculateMaxPain(optionStrikes, currentPrice);

        // Calculate strength (1-5) from score (0-100)
        const strength = Math.ceil(tradingSignal.score / 20) as 1 | 2 | 3 | 4 | 5;

        // Save signal to database
        // Convert analysis to JSON-compatible format
        const analysisJson = JSON.parse(JSON.stringify({
          score: tradingSignal.score,
          sentiment: tradingSignal.sentiment,
          factor_scores: tradingSignal.factor_scores,
          key_levels: tradingSignal.key_levels,
          volume_analysis: tradingSignal.volume_analysis,
          factors: tradingSignal.factors,
        }));

        const savedSignal = await prisma.signal.create({
          data: {
            product: latestProduct,
            type: tradingSignal.signal,
            strength: strength,
            reason: tradingSignal.reason,
            analysis: analysisJson,
            putCallRatio: pcr.volume_pcr,
            maxPainStrike: maxPain.max_pain_strike,
            currentPrice: currentPrice,
            volumeSnapshotId,
            oiSnapshotId,
            oiChangeSnapshotId,
          },
        });

        // Send Telegram notification for strong signals (strength >= 3 = score >= 40 difference from 50)
        if (tradingSignal.signal !== "NEUTRAL" && strength >= 3) {
          const notifyResult = await sendSignalNotification(
            tradingSignal,
            latestProduct,
            currentPrice
          );

          if (notifyResult.sent) {
            await prisma.signal.update({
              where: { id: savedSignal.id },
              data: { notified: true },
            });
          }
        }

        signalResult = {
          type: tradingSignal.signal,
          strength: strength,
          score: tradingSignal.score,
          sentiment: tradingSignal.sentiment,
          reason: tradingSignal.reason,
          summary: tradingSignal.summary,
          key_levels: tradingSignal.key_levels,
          volume_confirmed: tradingSignal.factor_scores.volume_score > 0,
        };

        // Auto-create MT5 Order from AI Analysis for strong signals
        if (tradingSignal.signal !== "NEUTRAL" && strength >= 3) {
          try {
            // Run AI Enhanced Analysis to get TP/SL
            console.log("[API /data] Running AI Analysis for MT5 Order...");
            
            // Build AI data
            const aiData: MarketDataForAI = {
              cme_futures_price: currentPrice,
              xau_spot_price: null,
              spread: null,
              oi_pcr: pcr.oi_pcr,
              volume_pcr: pcr.volume_pcr,
              max_pain: maxPain.max_pain_strike,
              call_wall: getLiquidityWalls(optionStrikes).resistance.strike,
              put_wall: getLiquidityWalls(optionStrikes).support.strike,
              net_oi_change: optionStrikes.reduce((sum, s) => sum + s.call_oi_change - s.put_oi_change, 0),
              call_oi_change: optionStrikes.reduce((sum, s) => sum + s.call_oi_change, 0),
              put_oi_change: optionStrikes.reduce((sum, s) => sum + s.put_oi_change, 0),
              total_call_volume: optionStrikes.reduce((sum, s) => sum + s.call_volume, 0),
              total_put_volume: optionStrikes.reduce((sum, s) => sum + s.put_volume, 0),
              hot_strikes: optionStrikes
                .map((s) => ({
                  strike: s.strike_price,
                  volume: s.call_volume + s.put_volume,
                  type: (s.call_volume > s.put_volume ? "call" : s.put_volume > s.call_volume ? "put" : "mixed") as "call" | "put" | "mixed",
                }))
                .filter((s) => s.volume > 0)
                .sort((a, b) => b.volume - a.volume)
                .slice(0, 10),
              vwap: vwap,
              system_signal: tradingSignal.signal,
              system_confidence: tradingSignal.score,
              data_timestamp: new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
            };

            const enhancedResult = await runEnhancedAnalysis(aiData, {
              useConsensus: false,
              provider: "auto",
              trackPrediction: true,
            });

            const recommendation = enhancedResult.tradingRecommendation;
            
            // Only create order if confidence is high enough and safe to trade
            if (recommendation.confidence >= 60 && recommendation.safeToTrade) {
              const orderType = ["BUY", "STRONG_BUY"].includes(recommendation.action) ? "BUY" : "SELL";
              
              // Check if there's already an OPEN order for this symbol
              const existingOrder = await prisma.mT5Order.findFirst({
                where: {
                  symbol: "XAUUSD",
                  status: "OPEN",
                },
              });

              if (!existingOrder) {
                const mt5Order = await prisma.mT5Order.create({
                  data: {
                    symbol: "XAUUSD",
                    orderType: orderType,
                    lotSize: 0.01,
                    entryPrice: (recommendation.entryZone.start + recommendation.entryZone.end) / 2,
                    stopLoss: recommendation.stopLoss,
                    takeProfit1: recommendation.takeProfit1,
                    takeProfit2: recommendation.takeProfit2,
                    takeProfit3: null,
                    status: "OPEN",
                    signalSource: "AI",
                    aiPredictionId: enhancedResult.predictionId,
                    notes: `${recommendation.action} | Confidence: ${recommendation.confidence}% | ${tradingSignal.reason}`,
                  },
                });

                console.log("[API /data] MT5 Order created:", mt5Order.id, orderType, "@ Entry:", mt5Order.entryPrice);
                
                signalResult = {
                  ...signalResult,
                  mt5Order: {
                    id: mt5Order.id,
                    orderType: mt5Order.orderType,
                    entryPrice: mt5Order.entryPrice,
                    stopLoss: mt5Order.stopLoss,
                    takeProfit1: mt5Order.takeProfit1,
                    takeProfit2: mt5Order.takeProfit2,
                  },
                } as typeof signalResult & { mt5Order: unknown };
              } else {
                console.log("[API /data] Skipping MT5 Order - existing OPEN order:", existingOrder.id);
              }
            } else {
              console.log("[API /data] Skipping MT5 Order - Confidence:", recommendation.confidence, "Safe:", recommendation.safeToTrade);
            }
          } catch (aiError) {
            console.error("[API /data] AI Analysis error (non-blocking):", aiError);
            // Don't fail the whole request if AI fails
          }
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        results,
        signal: signalResult,
        receivedAt: new Date().toISOString(),
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error processing data:", error);
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
 * GET /api/data
 * Get latest snapshot data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const product = searchParams.get("product");
    const dataType = (searchParams.get("type") || "oi") as DataType;
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = product ? { product } : {};

    let snapshots;

    if (dataType === "volume") {
      snapshots = await prisma.intradayVolumeSnapshot.findMany({
        where,
        orderBy: { extractedAt: "desc" },
        skip: offset,
        take: limit,
        include: {
          strikes: {
            orderBy: { strike: "asc" },
          },
        },
      });
    } else if (dataType === "oichange") {
      snapshots = await prisma.oiChangeSnapshot.findMany({
        where,
        orderBy: { extractedAt: "desc" },
        skip: offset,
        take: limit,
        include: {
          strikes: {
            orderBy: { strike: "asc" },
          },
        },
      });
    } else {
      // Default: OI
      snapshots = await prisma.oiSnapshot.findMany({
        where,
        orderBy: { extractedAt: "desc" },
        skip: offset,
        take: limit,
        include: {
          strikes: {
            orderBy: { strike: "asc" },
          },
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        dataType,
        data: snapshots,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error fetching data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
