"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createChart, IChartApi, ISeriesApi, LineData } from "lightweight-charts";

interface PutCallChartProps {
  data: Array<{
    strike: number;
    putOi: number | null;
    callOi: number | null;
  }>;
  currentPrice?: number;
  title?: string;
}

export function PutCallChart({
  data,
  currentPrice = 0,
  title = "Put vs Call OI",
}: PutCallChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const putSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const callSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      width: chartContainerRef.current.clientWidth,
      height: 250,
      rightPriceScale: {
        borderColor: "#374151",
      },
      timeScale: {
        borderColor: "#374151",
        tickMarkFormatter: (time: number) => time.toString(),
      },
      crosshair: {
        vertLine: {
          color: "#eab308",
          labelBackgroundColor: "#eab308",
        },
        horzLine: {
          color: "#eab308",
          labelBackgroundColor: "#eab308",
        },
      },
    });

    chartRef.current = chart;

    // Create line series for Puts
    const putSeries = chart.addLineSeries({
      color: "#ef4444",
      lineWidth: 2,
      priceFormat: { type: "volume" },
    });
    putSeriesRef.current = putSeries;

    // Create line series for Calls
    const callSeries = chart.addLineSeries({
      color: "#22c55e",
      lineWidth: 2,
      priceFormat: { type: "volume" },
    });
    callSeriesRef.current = callSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!putSeriesRef.current || !callSeriesRef.current || data.length === 0) return;

    const putData: LineData[] = data.map((d) => ({
      time: d.strike as unknown as string,
      value: d.putOi || 0,
    }));

    const callData: LineData[] = data.map((d) => ({
      time: d.strike as unknown as string,
      value: d.callOi || 0,
    }));

    putSeriesRef.current.setData(putData);
    callSeriesRef.current.setData(callData);

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data, currentPrice]);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span className="text-muted-foreground">Call</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded" />
              <span className="text-muted-foreground">Put</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={chartContainerRef} className="w-full" />
      </CardContent>
    </Card>
  );
}
