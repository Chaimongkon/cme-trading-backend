"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IntradayVolumeChart } from "@/components/charts/intraday-volume-chart";
import { OiChart } from "@/components/charts/oi-chart";
import { TradingViewChart } from "@/components/charts/tradingview-chart";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { XauConverter } from "@/components/trading/xau-converter";
import { formatDateTime, formatNumber, getRelativeTime } from "@/lib/utils";
import { getSignalConfig, getPcrColor } from "@/lib/signal-config";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Shield,
  Zap,
  Clock,
  History,
  FlaskConical,
  Wifi,
  WifiOff,
  ChevronRight,
  Sparkles,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { th } from "date-fns/locale";

// Types based on new API response
interface OptionsAnalysis {
  marketData: {
    product: string;
    expiry: string;
    currentPrice: number;
    extractedAt: string;
    strikesCount: number;
  };
  pcr: {
    oiPcr: number;
    oiPcrSignal: string;
    volumePcr: number;
    volumePcrSignal: string;
    atmPcr: number;
    atmPcrSignal: string;
  };
  maxPain: {
    maxPainStrike: number;
    distanceFromPrice: number;
    distancePercent: number;
    signal: string;
    description: string;
  };
  keyLevels: {
    support: Array<{ strike: number; putOi: number; strength: number }>;
    resistance: Array<{ strike: number; callOi: number; strength: number }>;
  };
  oiFlow: {
    netOiChange: number;
    callFlow: number;
    putFlow: number;
    signal: string;
    interpretation: string;
  };
  volume: {
    hotStrikes: Array<{
      strike: number;
      totalVolume: number;
      putVolume: number;
      callVolume: number;
      isNearPrice: boolean;
    }>;
    vwap: number;
    volumeSkew: string;
  };
  signal: {
    type: string;
    strength: number;
    confidence: number;
    score?: number;
    sentiment?: string;
    reason: string;
    factors: string[];
    positiveFactors?: string[];
    negativeFactors?: string[];
  };
  strikeData: Array<{
    strike: number;
    callOi: number;
    putOi: number;
    callVolume: number;
    putVolume: number;
    callOiChange: number;
    putOiChange: number;
    volSettle: number | null;
    range: string | null;
  }>;
}

interface ApiResponse {
  success: boolean;
  analysis?: OptionsAnalysis;
  intradayData?: Array<{
    strike: number;
    put: number | null;
    call: number | null;
    volSettle: number | null;
    range: string | null;
  }>;
  intradaySummary?: {
    put: number;
    call: number;
    vol: number;
    volChg: number;
    futureChg: number;
  };
  error?: string;
  generatedAt: string;
}


