"use client";

import { useEffect, useRef, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

interface TradingViewChartProps {
  symbol?: string;
  interval?: string;
  theme?: "dark" | "light";
  height?: number;
  supportLevels?: number[];
  resistanceLevels?: number[];
  maxPain?: number;
  currentPrice?: number;
}

function TradingViewChartComponent({
  symbol = "OANDA:XAUUSD",
  interval = "15",
  theme = "dark",
  height = 500,
  supportLevels = [],
  resistanceLevels = [],
  maxPain,
  currentPrice,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = "";

    // Create container for the widget
    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";
    widgetContainer.style.height = `${height}px`;
    widgetContainer.style.width = "100%";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "calc(100% - 32px)";
    widgetDiv.style.width = "100%";

    widgetContainer.appendChild(widgetDiv);
    containerRef.current.appendChild(widgetContainer);

    // Create and load TradingView script
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: interval,
      timezone: "Asia/Bangkok",
      theme: theme,
      style: "1", // Candlestick
      locale: "th_TH",
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: true,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
      container_id: "tradingview_widget",
      studies: [
        "Volume@tv-basicstudies",
      ],
      show_popup_button: true,
      popup_width: "1000",
      popup_height: "650",
    });

    widgetContainer.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [symbol, interval, theme, height]);

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-yellow-500" />
            XAU/USD Live Chart
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            TradingView
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* CME Levels Reference */}
        {(supportLevels.length > 0 || resistanceLevels.length > 0 || maxPain) && (
          <div className="px-4 py-2 bg-muted/30 border-b border-border/40">
            <p className="text-xs text-muted-foreground mb-2">
              CME OI Levels (วาดเส้นบนกราฟ):
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              {resistanceLevels.slice(0, 3).map((level, i) => (
                <span key={`r-${i}`} className="px-2 py-1 rounded bg-red-500/20 text-red-400 font-mono">
                  R{i + 1}: {level.toFixed(0)}
                </span>
              ))}
              {maxPain && (
                <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 font-mono">
                  MP: {maxPain.toFixed(0)}
                </span>
              )}
              {supportLevels.slice(0, 3).map((level, i) => (
                <span key={`s-${i}`} className="px-2 py-1 rounded bg-green-500/20 text-green-400 font-mono">
                  S{i + 1}: {level.toFixed(0)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* TradingView Widget Container */}
        <div
          ref={containerRef}
          style={{ height: `${height}px` }}
          className="w-full"
        />

        {/* Copyright notice */}
        <div className="px-4 py-2 text-center border-t border-border/40">
          <a
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary"
          >
            Chart by TradingView
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

export const TradingViewChart = memo(TradingViewChartComponent);
