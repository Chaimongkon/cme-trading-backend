"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";
import { TrendingUp, TrendingDown, Target, Activity, ArrowUp, ArrowDown } from "lucide-react";

interface StatsCardsProps {
  currentPrice?: number;
  putCallRatio?: number;
  maxPainStrike?: number;
  signal?: {
    type: "BUY" | "SELL" | "NEUTRAL";
    strength: number;
  };
  priceChange?: number;
}

export function StatsCards({
  currentPrice = 0,
  putCallRatio = 0,
  maxPainStrike = 0,
  signal,
  priceChange = 0,
}: StatsCardsProps) {
  const pcrSignal =
    putCallRatio < 0.7 ? "ขาขึ้น" : putCallRatio > 1.0 ? "ขาลง" : "ทรงตัว";
  const pcrColor =
    putCallRatio < 0.7
      ? "text-green-500"
      : putCallRatio > 1.0
        ? "text-red-500"
        : "text-gray-400";

  const maxPainDiff = currentPrice > 0 ? maxPainStrike - currentPrice : 0;
  const maxPainPercent = currentPrice > 0 ? (maxPainDiff / currentPrice) * 100 : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Current Price */}
      <Card className="stats-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                ราคาปัจจุบัน
              </p>
              <p className="text-2xl font-bold text-foreground">
                {formatNumber(currentPrice, 2)}
              </p>
              {priceChange !== 0 && (
                <p
                  className={cn(
                    "text-sm flex items-center gap-1",
                    priceChange > 0 ? "text-green-500" : "text-red-500"
                  )}
                >
                  {priceChange > 0 ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <ArrowDown className="h-3 w-3" />
                  )}
                  {Math.abs(priceChange).toFixed(2)}
                </p>
              )}
            </div>
            <div className="rounded-full bg-primary/10 p-3">
              <Activity className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Put/Call Ratio */}
      <Card className="stats-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                อัตราส่วน Put/Call
              </p>
              <p className="text-2xl font-bold text-foreground">
                {formatNumber(putCallRatio, 3)}
              </p>
              <p className={cn("text-sm", pcrColor)}>{pcrSignal}</p>
            </div>
            <div
              className={cn(
                "rounded-full p-3",
                putCallRatio < 0.7
                  ? "bg-green-500/10"
                  : putCallRatio > 1.0
                    ? "bg-red-500/10"
                    : "bg-gray-500/10"
              )}
            >
              {putCallRatio < 1 ? (
                <TrendingUp className={cn("h-6 w-6", pcrColor)} />
              ) : (
                <TrendingDown className={cn("h-6 w-6", pcrColor)} />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Max Pain */}
      <Card className="stats-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Max Pain
              </p>
              <p className="text-2xl font-bold text-foreground">
                {formatNumber(maxPainStrike, 0)}
              </p>
              <p
                className={cn(
                  "text-sm",
                  maxPainDiff > 0 ? "text-green-500" : "text-red-500"
                )}
              >
                {maxPainDiff > 0 ? "+" : ""}
                {formatNumber(maxPainDiff, 0)} ({maxPainPercent.toFixed(1)}%)
              </p>
            </div>
            <div className="rounded-full bg-primary/10 p-3">
              <Target className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signal */}
      <Card
        className={cn(
          "stats-card border-2",
          signal?.type === "BUY"
            ? "border-green-500/50 bg-green-500/5"
            : signal?.type === "SELL"
              ? "border-red-500/50 bg-red-500/5"
              : "border-border"
        )}
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                สัญญาณ
              </p>
              <p
                className={cn(
                  "text-2xl font-bold",
                  signal?.type === "BUY"
                    ? "text-green-500"
                    : signal?.type === "SELL"
                      ? "text-red-500"
                      : "text-gray-400"
                )}
              >
                {signal?.type || "N/A"}
              </p>
              <p className="text-sm text-muted-foreground">
                ความแรง: {"*".repeat(signal?.strength || 0)}
              </p>
            </div>
            <div
              className={cn(
                "rounded-full p-3",
                signal?.type === "BUY"
                  ? "bg-green-500/10"
                  : signal?.type === "SELL"
                    ? "bg-red-500/10"
                    : "bg-gray-500/10"
              )}
            >
              {signal?.type === "BUY" ? (
                <TrendingUp className="h-6 w-6 text-green-500" />
              ) : signal?.type === "SELL" ? (
                <TrendingDown className="h-6 w-6 text-red-500" />
              ) : (
                <Activity className="h-6 w-6 text-gray-400" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
