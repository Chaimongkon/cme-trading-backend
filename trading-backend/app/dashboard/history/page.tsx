"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime, formatNumber, getRelativeTime } from "@/lib/utils";
import { 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Table2,
  Clock,
  Database,
  Layers,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from "lucide-react";
import { IntradayVolumeChart } from "@/components/charts/intraday-volume-chart";
import type { DataType } from "@/lib/types";

// Type definitions for each snapshot type
interface VolumeSnapshot {
  id: string;
  product: string;
  expiry: string;
  futurePrice: number | null;
  totalPut: number | null;
  totalCall: number | null;
  vol: number | null;
  volChg: number | null;
  futureChg: number | null;
  extractedAt: string;
  createdAt: string;
  strikes: Array<{
    strike: number;
    putVol: number | null;
    callVol: number | null;
    volSettle: number | null;
    range: string | null;
  }>;
}

interface OiSnapshot {
  id: string;
  product: string;
  expiry: string;
  futurePrice: number | null;
  totalPutOi: number | null;
  totalCallOi: number | null;
  vol: number | null;
  volChg: number | null;
  futureChg: number | null;
  extractedAt: string;
  createdAt: string;
  strikes: Array<{
    strike: number;
    putOi: number | null;
    callOi: number | null;
    volSettle: number | null;
    range: string | null;
  }>;
}

interface OiChangeSnapshot {
  id: string;
  product: string;
  expiry: string;
  futurePrice: number | null;
  totalPutChange: number | null;
  totalCallChange: number | null;
  vol: number | null;
  volChg: number | null;
  futureChg: number | null;
  extractedAt: string;
  createdAt: string;
  strikes: Array<{
    strike: number;
    putChange: number | null;
    callChange: number | null;
    volSettle: number | null;
    range: string | null;
  }>;
}

type AnySnapshot = VolumeSnapshot | OiSnapshot | OiChangeSnapshot;

// Tab configuration
const tabConfig = {
  volume: {
    label: "Volume",
    fullLabel: "Intraday Volume",
    icon: BarChart3,
    putLabel: "Put Vol",
    callLabel: "Call Vol",
    putClass: "text-orange-400",
    callClass: "text-blue-400",
    gradient: "from-blue-500/10 via-transparent to-orange-500/10",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
  },
  oi: {
    label: "Open Interest",
    fullLabel: "Open Interest",
    icon: TrendingUp,
    putLabel: "Put OI",
    callLabel: "Call OI",
    putClass: "text-orange-400",
    callClass: "text-blue-400",
    gradient: "from-green-500/10 via-transparent to-purple-500/10",
    iconBg: "bg-green-500/10",
    iconColor: "text-green-500",
  },
  oichange: {
    label: "OI Change",
    fullLabel: "OI Change",
    icon: TrendingDown,
    putLabel: "Put Δ",
    callLabel: "Call Δ",
    putClass: "text-red-400",
    callClass: "text-green-400",
    gradient: "from-red-500/10 via-transparent to-green-500/10",
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-500",
  },
};

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<DataType>("volume");
  const [snapshots, setSnapshots] = useState<AnySnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedSnapshot, setSelectedSnapshot] = useState<AnySnapshot | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/data?type=${activeTab}&limit=${limit}&offset=${page * limit}`);
      const result = await response.json();
      if (result.success) {
        setSnapshots(result.data);
        setTotalCount(result.total || result.data.length);
        if (result.data.length > 0 && !selectedSnapshot) {
          setSelectedSnapshot(result.data[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, page, selectedSnapshot]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset selection when changing tabs
  useEffect(() => {
    setSelectedSnapshot(null);
    setPage(0);
  }, [activeTab]);

  const config = tabConfig[activeTab];

  // Get put/call values from snapshot based on type
  const getStrikeValues = (strike: AnySnapshot["strikes"][0]) => {
    if (activeTab === "volume") {
      const s = strike as VolumeSnapshot["strikes"][0];
      return { put: s.putVol, call: s.callVol };
    } else if (activeTab === "oichange") {
      const s = strike as OiChangeSnapshot["strikes"][0];
      return { put: s.putChange, call: s.callChange };
    } else {
      const s = strike as OiSnapshot["strikes"][0];
      return { put: s.putOi, call: s.callOi };
    }
  };

  // Get total values from snapshot
  const getTotals = (snapshot: AnySnapshot) => {
    if (activeTab === "volume") {
      const s = snapshot as VolumeSnapshot;
      return { put: s.totalPut, call: s.totalCall };
    } else if (activeTab === "oichange") {
      const s = snapshot as OiChangeSnapshot;
      return { put: s.totalPutChange, call: s.totalCallChange };
    } else {
      const s = snapshot as OiSnapshot;
      return { put: s.totalPutOi, call: s.totalCallOi };
    }
  };

  // Convert snapshot to chart data format
  const getChartData = (snapshot: AnySnapshot) => {
    return snapshot.strikes.map((strike) => {
      const values = getStrikeValues(strike);
      return {
        strike: strike.strike,
        put: values.put,
        call: values.call,
        volSettle: strike.volSettle,
        range: strike.range,
      };
    });
  };

  // Get summary for chart
  const getChartSummary = (snapshot: AnySnapshot) => {
    const totals = getTotals(snapshot);
    
    let vol = 0;
    let volChg = 0;
    let futureChg = 0;
    
    if ("vol" in snapshot && snapshot.vol !== null) {
      vol = snapshot.vol;
    }
    if ("volChg" in snapshot && snapshot.volChg !== null) {
      volChg = snapshot.volChg;
    }
    if ("futureChg" in snapshot && snapshot.futureChg !== null) {
      futureChg = snapshot.futureChg;
    }

    return {
      put: totals.put || 0,
      call: totals.call || 0,
      vol,
      volChg,
      futureChg,
    };
  };

  // Get chart title based on data type
  const getChartTitle = (snapshot: AnySnapshot) => {
    return `${snapshot.product} ${snapshot.expiry} - ${config.fullLabel}`;
  };


  return (
    <div className="flex flex-col h-full">
      <Header
        title="ประวัติข้อมูล"
        subtitle="ดูข้อมูล Volume, OI, OI Change ย้อนหลัง"
        onRefresh={fetchData}
        isLoading={isLoading}
      />

      <div className="flex-1 overflow-auto">
        {/* Hero Stats Section */}
        <div className={`relative overflow-hidden bg-gradient-to-r ${config.gradient} border-b border-border/40`}>
          <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
          <div className="relative p-6">
            <div className="grid gap-4 md:grid-cols-4">
              {/* Data Type */}
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${config.iconBg}`}>
                  <config.icon className={`h-6 w-6 ${config.iconColor}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ประเภทข้อมูล</p>
                  <p className="font-semibold">{config.fullLabel}</p>
                </div>
              </div>

              {/* Total Records */}
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">จำนวน Snapshots</p>
                  <p className="font-semibold font-mono">{totalCount.toLocaleString()}</p>
                </div>
              </div>

              {/* Current Page */}
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-yellow-500/10">
                  <Layers className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">หน้าปัจจุบัน</p>
                  <p className="font-semibold">{page + 1} / {Math.ceil(totalCount / limit) || 1}</p>
                </div>
              </div>

              {/* Latest Update */}
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-cyan-500/10">
                  <Clock className="h-6 w-6 text-cyan-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">อัพเดทล่าสุด</p>
                  <p className="font-semibold text-sm">
                    {snapshots[0] ? getRelativeTime(snapshots[0].extractedAt) : "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 space-y-6">
          {/* Data Type Tabs - Centered */}
          <div className="flex justify-center">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DataType)}>
              <TabsList className="grid grid-cols-3 h-12 w-full max-w-lg">
                <TabsTrigger value="volume" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Volume</span>
                </TabsTrigger>
                <TabsTrigger value="oi" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Open Interest</span>
                </TabsTrigger>
                <TabsTrigger value="oichange" className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  <span className="hidden sm:inline">OI Change</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* Snapshot Timeline - Left Side */}
            <div className="lg:col-span-4 xl:col-span-3">
              <Card className="border-border/40 overflow-hidden">
                <CardHeader className="pb-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Timeline
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {snapshots.length} รายการ
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {snapshots.length === 0 && !isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <config.icon className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">ไม่มีข้อมูล {config.label}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50 max-h-[600px] overflow-auto">
                      {snapshots.map((snapshot, idx) => {
                        const totals = getTotals(snapshot);
                        const isSelected = selectedSnapshot?.id === snapshot.id;
                        const futureChg = snapshot.futureChg || 0;
                        
                        return (
                          <button
                            key={snapshot.id}
                            onClick={() => setSelectedSnapshot(snapshot)}
                            className={`w-full p-4 text-left transition-all duration-200 ${
                              isSelected 
                                ? "bg-primary/10 border-l-2 border-l-primary" 
                                : "hover:bg-muted/50 border-l-2 border-l-transparent"
                            }`}
                          >
                            {/* Time Badge */}
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-2 h-2 rounded-full ${
                                idx === 0 ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"
                              }`} />
                              <span className="text-xs text-muted-foreground">
                                {getRelativeTime(snapshot.extractedAt)}
                              </span>
                              {idx === 0 && (
                                <Badge className="text-[10px] px-1.5 py-0 h-4 bg-green-500/20 text-green-500 border-0">
                                  ล่าสุด
                                </Badge>
                              )}
                            </div>

                            {/* Main Info */}
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-medium text-sm">
                                  {snapshot.product}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {snapshot.expiry}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono font-medium text-sm">
                                  {formatNumber(snapshot.futurePrice || 0, 1)}
                                </p>
                                <div className={`flex items-center justify-end gap-0.5 text-xs ${
                                  futureChg > 0 ? "text-green-500" : futureChg < 0 ? "text-red-500" : "text-muted-foreground"
                                }`}>
                                  {futureChg > 0 ? (
                                    <ArrowUpRight className="h-3 w-3" />
                                  ) : futureChg < 0 ? (
                                    <ArrowDownRight className="h-3 w-3" />
                                  ) : (
                                    <Minus className="h-3 w-3" />
                                  )}
                                  {futureChg > 0 ? "+" : ""}{futureChg.toFixed(2)}
                                </div>
                              </div>
                            </div>

                            {/* Stats Bar */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex">
                                <div 
                                  className="h-full bg-orange-400"
                                  style={{ 
                                    width: `${((totals.put || 0) / ((totals.put || 0) + (totals.call || 0) || 1)) * 100}%` 
                                  }}
                                />
                                <div 
                                  className="h-full bg-blue-400"
                                  style={{ 
                                    width: `${((totals.call || 0) / ((totals.put || 0) + (totals.call || 0) || 1)) * 100}%` 
                                  }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {snapshot.strikes.length}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Pagination */}
                  <div className="flex items-center justify-between p-3 border-t border-border/50 bg-muted/20">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                      className="h-8 px-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {page + 1} / {Math.ceil(totalCount / limit) || 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={snapshots.length < limit}
                      className="h-8 px-2"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Snapshot Detail - Right Side */}
            <div className="lg:col-span-8 xl:col-span-9 space-y-6">
              {selectedSnapshot ? (
                <>
                  {/* Summary Stats */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-border/40 bg-gradient-to-br from-orange-500/5 to-transparent">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">{config.putLabel}</p>
                        <p className={`text-xl font-bold font-mono ${config.putClass}`}>
                          {formatNumber(getTotals(selectedSnapshot).put || 0, 0)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-border/40 bg-gradient-to-br from-blue-500/5 to-transparent">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">{config.callLabel}</p>
                        <p className={`text-xl font-bold font-mono ${config.callClass}`}>
                          {formatNumber(getTotals(selectedSnapshot).call || 0, 0)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-border/40 bg-gradient-to-br from-purple-500/5 to-transparent">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Future Price</p>
                        <p className="text-xl font-bold font-mono">
                          {formatNumber(selectedSnapshot.futurePrice || 0, 1)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-border/40 bg-gradient-to-br from-cyan-500/5 to-transparent">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Strikes</p>
                        <p className="text-xl font-bold font-mono">
                          {selectedSnapshot.strikes.length}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Chart View */}
                  <IntradayVolumeChart
                    data={getChartData(selectedSnapshot)}
                    futurePrice={selectedSnapshot.futurePrice || 0}
                    summary={getChartSummary(selectedSnapshot)}
                    title={getChartTitle(selectedSnapshot)}
                  />

                  {/* Table View */}
                  <Card className="border-border/40">
                    <CardHeader className="pb-3 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Table2 className="h-4 w-4" />
                          Strike Data
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {selectedSnapshot.strikes.length} strikes
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(selectedSnapshot.extractedAt)}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="max-h-[400px] overflow-auto">
                        <table className="data-table">
                          <thead className="sticky top-0 bg-card z-10">
                            <tr>
                              <th className="text-left">Strike</th>
                              <th className={`text-right ${config.putClass}`}>{config.putLabel}</th>
                              <th className={`text-right ${config.callClass}`}>{config.callLabel}</th>
                              <th className="text-right">Vol Settle</th>
                              <th className="text-right">Range</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedSnapshot.strikes.map((strike, idx) => {
                              const values = getStrikeValues(strike);
                              const isNearPrice = selectedSnapshot.futurePrice && 
                                Math.abs(strike.strike - selectedSnapshot.futurePrice) < 30;
                              
                              return (
                                <tr 
                                  key={idx} 
                                  className={isNearPrice ? "bg-primary/5" : ""}
                                >
                                  <td className="font-medium">
                                    <div className="flex items-center gap-2">
                                      {strike.strike}
                                      {isNearPrice && (
                                        <Badge className="text-[10px] px-1 py-0 h-4 bg-primary/20 text-primary border-0">
                                          ATM
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className={`text-right font-mono ${config.putClass}`}>
                                    {activeTab === "oichange" ? (
                                      <span className={values.put && values.put > 0 ? "text-green-400" : "text-red-400"}>
                                        {values.put && values.put > 0 ? "+" : ""}
                                        {formatNumber(values.put || 0, 0)}
                                      </span>
                                    ) : (
                                      formatNumber(values.put || 0, 0)
                                    )}
                                  </td>
                                  <td className={`text-right font-mono ${config.callClass}`}>
                                    {activeTab === "oichange" ? (
                                      <span className={values.call && values.call > 0 ? "text-green-400" : "text-red-400"}>
                                        {values.call && values.call > 0 ? "+" : ""}
                                        {formatNumber(values.call || 0, 0)}
                                      </span>
                                    ) : (
                                      formatNumber(values.call || 0, 0)
                                    )}
                                  </td>
                                  <td className="text-right text-muted-foreground font-mono">
                                    {strike.volSettle
                                      ? formatNumber(strike.volSettle, 2) + "%"
                                      : "-"}
                                  </td>
                                  <td className="text-right text-muted-foreground">
                                    {strike.range || "-"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="border-border/40 border-dashed">
                  <CardContent className="flex flex-col items-center justify-center h-96">
                    <div className={`p-4 rounded-2xl ${config.iconBg} mb-4`}>
                      <config.icon className={`h-10 w-10 ${config.iconColor} opacity-50`} />
                    </div>
                    <p className="text-muted-foreground text-center">
                      เลือก Snapshot จาก Timeline<br/>
                      <span className="text-sm">เพื่อดูรายละเอียด {config.fullLabel}</span>
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
