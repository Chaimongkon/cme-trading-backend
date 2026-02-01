"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  HistogramData,
  LineData,
  ColorType,
  MouseEventParams,
} from "lightweight-charts";

interface OiData {
  strike: number;
  putOi: number | null;
  callOi: number | null;
  volSettle?: number | null;
  range?: string | null;
  putChange?: number;
  callChange?: number;
}

interface OiChartProps {
  data: OiData[];
  currentPrice?: number;
  maxPainStrike?: number;
  title?: string;
}

interface RangeData {
  start: number;
  end: number;
  value: number;
}

export function OiChart({
  data,
  currentPrice = 0,
  maxPainStrike = 0,
  title = "Open Interest ตาม Strike",
}: OiChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const putSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const callSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const volSettleSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const [currentPriceLineX, setCurrentPriceLineX] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    strike: number;
    putOi: number | null;
    callOi: number | null;
    volSettle: number | null;
    putChange: number | null;
    callChange: number | null;
    visible: boolean;
  } | null>(null);

  // OPTIMIZATION: Memoize expensive range extraction (rerender-memo rule)
  // This function was being called on every render; now extracted for potential memoization
  const extractRanges = (): RangeData[] => {
    const rangesMap = new Map<string, { strikes: number[]; value: number }>();

    for (const d of data) {
      if (d.range !== null && d.range !== undefined) {
        const rangeKey = String(d.range);
        const existing = rangesMap.get(rangeKey);
        if (existing) {
          existing.strikes.push(d.strike);
        } else {
          rangesMap.set(rangeKey, { strikes: [d.strike], value: parseFloat(rangeKey) || 0 });
        }
      }
    }

    const ranges: RangeData[] = [];
    for (const [, rangeData] of rangesMap) {
      if (rangeData.strikes.length > 0) {
        ranges.push({
          start: Math.min(...rangeData.strikes),
          end: Math.max(...rangeData.strikes),
          value: rangeData.value,
        });
      }
    }

    return ranges.sort((a, b) => a.start - b.start);
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
        fontFamily: "'Inter', sans-serif",
      },
      localization: {
        timeFormatter: (time: number) => time.toString(),
      },
      grid: {
        vertLines: { color: "#1f2937", style: 2 },
        horzLines: { color: "#1f2937", style: 2 },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      rightPriceScale: {
        borderColor: "#374151",
        scaleMargins: { top: 0.1, bottom: 0 },
      },
      leftPriceScale: {
        visible: true,
        borderColor: "#374151",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "#374151",
        tickMarkFormatter: (time: number) => time.toString(),
        rightOffset: 5,
      },
      crosshair: {
        vertLine: { color: "#4b5563", labelBackgroundColor: "#1f2937" },
        horzLine: { color: "#4b5563", labelBackgroundColor: "#1f2937" },
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: false },
      },
      // @ts-ignore
      attributionLogo: false,
      watermark: {
        visible: false,
      },
    });

    chartRef.current = chart;

    // Put OI (orange bars)
    const putSeries = chart.addHistogramSeries({
      color: "#fbbf24",
      priceFormat: { type: "volume" },
      priceScaleId: "right",
      lastValueVisible: false,
      priceLineVisible: false,
      // @ts-ignore
      crosshairMarkerVisible: false,
    });
    putSeriesRef.current = putSeries;

    // Call OI (blue bars)
    const callSeries = chart.addHistogramSeries({
      color: "#3b82f6",
      priceFormat: { type: "volume" },
      priceScaleId: "right",
      lastValueVisible: false,
      priceLineVisible: false,
      // @ts-ignore
      crosshairMarkerVisible: false,
    });
    callSeriesRef.current = callSeries;

    // Vol Settle Line (red dashed)
    const volSettleSeries = chart.addLineSeries({
      color: "#ef4444",
      lineWidth: 2,
      lineStyle: 2,
      priceScaleId: "left",
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volSettleSeriesRef.current = volSettleSeries;

    // Tooltip handler
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > chartContainerRef.current!.clientWidth ||
        param.point.y < 0 ||
        param.point.y > chartContainerRef.current!.clientHeight
      ) {
        setTooltip(null);
      } else {
        const putData = param.seriesData.get(putSeries) as HistogramData | undefined;
        const callData = param.seriesData.get(callSeries) as HistogramData | undefined;
        const volSettleData = param.seriesData.get(volSettleSeries) as LineData | undefined;
        const strike = param.time as number;

        // Find matching data for change values
        const matchingData = data.find((d) => d.strike === strike);

        setTooltip({
          strike,
          putOi: putData ? (putData.value as number) : null,
          callOi: callData ? (callData.value as number) : null,
          volSettle: volSettleData ? (volSettleData.value as number) : null,
          putChange: matchingData?.putChange ?? null,
          callChange: matchingData?.callChange ?? null,
          visible: true,
        });
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    // OPTIMIZATION: Use passive event listener for better scroll/resize performance
    // (client-passive-event-listeners rule)
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  // Update data
  useEffect(() => {
    if (!putSeriesRef.current || !callSeriesRef.current || data.length === 0)
      return;

    // Put OI data - highlight max pain strike
    const putData: HistogramData[] = data
      .filter((d) => d.putOi !== null && d.putOi > 0)
      .map((d) => ({
        time: d.strike as unknown as string,
        value: d.putOi!,
        color: d.strike === maxPainStrike ? "#f59e0b" : "#fbbf24",
      }));

    // Call OI data - highlight max pain strike
    const callData: HistogramData[] = data
      .filter((d) => d.callOi !== null && d.callOi > 0)
      .map((d) => ({
        time: d.strike as unknown as string,
        value: d.callOi!,
        color: d.strike === maxPainStrike ? "#60a5fa" : "#3b82f6",
      }));

    // Vol Settle line data
    const volSettleData: LineData[] = data
      .filter((d) => d.volSettle !== null && d.volSettle !== undefined)
      .map((d) => ({
        time: d.strike as unknown as string,
        value: d.volSettle!,
      }));

    putSeriesRef.current.setData(putData);
    callSeriesRef.current.setData(callData);

    if (volSettleSeriesRef.current && volSettleData.length > 0) {
      volSettleSeriesRef.current.setData(volSettleData);
    }

    // Add Current Price marker line logic
    if (chartRef.current && currentPrice > 0) {
      const closestStrike = data.reduce((prev, curr) =>
        Math.abs(curr.strike - currentPrice) < Math.abs(prev.strike - currentPrice) ? curr : prev
      ).strike;

      const updateCurrentPriceLinePosition = () => {
        if (!chartRef.current) return;
        const timeScale = chartRef.current.timeScale();
        // @ts-ignore
        const x = timeScale.timeToCoordinate(closestStrike);
        if (x !== null) {
          setCurrentPriceLineX(x);
        } else {
          setCurrentPriceLineX(null);
        }
      };

      setTimeout(updateCurrentPriceLinePosition, 50);
      chartRef.current.timeScale().subscribeVisibleTimeRangeChange(updateCurrentPriceLinePosition);
    }

    chartRef.current?.timeScale().fitContent();
  }, [data, currentPrice, maxPainStrike]);

  const ranges = extractRanges();
  const maxRangeValue = ranges.length > 0 ? Math.max(...ranges.map((r) => r.value)) : 0;

  // Calculate totals and PCR
  const totalPutOi = data.reduce((sum, d) => sum + (d.putOi || 0), 0);
  const totalCallOi = data.reduce((sum, d) => sum + (d.callOi || 0), 0);
  const totalPutChange = data.reduce((sum, d) => sum + (d.putChange || 0), 0);
  const totalCallChange = data.reduce((sum, d) => sum + (d.callChange || 0), 0);
  const pcr = totalCallOi > 0 ? totalPutOi / totalCallOi : 0;
  const pcrSignal = pcr < 0.8 ? "ขาขึ้น" : pcr > 1.2 ? "ขาลง" : "ทรงตัว";
  const pcrColor = pcr < 0.8 ? "text-green-500" : pcr > 1.2 ? "text-red-500" : "text-gray-400";
  const pcrBadgeVariant = pcr < 0.8 ? "buy" : pcr > 1.2 ? "sell" : "neutral";

  return (
    <Card className="border-border/40 bg-card/40 backdrop-blur-sm shadow-lg overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/10 space-y-4">
        {/* Top Row: Title & PCR Stats */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-xl font-bold tracking-tight">{title}</CardTitle>
          <div className="flex items-center gap-6 bg-secondary/20 px-4 py-2 rounded-lg border border-border/10 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-orange-500 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
              <span className="text-sm text-muted-foreground font-medium">Put OI</span>
              <span className="text-sm text-orange-500 font-bold font-mono">
                {formatNumber(totalPutOi, 0)}
              </span>
            </div>
            <div className="w-px h-4 bg-border/20" />
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              <span className="text-sm text-muted-foreground font-medium">Call OI</span>
              <span className="text-sm text-blue-500 font-bold font-mono">
                {formatNumber(totalCallOi, 0)}
              </span>
            </div>
            <div className="w-px h-4 bg-border/20" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-medium">PCR:</span>
              <span className={`text-sm font-bold font-mono ${pcrColor}`}>{pcr.toFixed(2)}</span>
              <Badge variant={pcrBadgeVariant} className="text-xs px-2 py-0.5 h-auto">
                {pcrSignal}
              </Badge>
            </div>
          </div>
        </div>

        {/* Middle Row: Ranges Bar */}
        {ranges.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="flex h-8 w-full rounded-md overflow-hidden border border-border/20">
              {ranges.map((range, idx) => {
                const isNearPrice = currentPrice >= range.start && currentPrice <= range.end;
                const intensity = maxRangeValue > 0 ? range.value / maxRangeValue : 0.5;

                let bgStyle = {};
                if (isNearPrice) {
                  bgStyle = { backgroundColor: `rgba(185, 28, 28, ${0.4 + intensity * 0.6})` };
                } else {
                  bgStyle = { backgroundColor: `rgba(75, 85, 99, ${0.2 + intensity * 0.3})` };
                }

                return (
                  <div
                    key={idx}
                    className={`relative flex items-center justify-center text-xs font-medium transition-colors duration-200
                      ${isNearPrice ? "text-white font-bold" : "text-gray-400"}
                      hover:bg-opacity-80
                    `}
                    style={{
                      flex: (range.end - range.start) / (data.length > 0 ? data[data.length - 1].strike - data[0].strike : 1),
                      ...bgStyle,
                      minWidth: "40px",
                      borderRight: idx < ranges.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none"
                    }}
                  >
                    {range.value.toFixed(1)}
                    {isNearPrice && (
                      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Row: Price Info & Max Pain */}
        <div className="flex items-center justify-between text-sm bg-secondary/10 px-3 py-1.5 rounded border border-border/10 flex-wrap gap-2">
          <div className="flex items-center gap-6 flex-wrap">
            {currentPrice > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Price:</span>
                <span className="text-yellow-500 font-bold font-mono text-base shadow-yellow-500/20 drop-shadow-sm">
                  {currentPrice.toFixed(1)}
                </span>
              </div>
            )}
            {maxPainStrike > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Max Pain:</span>
                <span className="text-purple-400 font-bold font-mono text-base">
                  {maxPainStrike.toFixed(0)}
                </span>
                <Badge variant="outline" className="text-xs text-purple-400 border-purple-400/50">
                  {((maxPainStrike - currentPrice) / currentPrice * 100).toFixed(1)}%
                </Badge>
              </div>
            )}
          </div>

          {/* OI Change Summary */}
          {(totalPutChange !== 0 || totalCallChange !== 0) && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Put Δ:</span>
                <span className={`font-mono font-medium ${totalPutChange > 0 ? "text-green-500" : totalPutChange < 0 ? "text-red-500" : "text-gray-400"}`}>
                  {totalPutChange > 0 ? "+" : ""}{formatNumber(totalPutChange, 0)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Call Δ:</span>
                <span className={`font-mono font-medium ${totalCallChange > 0 ? "text-green-500" : totalCallChange < 0 ? "text-red-500" : "text-gray-400"}`}>
                  {totalCallChange > 0 ? "+" : ""}{formatNumber(totalCallChange, 0)}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="relative h-[400px] w-full">
          <style jsx global>{`
            #oi-chart-container a[href^="https://www.tradingview.com/"] {
              display: none !important;
            }
          `}</style>
          <div ref={chartContainerRef} id="oi-chart-container" className="w-full h-full" />

          {/* Tooltip Overlay */}
          {tooltip && tooltip.visible && (
            <div className="absolute top-2 left-16 z-20 bg-background/90 backdrop-blur-sm border border-border/50 rounded-lg shadow-lg p-2 text-xs space-y-1.5 min-w-[150px]">
              <div className="text-muted-foreground font-medium border-b border-border/30 pb-1 mb-1">
                Strike: <span className="text-foreground font-bold">{tooltip.strike}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#fbbf24]" />
                  <span className="text-muted-foreground">Put OI:</span>
                </div>
                <span className="font-mono font-bold text-foreground">
                  {tooltip.putOi !== null ? formatNumber(tooltip.putOi, 0) : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#3b82f6]" />
                  <span className="text-muted-foreground">Call OI:</span>
                </div>
                <span className="font-mono font-bold text-foreground">
                  {tooltip.callOi !== null ? formatNumber(tooltip.callOi, 0) : "-"}
                </span>
              </div>
              {tooltip.volSettle !== null && (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
                    <span className="text-muted-foreground">Vol Settle:</span>
                  </div>
                  <span className="font-mono font-bold text-foreground">
                    {tooltip.volSettle.toFixed(2)}
                  </span>
                </div>
              )}
              {(tooltip.putChange !== null || tooltip.callChange !== null) && (
                <div className="border-t border-border/30 pt-1 mt-1 space-y-1">
                  {tooltip.putChange !== null && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Put Δ:</span>
                      <span className={`font-mono font-bold ${tooltip.putChange > 0 ? "text-green-500" : tooltip.putChange < 0 ? "text-red-500" : "text-gray-400"}`}>
                        {tooltip.putChange > 0 ? "+" : ""}{formatNumber(tooltip.putChange, 0)}
                      </span>
                    </div>
                  )}
                  {tooltip.callChange !== null && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Call Δ:</span>
                      <span className={`font-mono font-bold ${tooltip.callChange > 0 ? "text-green-500" : tooltip.callChange < 0 ? "text-red-500" : "text-gray-400"}`}>
                        {tooltip.callChange > 0 ? "+" : ""}{formatNumber(tooltip.callChange, 0)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Current Price Vertical Line Overlay */}
          {currentPriceLineX !== null && currentPrice > 0 && (
            <div
              className="absolute top-0 bottom-[30px] z-10 pointer-events-none border-l-2 border-dashed border-yellow-500/80"
              style={{
                left: `${currentPriceLineX}px`,
                transform: 'translateX(-50%)'
              }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-yellow-500 text-black text-[10px] px-1.5 py-0.5 rounded border border-yellow-600 font-bold shadow-sm whitespace-nowrap">
                {currentPrice.toFixed(1)}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
