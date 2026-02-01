"use client";

import { useAnalysis, getSignalColor, getSignalBgColor, getSignalLabel } from "@/hooks/use-analysis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonCircle, SkeletonSignal } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Target,
  Shield,
  BarChart3,
  Zap,
} from "lucide-react";

// ============================================
// Signal Display Component
// ============================================

interface SignalDisplayProps {
  product?: string;
  refreshInterval?: number;
  compact?: boolean;
}

export function SignalDisplay({
  product,
  refreshInterval = 60000,
  compact = false,
}: SignalDisplayProps) {
  const { data, isLoading, isValidating, isError, error, refresh, generatedAt } = useAnalysis(
    product,
    refreshInterval
  );

  // Loading state
  if (isLoading && !data) {
    return <SkeletonSignal />;
  }

  // Error state
  if (isError || !data) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center justify-center h-32 gap-2">
          <p className="text-destructive text-sm">{error || "ไม่สามารถโหลดข้อมูลได้"}</p>
          <Button variant="outline" size="sm" onClick={() => refresh()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            ลองใหม่
          </Button>
        </CardContent>
      </Card>
    );
  }

  const signal = data.signal;
  const signalType = signal?.type || "NEUTRAL";
  const signalColor = getSignalColor(signalType);
  const signalBgColor = getSignalBgColor(signalType);
  const signalLabel = getSignalLabel(signalType);

  // Compact view
  if (compact) {
    return (
      <Card className="border-border/40">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`${signalBgColor} text-white p-2 rounded-lg`}>
                {signalType.includes("BUY") ? (
                  <TrendingUp className="h-5 w-5" />
                ) : signalType.includes("SELL") ? (
                  <TrendingDown className="h-5 w-5" />
                ) : (
                  <Minus className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className={`font-bold text-lg ${signalColor}`}>{signalLabel}</p>
                <p className="text-xs text-muted-foreground">
                  Score: {signal?.strength}/5 • {signal?.confidence}%
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refresh()}
              disabled={isValidating}
            >
              <RefreshCw className={`h-4 w-4 ${isValidating ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full view
  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" />
            สัญญาณเทรด
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refresh()}
            disabled={isValidating}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isValidating ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Signal Badge */}
        <div className="flex items-center justify-center py-4">
          <div className={`${signalBgColor} text-white px-6 py-3 rounded-xl flex items-center gap-3 shadow-lg`}>
            {signalType.includes("BUY") ? (
              <TrendingUp className="h-6 w-6" />
            ) : signalType.includes("SELL") ? (
              <TrendingDown className="h-6 w-6" />
            ) : (
              <Minus className="h-6 w-6" />
            )}
            <div>
              <span className="text-xl font-bold">{signalLabel}</span>
              {signal?.sentiment && (
                <p className="text-xs opacity-80">{signal.sentiment}</p>
              )}
            </div>
          </div>
        </div>

        {/* Confidence Score (0-100) */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">Confidence Score</p>
          <div className="relative w-full h-4 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full ${signalBgColor} transition-all duration-500`}
              style={{ width: `${signal?.confidence || 0}%` }}
            />
          </div>
          <p className={`text-2xl font-bold mt-2 ${signalColor}`}>
            {signal?.confidence}%
          </p>
        </div>

        {/* Reason */}
        <div className="border-t border-border/40 pt-4">
          <p className="text-sm text-center text-muted-foreground">
            {signal?.reason}
          </p>
        </div>

        {/* Scoring Visualization */}
        {signal?.factorScores && (
          <div className="border-t border-border/40 pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">📊 Factor Breakdown</p>
            <div className="space-y-2">
              {/* Base Score */}
              <div className="flex items-center gap-2">
                <span className="text-xs w-24 text-muted-foreground">Base</span>
                <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-500" style={{ width: '50%' }} />
                </div>
                <span className="text-xs w-12 text-right font-mono text-gray-400">50</span>
              </div>
              
              {/* PCR Score */}
              <div className="flex items-center gap-2">
                <span className="text-xs w-24 text-muted-foreground">PCR</span>
                <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-px h-full bg-gray-500" />
                  </div>
                  {signal.factorScores.pcr_score > 0 ? (
                    <div 
                      className="h-full bg-green-500 ml-[50%]" 
                      style={{ width: `${Math.abs(signal.factorScores.pcr_score) * 2}%` }} 
                    />
                  ) : signal.factorScores.pcr_score < 0 ? (
                    <div 
                      className="h-full bg-red-500" 
                      style={{ width: `${Math.abs(signal.factorScores.pcr_score) * 2}%`, marginLeft: `${50 - Math.abs(signal.factorScores.pcr_score) * 2}%` }} 
                    />
                  ) : null}
                </div>
                <span className={`text-xs w-12 text-right font-mono ${signal.factorScores.pcr_score > 0 ? 'text-green-400' : signal.factorScores.pcr_score < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {signal.factorScores.pcr_score > 0 ? '+' : ''}{signal.factorScores.pcr_score}
                </span>
              </div>
              
              {/* VWAP Score */}
              <div className="flex items-center gap-2">
                <span className="text-xs w-24 text-muted-foreground">VWAP Trend</span>
                <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-px h-full bg-gray-500" />
                  </div>
                  {signal.factorScores.vwap_score > 0 ? (
                    <div 
                      className="h-full bg-green-500 ml-[50%]" 
                      style={{ width: `${Math.abs(signal.factorScores.vwap_score) * 2}%` }} 
                    />
                  ) : signal.factorScores.vwap_score < 0 ? (
                    <div 
                      className="h-full bg-red-500" 
                      style={{ width: `${Math.abs(signal.factorScores.vwap_score) * 2}%`, marginLeft: `${50 - Math.abs(signal.factorScores.vwap_score) * 2}%` }} 
                    />
                  ) : null}
                </div>
                <span className={`text-xs w-12 text-right font-mono ${signal.factorScores.vwap_score > 0 ? 'text-green-400' : signal.factorScores.vwap_score < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {signal.factorScores.vwap_score > 0 ? '+' : ''}{signal.factorScores.vwap_score}
                </span>
              </div>
              
              {/* OI Flow Score */}
              <div className="flex items-center gap-2">
                <span className="text-xs w-24 text-muted-foreground">OI Flow</span>
                <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-px h-full bg-gray-500" />
                  </div>
                  {signal.factorScores.flow_score > 0 ? (
                    <div 
                      className="h-full bg-green-500 ml-[50%]" 
                      style={{ width: `${Math.abs(signal.factorScores.flow_score) * 2}%` }} 
                    />
                  ) : signal.factorScores.flow_score < 0 ? (
                    <div 
                      className="h-full bg-red-500" 
                      style={{ width: `${Math.abs(signal.factorScores.flow_score) * 2}%`, marginLeft: `${50 - Math.abs(signal.factorScores.flow_score) * 2}%` }} 
                    />
                  ) : null}
                </div>
                <span className={`text-xs w-12 text-right font-mono ${signal.factorScores.flow_score > 0 ? 'text-green-400' : signal.factorScores.flow_score < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {signal.factorScores.flow_score > 0 ? '+' : ''}{signal.factorScores.flow_score}
                </span>
              </div>
              
              {/* Wall Score */}
              <div className="flex items-center gap-2">
                <span className="text-xs w-24 text-muted-foreground">Wall Position</span>
                <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-px h-full bg-gray-500" />
                  </div>
                  {signal.factorScores.wall_score > 0 ? (
                    <div 
                      className="h-full bg-green-500 ml-[50%]" 
                      style={{ width: `${Math.min(Math.abs(signal.factorScores.wall_score) * 2, 50)}%` }} 
                    />
                  ) : signal.factorScores.wall_score < 0 ? (
                    <div 
                      className="h-full bg-red-500" 
                      style={{ width: `${Math.min(Math.abs(signal.factorScores.wall_score) * 2, 50)}%`, marginLeft: `${50 - Math.min(Math.abs(signal.factorScores.wall_score) * 2, 50)}%` }} 
                    />
                  ) : null}
                </div>
                <span className={`text-xs w-12 text-right font-mono ${signal.factorScores.wall_score > 0 ? 'text-green-400' : signal.factorScores.wall_score < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {signal.factorScores.wall_score > 0 ? '+' : ''}{signal.factorScores.wall_score}
                </span>
              </div>
              
              {/* Max Pain Score */}
              <div className="flex items-center gap-2">
                <span className="text-xs w-24 text-muted-foreground">Max Pain</span>
                <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-px h-full bg-gray-500" />
                  </div>
                  {signal.factorScores.max_pain_score > 0 ? (
                    <div 
                      className="h-full bg-green-500 ml-[50%]" 
                      style={{ width: `${Math.abs(signal.factorScores.max_pain_score) * 2}%` }} 
                    />
                  ) : signal.factorScores.max_pain_score < 0 ? (
                    <div 
                      className="h-full bg-red-500" 
                      style={{ width: `${Math.abs(signal.factorScores.max_pain_score) * 2}%`, marginLeft: `${50 - Math.abs(signal.factorScores.max_pain_score) * 2}%` }} 
                    />
                  ) : null}
                </div>
                <span className={`text-xs w-12 text-right font-mono ${signal.factorScores.max_pain_score > 0 ? 'text-green-400' : signal.factorScores.max_pain_score < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {signal.factorScores.max_pain_score > 0 ? '+' : ''}{signal.factorScores.max_pain_score}
                </span>
              </div>
              
              {/* Total Line */}
              <div className="border-t border-border/40 mt-2 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs w-24 font-medium text-foreground">TOTAL</span>
                  <div className="flex-1 h-4 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        (signal?.confidence || 50) >= 60 ? 'bg-green-500' : 
                        (signal?.confidence || 50) <= 40 ? 'bg-red-500' : 
                        'bg-yellow-500'
                      }`}
                      style={{ width: `${signal?.confidence || 50}%` }}
                    />
                  </div>
                  <span className={`text-sm w-12 text-right font-mono font-bold ${
                    (signal?.confidence || 50) >= 60 ? 'text-green-400' : 
                    (signal?.confidence || 50) <= 40 ? 'text-red-400' : 
                    'text-yellow-400'
                  }`}>
                    {signal?.confidence || 50}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Positive Factors */}
        {signal?.positiveFactors && signal.positiveFactors.length > 0 && (
          <div className="border-t border-border/40 pt-4">
            <p className="text-xs font-medium text-green-400 mb-2">✓ ปัจจัยบวก (Bullish)</p>
            <ul className="space-y-1">
              {signal.positiveFactors.map((factor: string, i: number) => (
                <li key={i} className="text-xs text-green-400/80 flex items-start gap-2">
                  <span>+</span>
                  {factor}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Negative Factors */}
        {signal?.negativeFactors && signal.negativeFactors.length > 0 && (
          <div className="border-t border-border/40 pt-4">
            <p className="text-xs font-medium text-red-400 mb-2">✗ ปัจจัยลบ (Bearish)</p>
            <ul className="space-y-1">
              {signal.negativeFactors.map((factor: string, i: number) => (
                <li key={i} className="text-xs text-red-400/80 flex items-start gap-2">
                  <span>-</span>
                  {factor}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Key Levels */}
        {data.keyLevels && (
          <div className="border-t border-border/40 pt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-green-400 mb-1 flex items-center gap-1">
                <Shield className="h-3 w-3" /> แนวรับ
              </p>
              {data.keyLevels.support.slice(0, 2).map((s, i) => (
                <p key={i} className="text-sm font-mono">
                  {formatNumber(s.strike, 0)}
                </p>
              ))}
            </div>
            <div>
              <p className="text-xs text-red-400 mb-1 flex items-center gap-1">
                <Shield className="h-3 w-3" /> แนวต้าน
              </p>
              {data.keyLevels.resistance.slice(0, 2).map((s, i) => (
                <p key={i} className="text-sm font-mono">
                  {formatNumber(s.strike, 0)}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* PCR & Max Pain */}
        {(data.pcr || data.maxPain) && (
          <div className="border-t border-border/40 pt-4 flex justify-between text-sm">
            {data.pcr && (
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">PCR:</span>
                <span className={getSignalColor(data.pcr.oiPcr < 0.8 ? "BULLISH" : data.pcr.oiPcr > 1.2 ? "BEARISH" : "NEUTRAL")}>
                  {data.pcr.oiPcr?.toFixed(2)}
                </span>
              </div>
            )}
            {data.maxPain && (
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Max Pain:</span>
                <span className="text-primary font-mono">
                  {formatNumber(data.maxPain.maxPainStrike, 0)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        {generatedAt && (
          <p className="text-xs text-center text-muted-foreground pt-2">
            อัพเดท: {new Date(generatedAt).toLocaleString("th-TH")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Quick Signal Badge (Inline)
// ============================================

interface QuickSignalProps {
  product?: string;
}

export function QuickSignal({ product }: QuickSignalProps) {
  const { data, isLoading } = useAnalysis(product, 60000);

  if (isLoading || !data) {
    return (
      <Skeleton className="h-6 w-16 rounded-full" />
    );
  }

  const signalType = data.signal?.type || "NEUTRAL";
  const signalLabel = getSignalLabel(signalType);
  const variant = signalType.includes("BUY")
    ? "buy"
    : signalType.includes("SELL")
    ? "sell"
    : "neutral";

  return (
    <Badge variant={variant} className="flex items-center gap-1">
      {signalType.includes("BUY") ? (
        <TrendingUp className="h-3 w-3" />
      ) : signalType.includes("SELL") ? (
        <TrendingDown className="h-3 w-3" />
      ) : (
        <Minus className="h-3 w-3" />
      )}
      {signalLabel}
    </Badge>
  );
}

// ============================================
// Signal Summary Card (Human-Readable Explanation)
// ============================================

interface SignalSummaryProps {
  product?: string;
  refreshInterval?: number;
}

export function SignalSummary({ product, refreshInterval = 60000 }: SignalSummaryProps) {
  const { data, isLoading, isError } = useAnalysis(product, refreshInterval);

  if (isLoading && !data) {
    return (
      <Card className="border-border/40 h-full">
        <CardContent className="p-5 space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="pt-4 border-t border-border/40 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !data?.signal?.summary) {
    return (
      <Card className="border-border/40 h-full">
        <CardContent className="flex items-center justify-center h-64 p-6">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">ไม่มีข้อมูล</p>
            <p className="text-xs mt-1">รอข้อมูลจาก Extension</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/40 h-full overflow-hidden">
      <CardContent className="p-0">
        <div className="max-h-[600px] overflow-y-auto">
          <div className="p-5 space-y-4">
            {/* Parse and render summary with better formatting */}
            {data.signal.summary.split('\n\n').map((section, idx) => (
              <div key={idx} className="space-y-2">
                {section.split('\n').map((line, lineIdx) => {
                  // Emoji headers
                  if (line.startsWith('🟢') || line.startsWith('🔴') || line.startsWith('⚪')) {
                    return (
                      <p key={lineIdx} className={`font-semibold text-sm ${
                        line.startsWith('🟢') ? 'text-green-400' :
                        line.startsWith('🔴') ? 'text-red-400' :
                        'text-yellow-400'
                      }`}>
                        {line}
                      </p>
                    );
                  }
                  // Section headers
                  if (line.startsWith('📊') || line.startsWith('📍') || line.startsWith('💡') || line.startsWith('🎯')) {
                    return (
                      <p key={lineIdx} className="font-medium text-sm text-primary pt-2 border-t border-border/30 mt-3">
                        {line}
                      </p>
                    );
                  }
                  // Positive items
                  if (line.startsWith('✅')) {
                    return (
                      <p key={lineIdx} className="text-xs text-green-400/90 pl-1">
                        {line}
                      </p>
                    );
                  }
                  // Negative items
                  if (line.startsWith('⚠️')) {
                    return (
                      <p key={lineIdx} className="text-xs text-red-400/90 pl-1">
                        {line}
                      </p>
                    );
                  }
                  // Indented explanation
                  if (line.startsWith('   →') || line.startsWith('   •')) {
                    return (
                      <p key={lineIdx} className="text-xs text-muted-foreground pl-4">
                        {line.trim()}
                      </p>
                    );
                  }
                  // Regular text
                  if (line.trim()) {
                    return (
                      <p key={lineIdx} className="text-xs text-muted-foreground">
                        {line}
                      </p>
                    );
                  }
                  return null;
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Signal Stats Row Component
// ============================================

interface SignalStatsProps {
  product?: string;
  refreshInterval?: number;
}

export function SignalStats({ product, refreshInterval = 60000 }: SignalStatsProps) {
  const { data, isLoading } = useAnalysis(product, refreshInterval);

  const signal = data?.signal;
  const pcr = data?.pcr;
  const maxPain = data?.maxPain;

  // Determine sentiment color
  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case "Bullish": return "text-green-500";
      case "Bearish": return "text-red-500";
      default: return "text-yellow-500";
    }
  };

  const getSentimentBg = (sentiment?: string) => {
    switch (sentiment) {
      case "Bullish": return "from-green-500/5";
      case "Bearish": return "from-red-500/5";
      default: return "from-yellow-500/5";
    }
  };

  const getSentimentIcon = (sentiment?: string) => {
    switch (sentiment) {
      case "Bullish": return "bg-green-500/10";
      case "Bearish": return "bg-red-500/10";
      default: return "bg-yellow-500/10";
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {/* Market Status */}
      <div className={`rounded-xl border border-border/40 bg-gradient-to-br ${getSentimentBg(signal?.sentiment)} to-transparent p-4`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${getSentimentIcon(signal?.sentiment)}`}>
            {signal?.sentiment === "Bullish" ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : signal?.sentiment === "Bearish" ? (
              <TrendingDown className="h-4 w-4 text-red-500" />
            ) : (
              <Minus className="h-4 w-4 text-yellow-500" />
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">สถานะตลาด</p>
            <p className={`font-semibold ${getSentimentColor(signal?.sentiment)}`}>
              {isLoading ? "กำลังโหลด..." : signal?.sentiment || "ไม่ทราบ"}
            </p>
          </div>
        </div>
      </div>

      {/* PCR */}
      <div className="rounded-xl border border-border/40 bg-gradient-to-br from-blue-500/5 to-transparent p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">PCR (OI)</p>
            <p className="font-semibold font-mono">
              {isLoading ? "--" : pcr?.oiPcr?.toFixed(2) || "--"}
            </p>
          </div>
        </div>
      </div>

      {/* Max Pain */}
      <div className="rounded-xl border border-border/40 bg-gradient-to-br from-purple-500/5 to-transparent p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Target className="h-4 w-4 text-purple-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Max Pain</p>
            <p className="font-semibold font-mono">
              {isLoading ? "--" : maxPain?.maxPainStrike ? formatNumber(maxPain.maxPainStrike, 0) : "--"}
            </p>
          </div>
        </div>
      </div>

      {/* Confidence */}
      <div className="rounded-xl border border-border/40 bg-gradient-to-br from-orange-500/5 to-transparent p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <Zap className="h-4 w-4 text-orange-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Confidence</p>
            <p className={`font-semibold font-mono ${
              (signal?.confidence || 0) >= 60 ? "text-green-500" :
              (signal?.confidence || 0) <= 40 ? "text-red-500" :
              "text-yellow-500"
            }`}>
              {isLoading ? "--%" : signal?.confidence ? `${signal.confidence}%` : "--%"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
