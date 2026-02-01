"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Target,
    Shield,
    TrendingUp,
    CheckCircle,
    XCircle,
    AlertTriangle,
    ArrowRight,
    Copy,
    Check,
    Maximize2,
    Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AIAnalysisResult } from "./types";

interface AIResultDisplayProps {
    result: AIAnalysisResult;
}

export function AIResultDisplay({ result }: AIResultDisplayProps) {
    const [copied, setCopied] = useState(false);
    const config = getRecommendationConfig(result.recommendation);

    const copyTradingPlan = async () => {
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Hero Result Card */}
            <Card
                className={cn(
                    "border-2 overflow-hidden relative",
                    config.borderColor,
                    "bg-gradient-to-br from-background to-card"
                )}
            >
                <div
                    className={cn(
                        "absolute inset-0 opacity-10 bg-gradient-to-r",
                        config.gradient
                    )}
                />
                <CardContent className="pt-6 relative z-10">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                        {/* Signal & Confidence */}
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="bg-background/50 backdrop-blur">
                                    {result.model}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                    {result.suggested_timeframe}
                                </span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-6xl animate-bounce-slow">{config.emoji}</div>
                                <div>
                                    <h2
                                        className={cn(
                                            "text-4xl font-black tracking-tight",
                                            config.textColor
                                        )}
                                    >
                                        {config.label}
                                    </h2>
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className={cn("h-full rounded-full transition-all duration-1000", config.color)}
                                                style={{ width: `${result.confidence}%` }}
                                            />
                                        </div>
                                        <span className="font-bold text-sm">ความมั่นใจ {result.confidence}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-start">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={copyTradingPlan}
                                className="hover:bg-background/80"
                            >
                                {copied ? (
                                    <>
                                        <Check className="h-4 w-4 mr-2 text-green-500" />
                                        Copied
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-4 w-4 mr-2" />
                                        คัดลอกแผน
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Summary Text */}
                    <div className="mt-6 p-4 bg-background/40 backdrop-blur-md rounded-xl border border-border/50">
                        <p className="text-base leading-relaxed text-foreground/90">
                            {result.summary}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Trading Levels Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Entry */}
                <LevelCard
                    title="จุดเข้า (Entry)"
                    value={`$${result.entry_zone.start.toFixed(2)} - $${result.entry_zone.end.toFixed(2)}`}
                    subtext={result.entry_zone.description}
                    icon={<Target className="h-5 w-5 text-blue-500" />}
                    borderColor="border-blue-500/30"
                    textColor="text-blue-500"
                />
                {/* Stop Loss */}
                <LevelCard
                    title="จุดตัดขาดทุน (SL)"
                    value={`$${result.stop_loss.toFixed(2)}`}
                    subtext={`Risk/Reward 1:${result.risk_reward_ratio.toFixed(1)}`}
                    icon={<Shield className="h-5 w-5 text-red-500" />}
                    borderColor="border-red-500/30"
                    textColor="text-red-500"
                />
                {/* Take Profits */}
                <Card className="border-green-500/30 bg-card/50 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                            <TrendingUp className="h-5 w-5 text-green-500" />
                            เป้าหมายกำไร (TP)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">TP1</span>
                            <span className="font-bold text-green-500">${result.take_profit_1.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">TP2</span>
                            <span className="font-bold text-green-500">${result.take_profit_2.toFixed(2)}</span>
                        </div>
                        {result.take_profit_3 && (
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">TP3</span>
                                <span className="font-bold text-green-500">${result.take_profit_3.toFixed(2)}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Analysis Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Reasoning */}
                <Card className="h-full border-border/50 bg-card/30">
                    <CardHeader>
                        <CardTitle className="text-base">เหตุผลการวิเคราะห์</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3">
                            {result.reasoning.map((reason, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                                    <ArrowRight className="h-4 w-4 shrink-0 mt-0.5 text-primary/50" />
                                    <span>{reason}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>

                {/* Factors & Warnings */}
                <div className="space-y-4">
                    {/* Bullish */}
                    <Card className="border-green-500/20 bg-green-500/5">
                        <CardContent className="pt-4">
                            <h3 className="text-sm font-medium text-green-500 mb-2 flex items-center gap-2">
                                <CheckCircle className="h-4 w-4" /> ปัจจัยบวก
                            </h3>
                            <ul className="space-y-1">
                                {result.bullish_factors.map((f, i) => (
                                    <li key={i} className="text-xs text-muted-foreground pl-6 relative">
                                        <span className="absolute left-0 top-0.5 w-1.5 h-1.5 rounded-full bg-green-500/50" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    {/* Bearish */}
                    <Card className="border-red-500/20 bg-red-500/5">
                        <CardContent className="pt-4">
                            <h3 className="text-sm font-medium text-red-500 mb-2 flex items-center gap-2">
                                <XCircle className="h-4 w-4" /> ปัจจัยลบ
                            </h3>
                            <ul className="space-y-1">
                                {result.bearish_factors.map((f, i) => (
                                    <li key={i} className="text-xs text-muted-foreground pl-6 relative">
                                        <span className="absolute left-0 top-0.5 w-1.5 h-1.5 rounded-full bg-red-500/50" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    {/* Warnings */}
                    {result.warnings.length > 0 && (
                        <Card className="border-yellow-500/20 bg-yellow-500/5">
                            <CardContent className="pt-4">
                                <h3 className="text-sm font-medium text-yellow-500 mb-2 flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" /> ข้อควรระวัง
                                </h3>
                                <ul className="space-y-1">
                                    {result.warnings.map((f, i) => (
                                        <li key={i} className="text-xs text-muted-foreground pl-6 relative">
                                            <span className="absolute left-0 top-0.5 w-1.5 h-1.5 rounded-full bg-yellow-500/50" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

function LevelCard({
    title,
    value,
    subtext,
    icon,
    borderColor,
    textColor,
}: {
    title: string;
    value: string;
    subtext: string;
    icon: React.ReactNode;
    borderColor: string;
    textColor: string;
}) {
    return (
        <Card className={cn("bg-card/50 backdrop-blur-sm", borderColor)}>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                    {icon}
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className={cn("text-xl font-bold", textColor)}>{value}</div>
                <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
            </CardContent>
        </Card>
    );
}

function getRecommendationConfig(rec: string) {
    switch (rec) {
        case "STRONG_BUY":
            return {
                label: "ซื้อแรง (STRONG BUY)",
                emoji: "🚀",
                color: "bg-green-600",
                textColor: "text-green-500",
                borderColor: "border-green-500",
                gradient: "from-green-600/20 to-emerald-500/20",
            };
        case "BUY":
            return {
                label: "ซื้อ (BUY)",
                emoji: "📈",
                color: "bg-green-500",
                textColor: "text-green-500",
                borderColor: "border-green-500",
                gradient: "from-green-500/20 to-emerald-400/20",
            };
        case "NEUTRAL":
            return {
                label: "รอดู (NEUTRAL)",
                emoji: "➡️",
                color: "bg-yellow-500",
                textColor: "text-yellow-500",
                borderColor: "border-yellow-500",
                gradient: "from-yellow-500/20 to-amber-400/20",
            };
        case "SELL":
            return {
                label: "ขาย (SELL)",
                emoji: "📉",
                color: "bg-red-500",
                textColor: "text-red-500",
                borderColor: "border-red-500",
                gradient: "from-red-500/20 to-rose-400/20",
            };
        case "STRONG_SELL":
            return {
                label: "ขายแรง (STRONG SELL)",
                emoji: "💥",
                color: "bg-red-600",
                textColor: "text-red-600",
                borderColor: "border-red-600",
                gradient: "from-red-600/20 to-rose-500/20",
            };
        default:
            return {
                label: rec,
                emoji: "❓",
                color: "bg-gray-500",
                textColor: "text-gray-500",
                borderColor: "border-gray-500",
                gradient: "from-gray-500/20 to-slate-400/20",
            };
    }
}
