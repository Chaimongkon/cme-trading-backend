"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, CheckCircle, XCircle, MinusCircle } from "lucide-react";

interface SignalFactor {
  value?: number;
  signal: string;
  weight?: number;
  priceDistance?: number;
  putChange?: number;
  callChange?: number;
}

interface SignalCardProps {
  signal?: {
    type: "BUY" | "SELL" | "NEUTRAL";
    strength: number;
    reason: string;
    factors?: {
      pcr?: SignalFactor;
      atmPcr?: SignalFactor;
      maxPain?: SignalFactor;
      oiTrend?: SignalFactor;
      atmOiBuildup?: SignalFactor;
      keyLevels?: {
        support: number[];
        resistance: number[];
      };
    };
  };
  createdAt?: string;
}

export function SignalCard({ signal, createdAt }: SignalCardProps) {
  if (!signal) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">สัญญาณปัจจุบัน</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">ไม่มีข้อมูลสัญญาณ</p>
        </CardContent>
      </Card>
    );
  }

  const SignalIcon =
    signal.type === "BUY"
      ? TrendingUp
      : signal.type === "SELL"
        ? TrendingDown
        : Minus;

  const signalColor =
    signal.type === "BUY"
      ? "text-green-500"
      : signal.type === "SELL"
        ? "text-red-500"
        : "text-gray-400";

  const signalBg =
    signal.type === "BUY"
      ? "bg-green-500/10 border-green-500/30"
      : signal.type === "SELL"
        ? "bg-red-500/10 border-red-500/30"
        : "bg-gray-500/10 border-gray-500/30";

  const getFactorIcon = (factorSignal: string) => {
    if (factorSignal === "BULLISH") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (factorSignal === "BEARISH") return <XCircle className="h-4 w-4 text-red-500" />;
    return <MinusCircle className="h-4 w-4 text-gray-400" />;
  };

  return (
    <Card className={cn("border-2", signalBg)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">สัญญาณปัจจุบัน</CardTitle>
          {createdAt && (
            <span className="text-xs text-muted-foreground">
              {new Date(createdAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Signal */}
        <div className="flex items-center gap-4">
          <div className={cn("rounded-full p-4", signalBg)}>
            <SignalIcon className={cn("h-8 w-8", signalColor)} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={cn("text-3xl font-bold", signalColor)}>
                {signal.type}
              </span>
              <Badge
                variant={
                  signal.type === "BUY"
                    ? "buy"
                    : signal.type === "SELL"
                      ? "sell"
                      : "neutral"
                }
              >
                {"*".repeat(signal.strength)} ({signal.strength}/5)
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{signal.reason}</p>
          </div>
        </div>

        {/* Factors */}
        {signal.factors && (
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-sm font-medium text-muted-foreground">ปัจจัยการวิเคราะห์</p>
            <div className="grid gap-2">
              {signal.factors.pcr && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {getFactorIcon(signal.factors.pcr.signal)}
                    <span>อัตราส่วน Put/Call</span>
                  </div>
                  <span className="text-muted-foreground">
                    {signal.factors.pcr.value?.toFixed(3)} ({signal.factors.pcr.signal})
                  </span>
                </div>
              )}
              {signal.factors.maxPain && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {getFactorIcon(signal.factors.maxPain.signal)}
                    <span>Max Pain</span>
                  </div>
                  <span className="text-muted-foreground">
                    {signal.factors.maxPain.value?.toFixed(0)} (
                    {signal.factors.maxPain.priceDistance !== undefined &&
                      (signal.factors.maxPain.priceDistance > 0 ? "+" : "")}
                    {signal.factors.maxPain.priceDistance?.toFixed(0)})
                  </span>
                </div>
              )}
              {signal.factors.oiTrend && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {getFactorIcon(signal.factors.oiTrend.signal)}
                    <span>แนวโน้ม OI</span>
                  </div>
                  <span className="text-muted-foreground">
                    {signal.factors.oiTrend.signal}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Key Levels */}
        {signal.factors?.keyLevels && (
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-sm font-medium text-muted-foreground">ระดับสำคัญ</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-green-500 mb-1">แนวรับ</p>
                <div className="flex flex-wrap gap-1">
                  {signal.factors.keyLevels.support.slice(0, 3).map((level, i) => (
                    <Badge key={i} variant="outline" className="text-green-500 border-green-500/30">
                      {level.toFixed(0)}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-red-500 mb-1">แนวต้าน</p>
                <div className="flex flex-wrap gap-1">
                  {signal.factors.keyLevels.resistance.slice(0, 3).map((level, i) => (
                    <Badge key={i} variant="outline" className="text-red-500 border-red-500/30">
                      {level.toFixed(0)}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