export default function DashboardPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [date, setDate] = useState<Date | undefined>(undefined);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let url = "/api/analysis";
      if (date) {
        const dateStr = format(date, "yyyy-MM-dd");
        url += `?date=${dateStr}`;
      }

      const response = await fetch(url);
      const result = await response.json();

      if (!result.success) {
        setError(result.error || "Failed to fetch data");
        setData(null);
        setIsConnected(false);
      } else {
        setData(result);
        setIsConnected(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setData(null);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [date]); // FIXED: Added date to dependencies (rerender-dependencies rule)

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]); // date dependency removed - already in fetchData's deps

  const analysis = data?.analysis;
  const signal = analysis?.signal;
  const signalType = signal?.type || "NEUTRAL";
  const config = getSignalConfig(signalType);
  const SignalIcon = config.icon;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Gold Options Analytics"
        subtitle={
          analysis
            ? `${analysis.marketData.product} - ${analysis.marketData.expiry}`
            : "กำลังโหลด..."
        }
        onRefresh={fetchData}
        isLoading={isLoading}
        lastUpdated={
          analysis?.marketData.extractedAt
            ? formatDateTime(analysis.marketData.extractedAt)
            : undefined
        }
      >
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={`w-[240px] justify-start text-left font-normal ${!date && "text-muted-foreground"
                }`}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP", { locale: th }) : <span>เลือกวันที่</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </Header>

      <div className="flex-1 overflow-auto">
        {/* Stale Data Warning */}
        {analysis && (() => {
          const dataDate = new Date(analysis.marketData.extractedAt);
          const today = new Date();
          const isToday = dataDate.getDate() === today.getDate() &&
            dataDate.getMonth() === today.getMonth() &&
            dataDate.getFullYear() === today.getFullYear();

          if (!isToday) {
            return (
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center justify-center gap-2 text-amber-500 text-sm font-medium animate-in slide-in-from-top-2">
                <Clock className="h-4 w-4" />
                <span>
                  คุณกำลังดูข้อมูลของวันที่ {formatDateTime(analysis.marketData.extractedAt)} (ไม่ใช่ข้อมูลวันนี้)
                </span>
              </div>
            );
          }
          return null;
        })()}

        {/* Hero Section with Main Signal */}
        <div className={`relative overflow-hidden bg-gradient-to-r ${config.gradient} border-b border-border/40`}>
          <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
          <div className="relative p-6 md:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              {/* Left: Signal Info */}
              <div className="flex items-center gap-6">
                {/* Signal Badge */}
                <div className={`${config.bgColor} text-white p-4 rounded-2xl shadow-lg`}>
                  <SignalIcon className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className={`text-3xl font-bold ${config.color}`}>
                      {config.label}
                    </h2>
                    <Badge variant="outline" className="text-xs">
                      {config.labelEn}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {signal?.reason || "กำลังวิเคราะห์..."}
                  </p>
                  {signal?.sentiment && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Sentiment: {signal.sentiment}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Key Metrics */}
              <div className="flex flex-wrap gap-4">
                {/* Confidence */}
                <div className="bg-card/50 backdrop-blur rounded-xl p-4 border border-border/40 min-w-[120px]">
                  <p className="text-xs text-muted-foreground mb-1">Confidence</p>
                  <div className="flex items-end gap-1">
                    <span className={`text-2xl font-bold ${config.color}`}>
                      {signal?.confidence || signal?.score || 50}
                    </span>
                    <span className="text-sm text-muted-foreground mb-0.5">%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-700 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full ${config.bgColor} transition-all duration-500`}
                      style={{ width: `${signal?.confidence || signal?.score || 50}%` }}
                    />
                  </div>
                </div>

                {/* Price */}
                <div className="bg-card/50 backdrop-blur rounded-xl p-4 border border-border/40 min-w-[120px]">
                  <p className="text-xs text-muted-foreground mb-1">Gold Price</p>
                  <p className="text-2xl font-bold text-yellow-500">
                    {analysis ? formatNumber(analysis.marketData.currentPrice, 1) : "--"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analysis?.marketData.product || "GC"}
                  </p>
                </div>

                {/* Connection Status */}
                <div className="bg-card/50 backdrop-blur rounded-xl p-4 border border-border/40 min-w-[120px]">
                  <p className="text-xs text-muted-foreground mb-1">สถานะ</p>
                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <>
                        <Wifi className="h-5 w-5 text-green-500" />
                        <span className="text-sm text-green-500">เชื่อมต่อแล้ว</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-5 w-5 text-red-500" />
                        <span className="text-sm text-red-500">ไม่เชื่อมต่อ</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analysis ? getRelativeTime(analysis.marketData.extractedAt) : "--"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Navigation */}
        <div className="p-6 border-b border-border/40 bg-muted/20">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/dashboard/analyze">
              <Card className="border-border/40 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                    <FlaskConical className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">วิเคราะห์สัญญาณ</p>
                    <p className="text-xs text-muted-foreground">ดูรายละเอียดการวิเคราะห์</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/history">
              <Card className="border-border/40 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                    <History className="h-5 w-5 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">ประวัติข้อมูล</p>
                    <p className="text-xs text-muted-foreground">ดูข้อมูลย้อนหลัง</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>

            <Card className="border-border/40 bg-gradient-to-r from-orange-500/5 to-transparent">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Target className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Max Pain</p>
                  <p className="text-lg font-bold font-mono text-orange-500">
                    {analysis ? formatNumber(analysis.maxPain.maxPainStrike, 0) : "--"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-gradient-to-r from-cyan-500/5 to-transparent">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <BarChart3 className="h-5 w-5 text-cyan-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">PCR (OI)</p>
                  <p className={`text-lg font-bold font-mono ${analysis ? getPcrColor(analysis.pcr.oiPcrSignal) : ""}`}>
                    {analysis ? analysis.pcr.oiPcr : "--"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 space-y-6">
          {error && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <WifiOff className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="text-destructive font-medium">{error}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      กรุณาตรวจสอบว่า Chrome Extension sync ข้อมูลมายัง backend แล้ว
                    </p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={fetchData}>
                      ลองใหม่
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!error && analysis && (
            <>
              {/* Stats Row */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Current Price */}
                <Card className="border-border/40 overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-500/10 rounded-full -mr-10 -mt-10" />
                  <CardContent className="pt-6 relative">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">ราคา Gold</p>
                        <p className="text-3xl font-bold text-yellow-500">
                          {formatNumber(analysis.marketData.currentPrice, 1)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {analysis.marketData.strikesCount} strikes
                        </p>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <Activity className="h-6 w-6 text-yellow-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* OI PCR */}
                <Card className="border-border/40 overflow-hidden">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">OI PCR</p>
                        <p className={`text-3xl font-bold ${getPcrColor(analysis.pcr.oiPcrSignal)}`}>
                          {analysis.pcr.oiPcr}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Vol: {analysis.pcr.volumePcr} | ATM: {analysis.pcr.atmPcr}
                        </p>
                      </div>
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center ${analysis.pcr.oiPcrSignal === "BULLISH" ? "bg-green-500/20" :
                        analysis.pcr.oiPcrSignal === "BEARISH" ? "bg-red-500/20" : "bg-gray-500/20"
                        }`}>
                        <BarChart3 className={`h-6 w-6 ${getPcrColor(analysis.pcr.oiPcrSignal)}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Max Pain */}
                <Card className="border-border/40 overflow-hidden">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Max Pain</p>
                        <p className="text-3xl font-bold text-primary">
                          {formatNumber(analysis.maxPain.maxPainStrike, 0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {analysis.maxPain.distancePercent > 0 ? "+" : ""}
                          {analysis.maxPain.distancePercent.toFixed(1)}% จากราคา
                        </p>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <Target className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* VWAP */}
                <Card className="border-border/40 overflow-hidden">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">VWAP</p>
                        <p className="text-3xl font-bold text-purple-500">
                          {formatNumber(analysis.volume.vwap, 1)}
                        </p>
                        <Badge variant={
                          analysis.volume.volumeSkew === "CALL_HEAVY" ? "default" :
                            analysis.volume.volumeSkew === "PUT_HEAVY" ? "destructive" : "secondary"
                        } className="mt-1">
                          {analysis.volume.volumeSkew === "CALL_HEAVY" ? "Call Heavy" :
                            analysis.volume.volumeSkew === "PUT_HEAVY" ? "Put Heavy" : "Balanced"}
                        </Badge>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Sparkles className="h-6 w-6 text-purple-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Main Content Grid */}
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Charts - 2 columns */}
                {/* Charts - 2 columns */}
                <div className="lg:col-span-2 space-y-6">
                  {/* TradingView XAU Chart - Top Priority */}
                  <TradingViewChart
                    symbol="OANDA:XAUUSD"
                    interval="15"
                    height={600}
                    supportLevels={analysis.keyLevels.support.map(s => s.strike)}
                    resistanceLevels={analysis.keyLevels.resistance.map(r => r.strike)}
                    maxPain={analysis.maxPain.maxPainStrike}
                    currentPrice={analysis.marketData.currentPrice}
                  />

                  {/* CME Analysis Charts */}
                  <div className="space-y-6">
                    {/* Intraday Volume Chart */}
                    {data?.intradayData && data.intradayData.length > 0 && (
                      <IntradayVolumeChart
                        data={data.intradayData}
                        futurePrice={analysis.marketData.currentPrice}
                        summary={data.intradaySummary}
                        title="Intraday Volume"
                      />
                    )}

                    {/* OI Chart */}
                    <OiChart
                      data={analysis.strikeData.map((s) => ({
                        strike: s.strike,
                        putOi: s.putOi,
                        callOi: s.callOi,
                        volSettle: s.volSettle,
                        range: s.range,
                        putChange: s.putOiChange,
                        callChange: s.callOiChange,
                      }))}
                      currentPrice={analysis.marketData.currentPrice}
                      maxPainStrike={analysis.maxPain.maxPainStrike}
                    />
                  </div>
                </div>

                {/* Right Sidebar */}
                <div className="space-y-6">
                  {/* Signal Details */}
                  <Card className="border-border/40 overflow-hidden">
                    <div className={`h-1 ${config.bgColor}`} />
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        สัญญาณเทรด
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center py-4">
                        <div className={`inline-flex items-center gap-3 ${config.bgColor} text-white px-6 py-3 rounded-xl shadow-lg`}>
                          <SignalIcon className="h-6 w-6" />
                          <span className="text-xl font-bold">{config.label}</span>
                        </div>
                        <div className="mt-4">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-sm text-muted-foreground">ความแข็งแกร่ง:</span>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <div
                                  key={i}
                                  className={`h-2 w-6 rounded ${i <= (signal?.strength || 0)
                                    ? config.bgColor
                                    : "bg-gray-700"
                                    }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Positive Factors */}
                      {signal?.positiveFactors && signal.positiveFactors.length > 0 && (
                        <div className="border-t border-border/40 pt-4">
                          <p className="text-xs font-medium text-green-400 mb-2">✓ ปัจจัยบวก</p>
                          <ul className="space-y-1">
                            {signal.positiveFactors.slice(0, 3).map((factor, i) => (
                              <li key={i} className="text-xs text-green-400/80 flex items-start gap-2">
                                <span>+</span>
                                <span className="line-clamp-2">{factor}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Negative Factors */}
                      {signal?.negativeFactors && signal.negativeFactors.length > 0 && (
                        <div className="border-t border-border/40 pt-4">
                          <p className="text-xs font-medium text-red-400 mb-2">✗ ปัจจัยลบ</p>
                          <ul className="space-y-1">
                            {signal.negativeFactors.slice(0, 3).map((factor, i) => (
                              <li key={i} className="text-xs text-red-400/80 flex items-start gap-2">
                                <span>-</span>
                                <span className="line-clamp-2">{factor}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Link to full analysis */}
                      <Link href="/dashboard/analyze">
                        <Button variant="outline" size="sm" className="w-full mt-2">
                          ดูการวิเคราะห์เต็มรูปแบบ
                          <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>

                  {/* Key Levels */}
                  <Card className="border-border/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        แนวรับ / แนวต้าน
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Resistance */}
                        <div>
                          <p className="text-xs font-medium text-red-400 mb-2">แนวต้าน (Call OI)</p>
                          <div className="space-y-1">
                            {analysis.keyLevels.resistance.slice(0, 3).map((r, i) => (
                              <div key={i} className="flex items-center justify-between text-sm">
                                <span className="text-foreground font-mono">{formatNumber(r.strike, 0)}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-xs">{formatNumber(r.callOi, 0)}</span>
                                  <div className="flex gap-0.5">
                                    {[1, 2, 3].map((s) => (
                                      <div
                                        key={s}
                                        className={`h-1.5 w-1.5 rounded-full ${s <= r.strength ? "bg-red-500" : "bg-gray-700"
                                          }`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Current Price Divider */}
                        <div className="flex items-center gap-2 py-2">
                          <div className="flex-1 h-px bg-yellow-500/50" />
                          <span className="text-xs text-yellow-500 font-medium px-2 py-1 bg-yellow-500/10 rounded">
                            {formatNumber(analysis.marketData.currentPrice, 1)}
                          </span>
                          <div className="flex-1 h-px bg-yellow-500/50" />
                        </div>

                        {/* Support */}
                        <div>
                          <p className="text-xs font-medium text-green-400 mb-2">แนวรับ (Put OI)</p>
                          <div className="space-y-1">
                            {analysis.keyLevels.support.slice(0, 3).map((s, i) => (
                              <div key={i} className="flex items-center justify-between text-sm">
                                <span className="text-foreground font-mono">{formatNumber(s.strike, 0)}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-xs">{formatNumber(s.putOi, 0)}</span>
                                  <div className="flex gap-0.5">
                                    {[1, 2, 3].map((str) => (
                                      <div
                                        key={str}
                                        className={`h-1.5 w-1.5 rounded-full ${str <= s.strength ? "bg-green-500" : "bg-gray-700"
                                          }`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* OI Flow */}
                  <Card className="border-border/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        OI Flow
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Net OI Change</span>
                          <span className={`font-mono font-bold ${analysis.oiFlow.netOiChange > 0 ? "text-green-400" :
                            analysis.oiFlow.netOiChange < 0 ? "text-red-400" : "text-gray-400"
                            }`}>
                            {analysis.oiFlow.netOiChange > 0 ? "+" : ""}
                            {formatNumber(analysis.oiFlow.netOiChange, 0)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-blue-500/10 rounded-lg p-2 text-center">
                            <p className="text-xs text-muted-foreground">Call</p>
                            <p className={`font-mono text-sm ${analysis.oiFlow.callFlow > 0 ? "text-green-400" : "text-red-400"
                              }`}>
                              {analysis.oiFlow.callFlow > 0 ? "+" : ""}
                              {formatNumber(analysis.oiFlow.callFlow, 0)}
                            </p>
                          </div>
                          <div className="bg-orange-500/10 rounded-lg p-2 text-center">
                            <p className="text-xs text-muted-foreground">Put</p>
                            <p className={`font-mono text-sm ${analysis.oiFlow.putFlow > 0 ? "text-green-400" : "text-red-400"
                              }`}>
                              {analysis.oiFlow.putFlow > 0 ? "+" : ""}
                              {formatNumber(analysis.oiFlow.putFlow, 0)}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground pt-2 border-t border-border/40">
                          {analysis.oiFlow.interpretation}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Hot Strikes */}
                  <Card className="border-border/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Hot Strikes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {analysis.volume.hotStrikes.slice(0, 5).map((hs, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                              <span className={`font-mono ${hs.isNearPrice ? "text-yellow-500 font-bold" : "text-foreground"}`}>
                                {formatNumber(hs.strike, 0)}
                              </span>
                              {hs.isNearPrice && (
                                <Badge className="text-[10px] px-1 py-0 h-4 bg-yellow-500/20 text-yellow-500 border-0">
                                  ATM
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs font-mono">
                              <span className="text-orange-400">{formatNumber(hs.putVolume, 0)}</span>
                              <span className="text-muted-foreground">/</span>
                              <span className="text-blue-400">{formatNumber(hs.callVolume, 0)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* XAU Converter */}
                  <XauConverter />
                </div>
              </div>
            </>
          )}

          {isLoading && !data && (
            <SkeletonDashboard />
          )}
        </div>
      </div>
    </div>
  );
}
