"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  Clock,
  RefreshCw,
  CheckCircle,
  XCircle,
  ArrowRight,
  Shield,
  Zap,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Types
// ============================================

interface AIAnalysisResult {
  recommendation: "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";
  confidence: number;
  entry_zone: {
    start: number;
    end: number;
    description: string;
  };
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  take_profit_3?: number;
  risk_reward_ratio: number;
  summary: string;
  reasoning: string[];
  bullish_factors: string[];
  bearish_factors: string[];
  warnings: string[];
  suggested_timeframe: string;
  model: string;
  processing_time_ms: number;
}

interface AIAnalysisResponse {
  success: boolean;
  analysis?: AIAnalysisResult;
  input_data?: Record<string, unknown>;
  processing_time_ms?: number;
  error?: string;
  suggestion?: string;
}

// ============================================
// Helper Functions
// ============================================

function getRecommendationConfig(rec: string) {
  switch (rec) {
    case "STRONG_BUY":
      return {
        label: "ซื้อแรง",
        emoji: "🚀",
        color: "bg-green-600",
        textColor: "text-green-600",
        borderColor: "border-green-600",
        gradient: "from-green-600 to-emerald-500",
      };
    case "BUY":
      return {
        label: "ซื้อ",
        emoji: "📈",
        color: "bg-green-500",
        textColor: "text-green-500",
        borderColor: "border-green-500",
        gradient: "from-green-500 to-emerald-400",
      };
    case "NEUTRAL":
      return {
        label: "รอดู",
        emoji: "➡️",
        color: "bg-yellow-500",
        textColor: "text-yellow-500",
        borderColor: "border-yellow-500",
        gradient: "from-yellow-500 to-amber-400",
      };
    case "SELL":
      return {
        label: "ขาย",
        emoji: "📉",
        color: "bg-red-500",
        textColor: "text-red-500",
        borderColor: "border-red-500",
        gradient: "from-red-500 to-rose-400",
      };
    case "STRONG_SELL":
      return {
        label: "ขายแรง",
        emoji: "💥",
        color: "bg-red-600",
        textColor: "text-red-600",
        borderColor: "border-red-600",
        gradient: "from-red-600 to-rose-500",
      };
    default:
      return {
        label: rec,
        emoji: "❓",
        color: "bg-gray-500",
        textColor: "text-gray-500",
        borderColor: "border-gray-500",
        gradient: "from-gray-500 to-slate-400",
      };
  }
}

// ============================================
// Main Component
// ============================================

type AnalysisMode = "standard" | "enhanced" | "consensus";
type ProviderType = "auto" | "openai" | "gemini" | "deepseek" | "deepseek-r1";

export function AIAnalysis() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AIAnalysisResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<AnalysisMode>("enhanced");

  const runAnalysis = async (
    provider: ProviderType = "auto",
    analysisMode: AnalysisMode = mode
  ) => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          provider, 
          mode: analysisMode,
          trackPrediction: true,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyTradingPlan = async () => {
    if (!result?.analysis) return;

    const a = result.analysis;
    const text = `
🤖 AI Analysis (${a.model})
━━━━━━━━━━━━━━━━━━━━

${a.summary}

📊 สัญญาณ: ${getRecommendationConfig(a.recommendation).emoji} ${getRecommendationConfig(a.recommendation).label}
📈 ความมั่นใจ: ${a.confidence}%

💰 Entry Zone: $${a.entry_zone.start.toFixed(2)} - $${a.entry_zone.end.toFixed(2)}
🛑 Stop Loss: $${a.stop_loss.toFixed(2)}
🎯 TP1: $${a.take_profit_1.toFixed(2)}
🎯 TP2: $${a.take_profit_2.toFixed(2)}
${a.take_profit_3 ? `🎯 TP3: $${a.take_profit_3.toFixed(2)}` : ""}

⚖️ Risk/Reward: 1:${a.risk_reward_ratio.toFixed(1)}
⏰ Timeframe: ${a.suggested_timeframe}

⚠️ ข้อควรระวัง:
${a.warnings.map(w => `• ${w}`).join("\n")}
`.trim();

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Brain className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">AI Market Analysis</h2>
              <p className="text-sm text-muted-foreground font-normal">
                วิเคราะห์ตลาดด้วย AI พร้อมจุดเข้าและ Stop Loss
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mode Selection */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={mode === "enhanced" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("enhanced")}
              className={mode === "enhanced" ? "bg-purple-600" : ""}
            >
              🚀 Enhanced
            </Button>
            <Button
              variant={mode === "consensus" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("consensus")}
              className={mode === "consensus" ? "bg-blue-600" : ""}
            >
              🤝 Multi-AI
            </Button>
            <Button
              variant={mode === "standard" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("standard")}
              className={mode === "standard" ? "bg-gray-600" : ""}
            >
              📊 Standard
            </Button>
          </div>

          {/* Mode Description */}
          <div className="text-xs text-muted-foreground mb-4 p-2 bg-muted/50 rounded-lg">
            {mode === "enhanced" && (
              <span>✨ รวม Technical Indicators, ประวัติสัญญาณ, ปฏิทินเศรษฐกิจ และติดตามความแม่นยำ</span>
            )}
            {mode === "consensus" && (
              <span>🤝 ใช้หลาย AI วิเคราะห์พร้อมกันแล้วสรุปความเห็นรวม</span>
            )}
            {mode === "standard" && (
              <span>📊 วิเคราะห์ด้วย AI ตัวเดียวตามข้อมูล Options</span>
            )}
          </div>

          {/* Main Analysis Button */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => runAnalysis("auto", mode)}
              disabled={isLoading}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  กำลังวิเคราะห์...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {mode === "consensus" ? "วิเคราะห์ด้วย Multi-AI" : "วิเคราะห์ด้วย AI"}
                </>
              )}
            </Button>
          </div>

          {/* Provider Selection (for standard/enhanced mode) */}
          {mode !== "consensus" && (
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-xs text-muted-foreground self-center mr-2">เลือก AI:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runAnalysis("deepseek", mode)}
                disabled={isLoading}
                className="border-cyan-500/50 hover:bg-cyan-500/10"
              >
                <Zap className="h-3 w-3 mr-1 text-cyan-500" />
                DeepSeek
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runAnalysis("deepseek-r1", mode)}
                disabled={isLoading}
                className="border-cyan-600/50 hover:bg-cyan-600/10"
              >
                <Brain className="h-3 w-3 mr-1 text-cyan-600" />
                R1
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runAnalysis("gemini", mode)}
                disabled={isLoading}
                className="border-blue-500/50 hover:bg-blue-500/10"
              >
                <Zap className="h-3 w-3 mr-1 text-blue-500" />
                Gemini
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runAnalysis("openai", mode)}
                disabled={isLoading}
                className="border-green-500/50 hover:bg-green-500/10"
              >
                <Brain className="h-3 w-3 mr-1 text-green-500" />
                GPT-4
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && <AIAnalysisSkeleton />}

      {/* Error State */}
      {result && !result.success && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500 shrink-0" />
              <div>
                <p className="font-medium text-red-500">เกิดข้อผิดพลาด</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.error}
                </p>
                {result.suggestion && (
                  <p className="text-sm text-muted-foreground mt-2">
                    💡 {result.suggestion}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success State */}
      {result?.success && result.analysis && (
        <AIAnalysisResult
          analysis={result.analysis}
          onCopy={copyTradingPlan}
          copied={copied}
        />
      )}
    </div>
  );
}

