"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber, cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Square,
  Trash2,
  ChevronDown,
  ChevronUp,
  Send,
  DollarSign,
  Percent,
  ListChecks,
  Info,
  Trophy,
  Ban,
  Zap,
  RefreshCw,
} from "lucide-react";

interface MT5Order {
  id: string;
  symbol: string;
  orderType: "BUY" | "SELL";
  lotSize: number;
  entryPrice: number;
  entryTime: string;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number | null;
  takeProfit3: number | null;
  status: "PENDING" | "OPEN" | "CLOSED";
  result: string | null;
  closePrice: number | null;
  closeTime: string | null;
  profitLoss: number | null;
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  slHit: boolean;
  notes: string | null;
  signalSource: string | null;
  createdAt: string;
}

interface OrderStats {
  PENDING: number;
  OPEN: number;
  CLOSED: number;
}

interface ResultStats {
  TP1_HIT: number;
  TP2_HIT: number;
  TP3_HIT: number;
  SL_HIT: number;
  MANUAL_CLOSE: number;
}

export default function MT5Page() {
  const [orders, setOrders] = useState<MT5Order[]>([]);
  const [stats, setStats] = useState<OrderStats>({ PENDING: 0, OPEN: 0, CLOSED: 0 });
  const [results, setResults] = useState<ResultStats>({
    TP1_HIT: 0,
    TP2_HIT: 0,
    TP3_HIT: 0,
    SL_HIT: 0,
    MANUAL_CLOSE: 0,
  });
  const [winRate, setWinRate] = useState("0");
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.append("status", filter);

      const response = await fetch(`/api/mt5-orders?${params}`);
      const data = await response.json();
      if (data.success) {
        setOrders(data.orders);
        setStats(data.stats);
        setResults(data.results);
        setWinRate(data.winRate);
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateOrder = async (id: string, updates: Partial<MT5Order>) => {
    try {
      const response = await fetch("/api/mt5-orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await response.json();
      if (data.success) {
        fetchOrders();
      }
    } catch (err) {
      console.error("Error updating order:", err);
    }
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("คุณต้องการลบ order นี้?")) return;
    try {
      const response = await fetch(`/api/mt5-orders?id=${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        fetchOrders();
      }
    } catch (err) {
      console.error("Error deleting order:", err);
    }
  };

  const handleTPSLClick = async (order: MT5Order, type: "tp1" | "tp2" | "tp3" | "sl") => {
    const updates: Partial<MT5Order> = {};
    
    if (type === "tp1") {
      updates.tp1Hit = !order.tp1Hit;
      if (!order.tp1Hit) {
        updates.result = "TP1_HIT";
        updates.closePrice = order.takeProfit1;
        updates.status = "CLOSED";
      }
    } else if (type === "tp2" && order.takeProfit2) {
      updates.tp2Hit = !order.tp2Hit;
      if (!order.tp2Hit) {
        updates.result = "TP2_HIT";
        updates.closePrice = order.takeProfit2;
        updates.status = "CLOSED";
      }
    } else if (type === "tp3" && order.takeProfit3) {
      updates.tp3Hit = !order.tp3Hit;
      if (!order.tp3Hit) {
        updates.result = "TP3_HIT";
        updates.closePrice = order.takeProfit3;
        updates.status = "CLOSED";
      }
    } else if (type === "sl") {
      updates.slHit = !order.slHit;
      if (!order.slHit) {
        updates.result = "SL_HIT";
        updates.closePrice = order.stopLoss;
        updates.status = "CLOSED";
      }
    }

    await updateOrder(order.id, updates);
  };

  const totalOrders = stats.PENDING + stats.OPEN + stats.CLOSED;
  const totalWins = results.TP1_HIT + results.TP2_HIT + results.TP3_HIT;
  const totalLosses = results.SL_HIT;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="MT5 Orders (จำลอง)"
        subtitle="จำลองการส่งคำสั่งเทรดและติดตาม TP/SL"
        onRefresh={fetchOrders}
        isLoading={isLoading}
      />

      <div className="flex-1 overflow-auto">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border-b border-border/40">
          <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
          <div className="relative p-6 md:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="bg-indigo-500 text-white p-4 rounded-2xl shadow-lg">
                  <Send className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">MT5 Trading Simulator</p>
                  <h2 className="text-3xl font-bold text-indigo-400">
                    {totalOrders} Orders
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Win Rate: <span className={cn(
                      "font-bold",
                      parseFloat(winRate) >= 50 ? "text-green-500" : "text-red-500"
                    )}>{winRate}%</span>
                  </p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-green-500">
                    <Trophy className="h-4 w-4" />
                    <span className="text-2xl font-bold">{totalWins}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Wins</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1 text-red-500">
                    <Ban className="h-4 w-4" />
                    <span className="text-2xl font-bold">{totalLosses}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Losses</p>
                </div>
              </div>

              {/* Auto-generated indicator */}
              <div className="flex items-center gap-2 bg-indigo-500/20 px-4 py-2 rounded-lg border border-indigo-500/30">
                <Zap className="h-5 w-5 text-indigo-400" />
                <div>
                  <p className="text-sm font-medium text-indigo-300">Auto-Generated</p>
                  <p className="text-xs text-muted-foreground">Orders สร้างอัตโนมัติจาก AI</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Info Card - Auto Generation */}
          <Card className="border-indigo-500/30 bg-indigo-950/10">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-indigo-400">Orders สร้างอัตโนมัติ</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    ทุกครั้งที่มีการ Sync ข้อมูล CME ใหม่ ระบบจะวิเคราะห์ด้วย AI และสร้าง Order อัตโนมัติ
                    เมื่อ Signal มีความแรง &ge; 3 และ Confidence &ge; 60%
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="outline" className="text-green-500 border-green-500/50">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Confidence &ge; 60%
                    </Badge>
                    <Badge variant="outline" className="text-blue-500 border-blue-500/50">
                      <Zap className="h-3 w-3 mr-1" />
                      Signal Strength &ge; 3
                    </Badge>
                    <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
                      <RefreshCw className="h-3 w-3 mr-1" />
                      1 Order ต่อ Symbol
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {/* Order Status */}
            {(["PENDING", "OPEN", "CLOSED"] as const).map((status) => {
              const icons = {
                PENDING: Clock,
                OPEN: Play,
                CLOSED: Square,
              };
              const colors = {
                PENDING: "text-yellow-500",
                OPEN: "text-blue-500",
                CLOSED: "text-gray-500",
              };
              const bgColors = {
                PENDING: "bg-yellow-500/10",
                OPEN: "bg-blue-500/10",
                CLOSED: "bg-gray-500/10",
              };
              const Icon = icons[status];
              const isActive = filter === status;

              return (
                <Card
                  key={status}
                  className={cn(
                    "border-border/40 cursor-pointer transition-all hover:border-primary/50",
                    isActive && "ring-2 ring-primary"
                  )}
                  onClick={() => setFilter(isActive ? null : status)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${bgColors[status]}`}>
                        <Icon className={`h-4 w-4 ${colors[status]}`} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{status}</p>
                        <p className={`text-2xl font-bold ${colors[status]}`}>
                          {stats[status]}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Result Stats */}
            <Card className="border-green-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Target className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">TP Hit</p>
                    <p className="text-2xl font-bold text-green-500">{totalWins}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <Shield className="h-4 w-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">SL Hit</p>
                    <p className="text-2xl font-bold text-red-500">{totalLosses}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={cn(
              "border-border/40",
              parseFloat(winRate) >= 50 ? "border-green-500/30" : "border-red-500/30"
            )}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${parseFloat(winRate) >= 50 ? "bg-green-500/10" : "bg-red-500/10"}`}>
                    <Percent className={`h-4 w-4 ${parseFloat(winRate) >= 50 ? "text-green-500" : "text-red-500"}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Win Rate</p>
                    <p className={`text-2xl font-bold ${parseFloat(winRate) >= 50 ? "text-green-500" : "text-red-500"}`}>
                      {winRate}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Orders List */}
          <Card className="border-border/40">
            <CardHeader className="pb-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  รายการ Orders
                </CardTitle>
                {filter && (
                  <Badge
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => setFilter(null)}
                  >
                    {filter} <XCircle className="h-3 w-3 ml-1" />
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {orders.length === 0 ? (
                <div className="p-12 text-center">
                  <Send className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">ยังไม่มี orders</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Orders จะสร้างอัตโนมัติเมื่อ Sync ข้อมูล CME และ AI วิเคราะห์ได้ Signal ที่ชัดเจน
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {orders.map((order) => {
                    const isExpanded = expandedId === order.id;
                    const isBuy = order.orderType === "BUY";

                    return (
                      <div
                        key={order.id}
                        className={cn(
                          "transition-all",
                          isExpanded ? "bg-muted/30" : "hover:bg-muted/20"
                        )}
                      >
                        {/* Main Row */}
                        <div
                          className="p-4 cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : order.id)}
                        >
                          <div className="flex items-center gap-4">
                            {/* Order Type Icon */}
                            <div
                              className={cn(
                                "p-2 rounded-xl",
                                isBuy ? "bg-green-500/10" : "bg-red-500/10"
                              )}
                            >
                              {isBuy ? (
                                <TrendingUp className="h-5 w-5 text-green-500" />
                              ) : (
                                <TrendingDown className="h-5 w-5 text-red-500" />
                              )}
                            </div>

                            {/* Order Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={cn(
                                    "font-bold",
                                    isBuy ? "text-green-500" : "text-red-500"
                                  )}
                                >
                                  {order.orderType}
                                </span>
                                <Badge variant="outline">{order.symbol}</Badge>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    order.status === "OPEN" && "text-blue-500 border-blue-500",
                                    order.status === "CLOSED" && "text-gray-500 border-gray-500",
                                    order.status === "PENDING" && "text-yellow-500 border-yellow-500"
                                  )}
                                >
                                  {order.status}
                                </Badge>
                                {order.signalSource && (
                                  <Badge variant="secondary" className="text-xs">
                                    {order.signalSource}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Entry: {formatNumber(order.entryPrice, 2)} | Lot: {order.lotSize}
                              </p>
                            </div>

                            {/* TP/SL Checklist (Mini) */}
                            <div className="flex items-center gap-1">
                              <div
                                className={cn(
                                  "w-6 h-6 rounded flex items-center justify-center text-xs font-bold",
                                  order.tp1Hit ? "bg-green-500 text-white" : "bg-gray-700 text-gray-400"
                                )}
                              >
                                1
                              </div>
                              {order.takeProfit2 && (
                                <div
                                  className={cn(
                                    "w-6 h-6 rounded flex items-center justify-center text-xs font-bold",
                                    order.tp2Hit ? "bg-green-500 text-white" : "bg-gray-700 text-gray-400"
                                  )}
                                >
                                  2
                                </div>
                              )}
                              {order.takeProfit3 && (
                                <div
                                  className={cn(
                                    "w-6 h-6 rounded flex items-center justify-center text-xs font-bold",
                                    order.tp3Hit ? "bg-green-500 text-white" : "bg-gray-700 text-gray-400"
                                  )}
                                >
                                  3
                                </div>
                              )}
                              <div
                                className={cn(
                                  "w-6 h-6 rounded flex items-center justify-center text-xs",
                                  order.slHit ? "bg-red-500 text-white" : "bg-gray-700 text-gray-400"
                                )}
                              >
                                SL
                              </div>
                            </div>

                            {/* Expand */}
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="px-4 pb-4 space-y-4">
                            {/* TP/SL Checklist */}
                            <div className="bg-card/50 rounded-lg p-4 border border-border/30">
                              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                <ListChecks className="h-4 w-4" />
                                TP/SL Checklist
                              </h4>
                              <div className="grid gap-2 sm:grid-cols-4">
                                {/* TP1 */}
                                <button
                                  onClick={() => handleTPSLClick(order, "tp1")}
                                  className={cn(
                                    "p-3 rounded-lg border transition-all flex items-center gap-3",
                                    order.tp1Hit
                                      ? "bg-green-500/20 border-green-500 text-green-400"
                                      : "bg-gray-800/50 border-gray-600 hover:border-green-500/50"
                                  )}
                                >
                                  {order.tp1Hit ? (
                                    <CheckCircle2 className="h-5 w-5" />
                                  ) : (
                                    <Target className="h-5 w-5 text-green-500/50" />
                                  )}
                                  <div className="text-left">
                                    <p className="text-xs text-muted-foreground">Take Profit 1</p>
                                    <p className="font-mono font-bold">
                                      {formatNumber(order.takeProfit1, 2)}
                                    </p>
                                  </div>
                                </button>

                                {/* TP2 */}
                                {order.takeProfit2 && (
                                  <button
                                    onClick={() => handleTPSLClick(order, "tp2")}
                                    className={cn(
                                      "p-3 rounded-lg border transition-all flex items-center gap-3",
                                      order.tp2Hit
                                        ? "bg-green-500/20 border-green-500 text-green-400"
                                        : "bg-gray-800/50 border-gray-600 hover:border-green-500/50"
                                    )}
                                  >
                                    {order.tp2Hit ? (
                                      <CheckCircle2 className="h-5 w-5" />
                                    ) : (
                                      <Target className="h-5 w-5 text-green-500/50" />
                                    )}
                                    <div className="text-left">
                                      <p className="text-xs text-muted-foreground">Take Profit 2</p>
                                      <p className="font-mono font-bold">
                                        {formatNumber(order.takeProfit2, 2)}
                                      </p>
                                    </div>
                                  </button>
                                )}

                                {/* TP3 */}
                                {order.takeProfit3 && (
                                  <button
                                    onClick={() => handleTPSLClick(order, "tp3")}
                                    className={cn(
                                      "p-3 rounded-lg border transition-all flex items-center gap-3",
                                      order.tp3Hit
                                        ? "bg-green-500/20 border-green-500 text-green-400"
                                        : "bg-gray-800/50 border-gray-600 hover:border-green-500/50"
                                    )}
                                  >
                                    {order.tp3Hit ? (
                                      <CheckCircle2 className="h-5 w-5" />
                                    ) : (
                                      <Target className="h-5 w-5 text-green-500/50" />
                                    )}
                                    <div className="text-left">
                                      <p className="text-xs text-muted-foreground">Take Profit 3</p>
                                      <p className="font-mono font-bold">
                                        {formatNumber(order.takeProfit3, 2)}
                                      </p>
                                    </div>
                                  </button>
                                )}

                                {/* SL */}
                                <button
                                  onClick={() => handleTPSLClick(order, "sl")}
                                  className={cn(
                                    "p-3 rounded-lg border transition-all flex items-center gap-3",
                                    order.slHit
                                      ? "bg-red-500/20 border-red-500 text-red-400"
                                      : "bg-gray-800/50 border-gray-600 hover:border-red-500/50"
                                  )}
                                >
                                  {order.slHit ? (
                                    <XCircle className="h-5 w-5" />
                                  ) : (
                                    <Shield className="h-5 w-5 text-red-500/50" />
                                  )}
                                  <div className="text-left">
                                    <p className="text-xs text-muted-foreground">Stop Loss</p>
                                    <p className="font-mono font-bold">
                                      {formatNumber(order.stopLoss, 2)}
                                    </p>
                                  </div>
                                </button>
                              </div>
                            </div>

                            {/* Order Details */}
                            <div className="grid gap-3 sm:grid-cols-4 bg-card/50 rounded-lg p-4 border border-border/30">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-500/10">
                                  <DollarSign className="h-4 w-4 text-blue-500" />
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Entry Price</p>
                                  <p className="font-mono font-medium">
                                    {formatNumber(order.entryPrice, 2)}
                                  </p>
                                </div>
                              </div>

                              {order.closePrice && (
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-purple-500/10">
                                    <DollarSign className="h-4 w-4 text-purple-500" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Close Price</p>
                                    <p className="font-mono font-medium">
                                      {formatNumber(order.closePrice, 2)}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {order.profitLoss !== null && (
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "p-2 rounded-lg",
                                    order.profitLoss >= 0 ? "bg-green-500/10" : "bg-red-500/10"
                                  )}>
                                    {order.profitLoss >= 0 ? (
                                      <TrendingUp className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <TrendingDown className="h-4 w-4 text-red-500" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">P/L (Points)</p>
                                    <p className={cn(
                                      "font-mono font-medium",
                                      order.profitLoss >= 0 ? "text-green-500" : "text-red-500"
                                    )}>
                                      {order.profitLoss >= 0 ? "+" : ""}{formatNumber(order.profitLoss, 2)}
                                    </p>
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-gray-500/10">
                                  <Clock className="h-4 w-4 text-gray-500" />
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Created</p>
                                  <p className="text-xs">
                                    {new Date(order.createdAt).toLocaleString("th-TH")}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Notes */}
                            {order.notes && (
                              <div className="bg-card/50 rounded-lg p-3 border border-border/30">
                                <p className="text-xs text-muted-foreground mb-1">Notes:</p>
                                <p className="text-sm">{order.notes}</p>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex justify-end gap-2">
                              {order.status === "OPEN" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateOrder(order.id, {
                                    status: "CLOSED",
                                    result: "MANUAL_CLOSE",
                                    closePrice: order.entryPrice, // Can be updated
                                  })}
                                >
                                  <Square className="h-4 w-4 mr-1" />
                                  ปิด Order
                                </Button>
                              )}
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteOrder(order.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                ลบ
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* How to Use */}
          <Card className="border-border/40">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <ListChecks className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">วิธีใช้งาน Checklist</p>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                    <li>1. เมื่อราคาถึง TP1/TP2/TP3 หรือ SL ให้คลิกที่ปุ่มนั้นเพื่อ mark</li>
                    <li>2. ระบบจะอัพเดท status เป็น CLOSED และคำนวณ P/L อัตโนมัติ</li>
                    <li>3. Win Rate จะคำนวณจาก orders ที่ hit TP vs SL</li>
                    <li>4. คลิกปุ่ม &quot;ปิด Order&quot; เพื่อปิด manual ถ้าต้องการ</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
