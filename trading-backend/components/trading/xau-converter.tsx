"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useXauPrice,
  useManualXauInput,
  formatPriceChange,
  getPositionLabel,
  getPositionColor,
  formatLevelsForCopy,
  copyToClipboard,
} from "@/hooks/use-xau";
import {
  RefreshCw,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Target,
  AlertCircle,
  Wifi,
  WifiOff,
  Edit2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Main XAU Converter Component
// ============================================

export function XauConverter() {
  const {
    xau,
    spread,
    levels,
    tradingZones,
    isLoading,
    isValidating,
    isError,
    error,
    refresh,
  } = useXauPrice(30000, true);

  const [copied, setCopied] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  const handleCopy = async () => {
    if (levels) {
      const success = await copyToClipboard(formatLevelsForCopy(levels));
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  // Loading state
  if (isLoading && !xau) {
    return <XauConverterSkeleton />;
  }

  // Market closed state (price = 0)
  const isMarketClosed = xau?.price === 0 || xau?.source?.includes("Market Closed");

  // Error state OR Market closed
  if ((isError && !xau) || isMarketClosed) {
    return (
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <WifiOff className="h-5 w-5 text-yellow-500" />
            XAU Price Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 mb-4">
            <div className="text-4xl mb-2">🌙</div>
            <p className="text-sm font-medium">ตลาดปิดทำการ</p>
            <p className="text-xs text-muted-foreground">
              วันหยุด หรือ นอกเวลาทำการ
            </p>
          </div>
          
          <ManualInputForm onSuccess={() => refresh()} />
          
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground text-center">
              💡 กรอกราคา XAU จาก MT4/MT5 หรือ TradingView<br/>
              เพื่อดูระดับแนวรับ-แนวต้านที่แปลงแล้ว
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const priceChange = xau
    ? formatPriceChange(xau.change, xau.changePercent)
    : null;

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            CME → XAU Converter
          </CardTitle>
          <div className="flex items-center gap-2">
            {isValidating && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <Badge
              variant={xau?.source === "Yahoo Finance" ? "default" : "secondary"}
              className="text-xs"
            >
              {xau?.source === "Yahoo Finance" ? (
                <>
                  <Wifi className="h-3 w-3 mr-1" />
                  Live
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 mr-1" />
                  Manual
                </>
              )}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* XAU Price Display */}
        <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">XAU/USD Spot</span>
            <span
              className={cn(
                "text-sm font-medium flex items-center gap-1",
                priceChange?.color === "green"
                  ? "text-green-500"
                  : priceChange?.color === "red"
                  ? "text-red-500"
                  : "text-muted-foreground"
              )}
            >
              {priceChange?.icon} {priceChange?.text}
            </span>
          </div>
          <div className="text-3xl font-bold">${xau?.price.toFixed(2)}</div>
        </div>

        {/* Spread Info */}
        {spread && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/50 rounded-lg p-2">
              <div className="text-xs text-muted-foreground">CME Futures</div>
              <div className="font-semibold">{spread.futures_price.toFixed(2)}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <div className="text-xs text-muted-foreground">XAU Spot</div>
              <div className="font-semibold">{spread.spot_price.toFixed(2)}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <div className="text-xs text-muted-foreground">Spread</div>
              <div
                className={cn(
                  "font-semibold",
                  spread.status.status === "HIGH"
                    ? "text-orange-500"
                    : spread.status.status === "LOW"
                    ? "text-blue-500"
                    : ""
                )}
              >
                {spread.spread.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Converted Levels */}
        {levels && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">XAU Trading Levels</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 text-xs"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Support (Put Wall) */}
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mb-1">
                  <TrendingUp className="h-3 w-3" />
                  Buy Zone (แนวรับ)
                </div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {levels.xau.put_wall.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  CME: {levels.cme.put_wall}
                </div>
              </div>

              {/* Resistance (Call Wall) */}
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 mb-1">
                  <TrendingDown className="h-3 w-3" />
                  Sell Zone (แนวต้าน)
                </div>
                <div className="text-lg font-bold text-red-600 dark:text-red-400">
                  {levels.xau.call_wall.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  CME: {levels.cme.call_wall}
                </div>
              </div>
            </div>

            {/* Max Pain */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-500" />
                <span className="text-sm">Max Pain (XAU)</span>
              </div>
              <div className="font-bold text-purple-600 dark:text-purple-400">
                {levels.xau.max_pain.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Trading Zones */}
        {tradingZones && (
          <div className="bg-muted/30 rounded-lg p-3">
            <div
              className={cn(
                "text-sm font-medium mb-2",
                getPositionColor(tradingZones.current_position)
              )}
            >
              {getPositionLabel(tradingZones.current_position)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">ห่างจากแนวรับ: </span>
                <span
                  className={cn(
                    tradingZones.distance_to_support > 0
                      ? "text-green-500"
                      : "text-red-500"
                  )}
                >
                  {tradingZones.distance_to_support.toFixed(2)} pts
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">ห่างจากแนวต้าน: </span>
                <span
                  className={cn(
                    tradingZones.distance_to_resistance > 0
                      ? "text-red-500"
                      : "text-green-500"
                  )}
                >
                  {tradingZones.distance_to_resistance.toFixed(2)} pts
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh()}
          disabled={isValidating}
          className="w-full"
        >
          {isValidating ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          อัพเดทราคา
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================
// Manual Input Form
// ============================================

function ManualInputForm({ onSuccess }: { onSuccess: () => void }) {
  const [xauPrice, setXauPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { submitXauPrice } = useManualXauInput();

  const handleSubmit = async () => {
    const price = parseFloat(xauPrice);
    if (isNaN(price) || price <= 0) {
      alert("กรุณากรอกราคาที่ถูกต้อง");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitXauPrice(price);
      if (result.success) {
        onSuccess();
      } else {
        alert(result.error || "เกิดข้อผิดพลาด");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-2">
      <div className="text-sm font-medium">กรอกราคา XAU/USD</div>
      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="เช่น 2735.50"
          value={xauPrice}
          onChange={(e) => setXauPrice(e.target.value)}
          step="0.01"
        />
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "..." : "ตกลง"}
        </Button>
      </div>
      <div className="text-xs text-muted-foreground">
        ดูราคาจาก MT4/MT5 หรือ TradingView
      </div>
    </div>
  );
}

// ============================================
// Skeleton Loading
// ============================================

function XauConverterSkeleton() {
  return (
    <Card className="border-border/40">
      <CardHeader className="pb-3">
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

// ============================================
// Compact XAU Display (for header/sidebar)
// ============================================

export function XauPriceCompact() {
  const { xau, spread, isLoading, isError } = useXauPrice(30000, false);

  if (isLoading || isError || !xau) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>XAU:</span>
        <Skeleton className="h-4 w-16" />
      </div>
    );
  }

  const priceChange = formatPriceChange(xau.change, xau.changePercent);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">XAU:</span>
      <span className="font-semibold">${xau.price.toFixed(2)}</span>
      <span
        className={cn(
          "text-xs",
          priceChange.color === "green"
            ? "text-green-500"
            : priceChange.color === "red"
            ? "text-red-500"
            : "text-muted-foreground"
        )}
      >
        {priceChange.icon}
      </span>
      {spread && (
        <span className="text-xs text-muted-foreground">
          (Spread: {spread.spread.toFixed(1)})
        </span>
      )}
    </div>
  );
}

// ============================================
// Level Comparison Table
// ============================================

export function LevelComparisonTable() {
  const { levels, isLoading } = useXauPrice(30000, true);

  if (isLoading || !levels) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  const rows = [
    { label: "Put Wall (แนวรับ)", cme: levels.cme.put_wall, xau: levels.xau.put_wall, type: "support" },
    { label: "Call Wall (แนวต้าน)", cme: levels.cme.call_wall, xau: levels.xau.call_wall, type: "resistance" },
    { label: "Max Pain", cme: levels.cme.max_pain, xau: levels.xau.max_pain, type: "neutral" },
    ...levels.cme.support_levels.map((cme, i) => ({
      label: `Support ${i + 1}`,
      cme,
      xau: levels.xau.support_levels[i],
      type: "support" as const,
    })),
    ...levels.cme.resistance_levels.map((cme, i) => ({
      label: `Resistance ${i + 1}`,
      cme,
      xau: levels.xau.resistance_levels[i],
      type: "resistance" as const,
    })),
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-medium">ระดับ</th>
            <th className="text-right py-2 font-medium">CME</th>
            <th className="text-right py-2 font-medium">XAU</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50">
              <td className="py-2">{row.label}</td>
              <td className="text-right py-2 text-muted-foreground">
                {row.cme?.toFixed(2) || "-"}
              </td>
              <td
                className={cn(
                  "text-right py-2 font-medium",
                  row.type === "support"
                    ? "text-green-500"
                    : row.type === "resistance"
                    ? "text-red-500"
                    : "text-purple-500"
                )}
              >
                {row.xau?.toFixed(2) || "-"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-muted/30">
            <td className="py-2 font-medium">Spread</td>
            <td colSpan={2} className="text-right py-2 font-medium">
              {levels.spread.toFixed(2)} pts
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