// ============================================
// Analysis Result Component
// ============================================

function AIAnalysisResult({
  analysis,
  onCopy,
  copied,
}: {
  analysis: AIAnalysisResult;
  onCopy: () => void;
  copied: boolean;
}) {
  const config = getRecommendationConfig(analysis.recommendation);

  return (
    <div className="space-y-4">
      {/* Main Recommendation */}
      <Card className={cn("border-2", config.borderColor, "bg-gradient-to-r", config.gradient, "bg-opacity-10")}>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={cn("text-5xl")}>
                {config.emoji}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-3xl font-bold", config.textColor)}>
                    {config.label}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {analysis.model}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground">ความมั่นใจ:</span>
                  <div className="flex items-center gap-1">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", config.color)}
                        style={{ width: `${analysis.confidence}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{analysis.confidence}%</span>
                  </div>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onCopy}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Plan
                </>
              )}
            </Button>
          </div>

          {/* Summary */}
          <div className="mt-4 p-4 bg-background/50 rounded-lg">
            <p className="text-sm leading-relaxed">{analysis.summary}</p>
          </div>
        </CardContent>
      </Card>

      {/* Trading Levels */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Entry Zone */}
        <Card className="border-blue-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              Entry Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              ${analysis.entry_zone.start.toFixed(2)} - ${analysis.entry_zone.end.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analysis.entry_zone.description}
            </p>
          </CardContent>
        </Card>

        {/* Stop Loss */}
        <Card className="border-red-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-500" />
              Stop Loss
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              ${analysis.stop_loss.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ตั้ง SL ไว้เสมอเพื่อจำกัดความเสี่ยง
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Take Profits */}
      <Card className="border-green-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Take Profit Targets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-green-500/10 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">TP1</div>
              <div className="text-lg font-bold text-green-500">
                ${analysis.take_profit_1.toFixed(2)}
              </div>
            </div>
            <div className="text-center p-3 bg-green-500/15 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">TP2</div>
              <div className="text-lg font-bold text-green-500">
                ${analysis.take_profit_2.toFixed(2)}
              </div>
            </div>
            {analysis.take_profit_3 && (
              <div className="text-center p-3 bg-green-500/20 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">TP3</div>
                <div className="text-lg font-bold text-green-500">
                  ${analysis.take_profit_3.toFixed(2)}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Risk/Reward:</span>
              <span className="font-bold">1:{analysis.risk_reward_ratio.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{analysis.suggested_timeframe}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Factors */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Bullish Factors */}
        <Card className="border-green-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              ปัจจัยบวก
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.bullish_factors.map((factor, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-green-500 shrink-0">✓</span>
                  <span>{factor}</span>
                </li>
              ))}
              {analysis.bullish_factors.length === 0 && (
                <li className="text-sm text-muted-foreground">ไม่มี</li>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Bearish Factors */}
        <Card className="border-red-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              ปัจจัยลบ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.bearish_factors.map((factor, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-red-500 shrink-0">✗</span>
                  <span>{factor}</span>
                </li>
              ))}
              {analysis.bearish_factors.length === 0 && (
                <li className="text-sm text-muted-foreground">ไม่มี</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Reasoning */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4" />
            เหตุผลการวิเคราะห์
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {analysis.reasoning.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <ArrowRight className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Warnings */}
      {analysis.warnings.length > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              ข้อควรระวัง
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.warnings.map((warning, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-yellow-500 shrink-0">⚠</span>
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Processing Info */}
      <div className="text-center text-xs text-muted-foreground">
        วิเคราะห์โดย {analysis.model} • ใช้เวลา {(analysis.processing_time_ms / 1000).toFixed(1)} วินาที
      </div>
    </div>
  );
}

// ============================================
// Skeleton Loading
// ============================================

function AIAnalysisSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <Skeleton className="h-20 w-full mt-4" />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>

      <Skeleton className="h-40 w-full" />
    </div>
  );
}
