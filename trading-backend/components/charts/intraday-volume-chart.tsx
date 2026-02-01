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
import { Menu } from "lucide-react";

interface IntradayVolumeData {
    strike: number;
    put: number | null;
    call: number | null;
    volSettle: number | null;
    range: string | null;
}

interface IntradayChartProps {
    data: IntradayVolumeData[];
    futurePrice?: number;
    summary?: {
        put: number;
        call: number;
        vol: number;
        volChg: number;
        futureChg: number;
    };
    title?: string;
}

interface RangeData {
    start: number;
    end: number;
    value: number;
}

export function IntradayVolumeChart({
    data,
    futurePrice = 0,
    summary,
    title = "Intraday Volume",
}: IntradayChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const putSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const callSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const volSettleSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const [futurePriceLineX, setFuturePriceLineX] = useState<number | null>(null);
    const [tooltip, setTooltip] = useState<{
        put: number | null;
        call: number | null;
        volSettle: number | null;
        visible: boolean;
    } | null>(null);

    // OPTIMIZATION: Extract unique ranges from data with optimized loops
    const extractRanges = (): RangeData[] => {
        const rangesMap = new Map<string, { strikes: number[]; value: number }>();

        for (const d of data) {
            if (d.range !== null) {
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
                vertLines: { color: "#1f2937", style: 2 }, // Dark gray dotted
                horzLines: { color: "#1f2937", style: 2 }, // Dark gray dotted
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

        // Put Volume (orange bars)
        const putSeries = chart.addHistogramSeries({
            color: "#fbbf24", // Lighter Orange/Yellow for Put
            priceFormat: { type: "volume" },
            priceScaleId: "right",
            lastValueVisible: false,
            priceLineVisible: false,
            // @ts-ignore
            crosshairMarkerVisible: false,
        });
        putSeriesRef.current = putSeries;

        // Call Volume (blue bars)
        const callSeries = chart.addHistogramSeries({
            color: "#3b82f6", // Blue
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
            lineStyle: 2, // Dashed
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

                setTooltip({
                    put: putData ? (putData.value as number) : null,
                    call: callData ? (callData.value as number) : null,
                    volSettle: volSettleData ? (volSettleData.value as number) : null,
                    visible: true,
                });
            }
        });

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        // OPTIMIZATION: Use passive event listener (client-passive-event-listeners rule)
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

        // Put data
        const putData: HistogramData[] = data
            .filter((d) => d.put !== null && d.put > 0)
            .map((d) => ({
                time: d.strike as unknown as string,
                value: d.put!,
                color: "#fbbf24", // Yellow/Orange
            }));

        // Call data
        const callData: HistogramData[] = data
            .filter((d) => d.call !== null && d.call > 0)
            .map((d) => ({
                time: d.strike as unknown as string,
                value: d.call!,
                color: "#3b82f6", // Blue
            }));

        // Vol Settle line data
        const volSettleData: LineData[] = data
            .filter((d) => d.volSettle !== null)
            .map((d) => ({
                time: d.strike as unknown as string,
                value: d.volSettle!,
            }));

        putSeriesRef.current.setData(putData);
        callSeriesRef.current.setData(callData);

        if (volSettleSeriesRef.current && volSettleData.length > 0) {
            volSettleSeriesRef.current.setData(volSettleData);
        }

        // Add Future Price marker line logic
        if (chartRef.current && futurePrice > 0) {
            // Find closest strike
            const closestStrike = data.reduce((prev, curr) =>
                Math.abs(curr.strike - futurePrice) < Math.abs(prev.strike - futurePrice) ? curr : prev
            ).strike;

            const updateFuturePriceLinePosition = () => {
                if (!chartRef.current) return;
                const timeScale = chartRef.current.timeScale();
                // @ts-ignore
                const x = timeScale.timeToCoordinate(closestStrike);
                if (x !== null) {
                    setFuturePriceLineX(x);
                } else {
                    setFuturePriceLineX(null);
                }
            };

            // Initial update
            // Small timeout to ensure chart is rendered
            setTimeout(updateFuturePriceLinePosition, 50);

            chartRef.current.timeScale().subscribeVisibleTimeRangeChange(updateFuturePriceLinePosition);
        }

        chartRef.current?.timeScale().fitContent();
    }, [data, futurePrice]);

    const ranges = extractRanges();
    const maxRangeValue = ranges.length > 0 ? Math.max(...ranges.map((r) => r.value)) : 0;

    // Calculate PCR
    const totalPut = data.reduce((sum, d) => sum + (d.put || 0), 0);
    const totalCall = data.reduce((sum, d) => sum + (d.call || 0), 0);
    const pcr = totalCall > 0 ? totalPut / totalCall : 0;
    const pcrSignal = pcr < 0.8 ? "ขาขึ้น" : pcr > 1.2 ? "ขาลง" : "ทรงตัว";
    const pcrColor = pcr < 0.8 ? "text-green-500" : pcr > 1.2 ? "text-red-500" : "text-gray-400";
    const pcrBadgeVariant = pcr < 0.8 ? "buy" : pcr > 1.2 ? "sell" : "neutral";

    return (
        <Card className="border-border/40 bg-card/40 backdrop-blur-sm shadow-lg overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/10 space-y-4">
                {/* Top Row: Title & PCR Stats */}
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold tracking-tight">{title}</CardTitle>
                    <div className="flex items-center gap-6 bg-secondary/20 px-4 py-2 rounded-lg border border-border/10">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 bg-orange-500 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                            <span className="text-sm text-muted-foreground font-medium">Put</span>
                            <span className="text-sm text-orange-500 font-bold font-mono">
                                {formatNumber(summary?.put || totalPut, 0)}
                            </span>
                        </div>
                        <div className="w-px h-4 bg-border/20" />
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                            <span className="text-sm text-muted-foreground font-medium">Call</span>
                            <span className="text-sm text-blue-500 font-bold font-mono">
                                {formatNumber(summary?.call || totalCall, 0)}
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
                                const isNearFuture =
                                    futurePrice >= range.start && futurePrice <= range.end;
                                // Use a more subtle gradient or solid color based on value
                                const intensity = maxRangeValue > 0 ? range.value / maxRangeValue : 0.5;

                                // Dynamic background calculation
                                let bgStyle = {};
                                if (isNearFuture) {
                                    bgStyle = { backgroundColor: `rgba(185, 28, 28, ${0.4 + intensity * 0.6})` }; // Red tint for active range
                                } else {
                                    bgStyle = { backgroundColor: `rgba(75, 85, 99, ${0.2 + intensity * 0.3})` }; // Gray tint
                                }

                                return (
                                    <div
                                        key={idx}
                                        className={`relative flex items-center justify-center text-xs font-medium transition-colors duration-200
                                            ${isNearFuture ? "text-white font-bold" : "text-gray-400"}
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
                                        {isNearFuture && (
                                            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Bottom Row: Future Price & Vol Stats */}
                {(futurePrice > 0 || summary) && (
                    <div className="flex items-center justify-between text-sm bg-secondary/10 px-3 py-1.5 rounded border border-border/10">
                        <div className="flex items-center gap-6">
                            {futurePrice > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Future:</span>
                                    <span className="text-yellow-500 font-bold font-mono text-base shadow-yellow-500/20 drop-shadow-sm">
                                        {futurePrice.toFixed(1)}
                                    </span>
                                </div>
                            )}
                            {summary?.futureChg !== undefined && (
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Chg:</span>
                                    <span
                                        className={`font-mono font-medium ${summary.futureChg > 0
                                            ? "text-green-500"
                                            : summary.futureChg < 0
                                                ? "text-red-500"
                                                : "text-gray-400"
                                            }`}
                                    >
                                        {summary.futureChg > 0 ? "+" : ""}
                                        {summary.futureChg.toFixed(2)}
                                    </span>
                                </div>
                            )}
                        </div>

                        {summary?.vol !== undefined && (
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Vol:</span>
                                <span className="font-mono text-foreground">{summary.vol.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                )}
            </CardHeader>

            <CardContent className="p-0">
                <div className="relative h-[400px] w-full">
                    <style jsx global>{`
                        #tv-chart-container a[href^="https://www.tradingview.com/"] {
                            display: none !important;
                        }
                    `}</style>
                    <div ref={chartContainerRef} id="tv-chart-container" className="w-full h-full" />

                    {/* Tooltip Overlay */}
                    {tooltip && tooltip.visible && (
                        <div className="absolute top-2 left-16 z-20 bg-background/90 backdrop-blur-sm border border-border/50 rounded-lg shadow-lg p-2 text-xs space-y-1.5 min-w-[120px]">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-[#fbbf24]" />
                                    <span className="text-muted-foreground">Put:</span>
                                </div>
                                <span className="font-mono font-bold text-foreground">
                                    {tooltip.put !== null ? formatNumber(tooltip.put, 0) : "-"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-[#3b82f6]" />
                                    <span className="text-muted-foreground">Call:</span>
                                </div>
                                <span className="font-mono font-bold text-foreground">
                                    {tooltip.call !== null ? formatNumber(tooltip.call, 0) : "-"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
                                    <span className="text-muted-foreground">Vol Settle:</span>
                                </div>
                                <span className="font-mono font-bold text-foreground">
                                    {tooltip.volSettle !== null ? tooltip.volSettle.toFixed(2) : "-"}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Future Price Vertical Line Overlay */}
                    {futurePriceLineX !== null && futurePrice > 0 && (
                        <div
                            className="absolute top-0 bottom-[30px] z-10 pointer-events-none border-l-2 border-dashed border-yellow-500/80"
                            style={{
                                left: `${futurePriceLineX}px`,
                                transform: 'translateX(-50%)'
                            }}
                        >
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-yellow-500 text-black text-[10px] px-1.5 py-0.5 rounded border border-yellow-600 font-bold shadow-sm whitespace-nowrap">
                                {futurePrice.toFixed(1)}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
