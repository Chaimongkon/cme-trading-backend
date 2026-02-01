"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatNumber, cn, getRelativeTime } from "@/lib/utils";
import { signalConfig, translateSignal, SignalType } from "@/lib/signal-config";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Bell,
  BellOff,
  Filter,
  X,
  Clock,
  Target,
  BarChart3,
  Activity,
  Zap,
  ChevronDown,
  ChevronUp,
  Calendar,
  PieChart,
} from "lucide-react";

interface Signal {
  id: string;
  product: string;
  type: "BUY" | "SELL" | "NEUTRAL";
  strength: number;
  reason: string;
  analysis: {
    pcr?: { value: number; signal: string };
    maxPain?: { value: number; priceDistance: number; signal: string };
    oiTrend?: { signal: string };
  };
  putCallRatio: number | null;
  maxPainStrike: number | null;
  currentPrice: number | null;
  createdAt: string;
  notified: boolean;
}

interface SignalStats {
  BUY: number;
  SELL: number;
  NEUTRAL: number;
}

// Get signal config with fallback
function getConfig(type: string) {
  return signalConfig[type as SignalType] || signalConfig.NEUTRAL;
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<SignalStats>({ BUY: 0, SELL: 0, NEUTRAL: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 15;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
      });
      if (filter) params.append("type", filter);

      const response = await fetch(`/api/signals?${params}`);
      const result = await response.json();
      if (result.success) {
        setSignals(result.signals);
        setStats(result.stats);
      }
    } catch (err) {
      console.error("Error fetching signals:", err);
    } finally {
      setIsLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalSignals = stats.BUY + stats.SELL + stats.NEUTRAL;
  const buyPercent = totalSignals > 0 ? (stats.BUY / totalSignals) * 100 : 0;
  const sellPercent = totalSignals > 0 ? (stats.SELL / totalSignals) * 100 : 0;
  const neutralPercent = totalSignals > 0 ? (stats.NEUTRAL / totalSignals) * 100 : 0;

  // Determine dominant signal
  const dominantSignal = stats.BUY >= stats.SELL && stats.BUY >= stats.NEUTRAL ? "BUY" 
    : stats.SELL >= stats.NEUTRAL ? "SELL" : "NEUTRAL";
  const dominantConfig = signalConfig[dominantSignal];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="ประวัติสัญญาณ"
        subtitle="ดูสัญญาณเทรดที่ผ่านมาและสถิติการวิเคราะห์"
        onRefresh={fetchData}
        isLoading={isLoading}
      />

      <div className="flex-1 overflow-auto">
        {/* Hero Section with Distribution */}
        <div className={`relative overflow-hidden bg-gradient-to-r ${dominantConfig.gradient} border-b border-border/40`}>
          <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
          <div className="relative p-6 md:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              {/* Left: Signal Distribution */}
              <div className="flex items-center gap-6">
                <div className={`${dominantConfig.bgColor} text-white p-4 rounded-2xl shadow-lg`}>
                  <dominantConfig.icon className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">สัญญาณส่วนใหญ่</p>
                  <h2 className={`text-3xl font-bold ${dominantConfig.color}`}>
                    {dominantConfig.label}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {totalSignals.toLocaleString()} สัญญาณทั้งหมด
                  </p>
                </div>
              </div>

              {/* Right: Distribution Bar */}
              <div className="flex-1 max-w-lg">
                <p className="text-xs text-muted-foreground mb-2">การกระจายสัญญาณ</p>
                <div className="h-4 bg-gray-700 rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${buyPercent}%` }}
                  />
                  <div 
                    className="h-full bg-yellow-500 transition-all duration-500"
                    style={{ width: `${neutralPercent}%` }}
                  />
                  <div 
                    className="h-full bg-red-500 transition-all duration-500"
                    style={{ width: `${sellPercent}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-green-500">ซื้อ {buyPercent.toFixed(0)}%</span>
                  <span className="text-yellow-500">ทรงตัว {neutralPercent.toFixed(0)}%</span>
                  <span className="text-red-500">ขาย {sellPercent.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {(["BUY", "SELL", "NEUTRAL"] as const).map((type) => {
              const config = signalConfig[type];
              const count = stats[type];
              const percent = totalSignals > 0 ? (count / totalSignals) * 100 : 0;
              const isActive = filter === type;
              
              return (
                <Card
                  key={type}
                  className={cn(
                    "border-border/40 cursor-pointer transition-all hover:border-primary/50",
                    isActive && `ring-2 ring-offset-2 ring-offset-background`,
                    isActive && type === "BUY" && "ring-green-500",
                    isActive && type === "SELL" && "ring-red-500",
                    isActive && type === "NEUTRAL" && "ring-yellow-500"
                  )}
                  onClick={() => setFilter(isActive ? null : type)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2 rounded-xl ${config.bgLight}`}>
                        <config.icon className={`h-5 w-5 ${config.color}`} />
                      </div>
                      <Badge variant="outline" className={`${config.color} border-current`}>
                        {percent.toFixed(0)}%
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{config.label}</p>
                    <p className={`text-3xl font-bold ${config.color}`}>
                      {count.toLocaleString()}
                    </p>
                    <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${config.bgColor} transition-all duration-500`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>กรอง:</span>
              </div>
              {filter ? (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "cursor-pointer",
                    filter === "BUY" && "text-green-500 border-green-500",
                    filter === "SELL" && "text-red-500 border-red-500",
                    filter === "NEUTRAL" && "text-yellow-500 border-yellow-500"
                  )}
                  onClick={() => setFilter(null)}
                >
                  {signalConfig[filter as keyof typeof signalConfig].label}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground">ทั้งหมด</span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              แสดง {signals.length} รายการ
            </div>
          </div>

          {/* Signals Timeline */}
          <Card className="border-border/40 overflow-hidden">
            <CardHeader className="pb-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  ลำดับเวลาสัญญาณ
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  หน้า {page + 1}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {signals.length === 0 ? (
                <div className="p-12 text-center">
                  <PieChart className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">ไม่พบสัญญาณ</p>
                  {filter && (
                    <Button variant="link" size="sm" onClick={() => setFilter(null)} className="mt-2">
                      ล้างตัวกรอง
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {signals.map((signal, idx) => {
                    const config = signalConfig[signal.type];
                    const isExpanded = expandedId === signal.id;
                    const isLatest = idx === 0 && page === 0;
                    
                    return (
                      <div 
                        key={signal.id} 
                        className={cn(
                          "transition-all",
                          isExpanded ? "bg-muted/30" : "hover:bg-muted/20"
                        )}
                      >
                        {/* Main Row */}
                        <div 
                          className="p-4 cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : signal.id)}
                        >
                          <div className="flex items-start gap-4">
                            {/* Timeline Dot */}
                            <div className="flex flex-col items-center">
                              <div className={cn(
                                "w-3 h-3 rounded-full",
                                config.bgColor,
                                isLatest && "animate-pulse"
                              )} />
                              {idx < signals.length - 1 && (
                                <div className="w-px h-full bg-border/50 mt-1" />
                              )}
                            </div>

                            {/* Signal Icon */}
                            <div className={`p-2 rounded-xl ${config.bgLight}`}>
                              <config.icon className={`h-5 w-5 ${config.color}`} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`font-bold ${config.color}`}>
                                  {config.label}
                                </span>
                                <div className="flex gap-0.5">
                                  {[1, 2, 3, 4, 5].map((i) => (
                                    <div
                                      key={i}
                                      className={cn(
                                        "h-1.5 w-3 rounded-sm",
                                        i <= signal.strength ? config.bgColor : "bg-gray-700"
                                      )}
                                    />
                                  ))}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {signal.product}
                                </Badge>
                                {isLatest && (
                                  <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary/20 text-primary border-0">
                                    ล่าสุด
                                  </Badge>
                                )}
                                {signal.notified ? (
                                  <Bell className="h-3 w-3 text-primary" />
                                ) : (
                                  <BellOff className="h-3 w-3 text-muted-foreground/50" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {signal.reason}
                              </p>
                            </div>

                            {/* Time & Expand */}
                            <div className="text-right flex items-start gap-2">
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  {getRelativeTime(signal.createdAt)}
                                </p>
                                <p className="text-[10px] text-muted-foreground/70">
                                  {new Date(signal.createdAt).toLocaleDateString("th-TH")}
                                </p>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pl-16">
                            <div className="grid gap-3 sm:grid-cols-3 bg-card/50 rounded-lg p-4 border border-border/30">
                              {/* Price */}
                              {signal.currentPrice && (
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-yellow-500/10">
                                    <Activity className="h-4 w-4 text-yellow-500" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">ราคาขณะนั้น</p>
                                    <p className="font-mono font-medium">
                                      {formatNumber(signal.currentPrice, 2)}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* PCR */}
                              {signal.putCallRatio && (
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-blue-500/10">
                                    <BarChart3 className="h-4 w-4 text-blue-500" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">อัตราส่วน Put/Call</p>
                                    <p className="font-mono font-medium">
                                      {signal.putCallRatio.toFixed(3)}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Max Pain */}
                              {signal.maxPainStrike && (
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-purple-500/10">
                                    <Target className="h-4 w-4 text-purple-500" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">จุด Max Pain</p>
                                    <p className="font-mono font-medium">
                                      {formatNumber(signal.maxPainStrike, 0)}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Analysis Details */}
                            {signal.analysis && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {signal.analysis.pcr && (
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-xs",
                                      signal.analysis.pcr.signal === "BULLISH" && "text-green-500 border-green-500/50",
                                      signal.analysis.pcr.signal === "BEARISH" && "text-red-500 border-red-500/50"
                                    )}
                                  >
                                    PCR: {translateSignal(signal.analysis.pcr.signal)}
                                  </Badge>
                                )}
                                {signal.analysis.maxPain && (
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-xs",
                                      signal.analysis.maxPain.signal === "BULLISH" && "text-green-500 border-green-500/50",
                                      signal.analysis.maxPain.signal === "BEARISH" && "text-red-500 border-red-500/50"
                                    )}
                                  >
                                    Max Pain: {translateSignal(signal.analysis.maxPain.signal)}
                                  </Badge>
                                )}
                                {signal.analysis.oiTrend && (
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-xs",
                                      signal.analysis.oiTrend.signal === "BULLISH" && "text-green-500 border-green-500/50",
                                      signal.analysis.oiTrend.signal === "BEARISH" && "text-red-500 border-red-500/50"
                                    )}
                                  >
                                    เทรนด์ OI: {translateSignal(signal.analysis.oiTrend.signal)}
                                  </Badge>
                                )}
                              </div>
                            )}

                            {/* Timestamp */}
                            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>สร้างเมื่อ: {formatDateTime(signal.createdAt)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t border-border/50 bg-muted/10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="h-8"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  ก่อนหน้า
                </Button>
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, Math.ceil(totalSignals / limit)))].map((_, i) => (
                    <Button
                      key={i}
                      variant={page === i ? "default" : "ghost"}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPage(i)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={signals.length < limit}
                  className="h-8"
                >
                  หน้าถัดไป
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats Footer */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/40">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">สัญญาณทั้งหมด</p>
                  <p className="font-bold">{totalSignals.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">สัญญาณซื้อ</p>
                  <p className="font-bold text-green-500">{stats.BUY.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">สัญญาณขาย</p>
                  <p className="font-bold text-red-500">{stats.SELL.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Minus className="h-4 w-4 text-yellow-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ทรงตัว</p>
                  <p className="font-bold text-yellow-500">{stats.NEUTRAL.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
