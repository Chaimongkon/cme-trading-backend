"use client";

import { Header } from "@/components/layout/header";
import { SignalDisplay, QuickSignal, SignalSummary, SignalStats } from "@/components/trading/signal-display";
import { AnalyzeForm } from "@/components/trading/analyze-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  BookOpen,
  Sparkles,
  Radio,
  FlaskConical
} from "lucide-react";

export default function AnalyzePage() {
  return (
    <div className="flex flex-col h-full">
      <Header
        title="วิเคราะห์สัญญาณ"
        subtitle="Options Analytics & Signal Generator"
      />

      <div className="flex-1 overflow-auto">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-background border-b border-border/40">
          <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
          <div className="relative p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold">สัญญาณเทรดปัจจุบัน</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  วิเคราะห์จากข้อมูล Options แบบ Real-time
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground">สถานะ</p>
                </div>
                <QuickSignal />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 space-y-6">
          <Tabs defaultValue="live" className="w-full">
            {/* Tab Navigation */}
            <div className="flex items-center justify-center mb-6">
              <TabsList className="grid grid-cols-2 h-12 w-full max-w-md">
                <TabsTrigger value="live" className="gap-2 text-sm">
                  <Radio className="h-4 w-4" />
                  <span className="hidden sm:inline">สัญญาณ</span> Live
                </TabsTrigger>
                <TabsTrigger value="custom" className="gap-2 text-sm">
                  <FlaskConical className="h-4 w-4" />
                  <span className="hidden sm:inline">วิเคราะห์</span>ข้อมูลเอง
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab 1: Live Signal from Database */}
            <TabsContent value="live" className="space-y-6 mt-0">
              {/* Stats Row - Live Data */}
              <SignalStats refreshInterval={30000} />

              {/* Main Content Grid */}
              <div className="grid gap-6 lg:grid-cols-5">
                {/* Left: Signal Display - Full (3 cols) */}
                <div className="lg:col-span-3 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h3 className="font-medium">การวิเคราะห์แบบละเอียด</h3>
                    <Badge variant="outline" className="ml-auto text-xs">
                      Auto Refresh: 30s
                    </Badge>
                  </div>
                  <SignalDisplay refreshInterval={30000} />
                </div>

                {/* Right: Summary (2 cols) */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <h3 className="font-medium">คำอธิบายสำหรับผู้เริ่มต้น</h3>
                  </div>
                  <SignalSummary refreshInterval={30000} />
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Custom Analysis */}
            <TabsContent value="custom" className="space-y-6 mt-0">
              {/* Info Banner */}
              <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-primary/5 to-transparent">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                      <FlaskConical className="h-4 w-4 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-sm">วิเคราะห์ข้อมูล Options ของคุณเอง</p>
                      <p className="text-xs text-muted-foreground">
                        วางข้อมูล JSON จาก CME หรือแหล่งอื่นๆ แล้วกด "วิเคราะห์" เพื่อดูผลลัพธ์ทันที
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Analysis Form */}
              <AnalyzeForm />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
