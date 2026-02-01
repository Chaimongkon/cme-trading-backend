"use client";

import { useEffect, useRef, memo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Loader2 } from "lucide-react";

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
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Reset states
    setIsLoading(true);
    setHasError(false);

    // Clear previous widget
    containerRef.current.innerHTML = "";

    // Generate unique container ID to avoid conflicts
    const containerId = `tradingview_${Date.now()}`;

    // Create container for the widget
    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";
    widgetContainer.style.height = `${height}px`;
    widgetContainer.style.width = "100%";

    const widgetDiv = document.createElement("div");
    widgetDiv.id = containerId;
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "calc(100% - 32px)";
    widgetDiv.style.width = "100%";

    widgetContainer.appendChild(widgetDiv);
    containerRef.current.appendChild(widgetContainer);

    // Create and load TradingView script with error handling
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    
    // Handle script load/error events
    script.onload = () => {
      setIsLoading(false);
    };
    script.onerror = () => {
      setIsLoading(false);
      setHasError(true);
    };

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: interval,
      timezone: "Asia/Bangkok",
      theme: theme,
      style: "1",
      locale: "th_TH",
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: true,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
      container_id: containerId,
      studies: [
        "Volume@tv-basicstudies",
      ],
      show_popup_button: true,
      popup_width: "1000",
      popup_height: "650",
      // Suppress iframe communication errors
      allow_symbol_change: true,
    });

    // Delay script append to ensure container is ready
    const timeoutId = setTimeout(() => {
      if (widgetContainer.isConnected) {
        widgetContainer.appendChild(script);
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
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
        <div className="relative">
          {/* Loading overlay */}
          {isLoading && (
            <div 
              className="absolute inset-0 flex items-center justify-center bg-background/80 z-10"
              style={{ height: `${height}px` }}
            >
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">กำลังโหลด TradingView...</span>
              </div>
            </div>
          )}
          
          {/* Error state */}
          {hasError && (
            <div 
              className="absolute inset-0 flex items-center justify-center bg-background z-10"
              style={{ height: `${height}px` }}
            >
              <div className="text-center text-muted-foreground">
                <p>ไม่สามารถโหลด TradingView ได้</p>
                <p className="text-xs mt-1">ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต</p>
              </div>
            </div>
          )}
          
          <div
            ref={containerRef}
            style={{ height: `${height}px` }}
            className="w-full"
          />
        </div>

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
