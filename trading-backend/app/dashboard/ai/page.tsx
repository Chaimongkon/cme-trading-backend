"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import {
  AIDashboardLayout,
  AIControlSection,
  AIResultSection,
} from "@/components/trading/ai/ai-dashboard-layout";
import { AIControls } from "@/components/trading/ai/ai-controls";
import { AIResultDisplay } from "@/components/trading/ai/ai-result-display";
import { AIStatsCards } from "@/components/trading/ai/ai-stats-cards";
import { AIAnalysisResponse, AnalysisMode, ProviderType } from "@/components/trading/ai/types";
import { AlertTriangle, Sparkles, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function AIAnalysisPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AIAnalysisResponse | null>(null);
  const [mode, setMode] = useState<AnalysisMode>("enhanced");
  const [loadingStep, setLoadingStep] = useState(0);

  // Simulate progress steps
  useEffect(() => {
    if (!isLoading) {
      setLoadingStep(0);
      return;
    }

    const intervals = [
      setTimeout(() => setLoadingStep(1), 2000), // GEX
      setTimeout(() => setLoadingStep(2), 4000), // Calendar
      setTimeout(() => setLoadingStep(3), 6000), // AI Analysis
      setTimeout(() => setLoadingStep(4), 12000), // Finalizing
    ];

    return () => intervals.forEach(clearTimeout);
  }, [isLoading]);

  const runAnalysis = async (
    provider: ProviderType = "auto",
    analysisMode: AnalysisMode = mode
  ) => {
    setIsLoading(true);
    setResult(null);
    setLoadingStep(0);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes timeout

    try {
      const response = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          mode: analysisMode,
          trackPrediction: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      setResult(data);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setResult({
          success: false,
          error: "การวิเคราะห์ใช้เวลานานเกินไป (Timeout) กรุณาลองใหม่หรือเปลี่ยน Provider",
        });
      } else {
        setResult({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <Header title="วิเคราะห์ AI" subtitle="ระบบวิเคราะห์ตลาดอัจฉริยะ" />

      <div className="flex-1 overflow-hidden">
        <AIDashboardLayout>
          {/* Left Column: Controls */}
          <AIControlSection>
            <AIControls
              onAnalyze={runAnalysis}
              isLoading={isLoading}
              currentMode={mode}
              onModeChange={setMode}
            />

            {/* Quick Tips or Status */}
            {!result && (
              <Card className="border-blue-500/20 bg-blue-500/5 mt-auto">
                <CardContent className="p-4 flex gap-3">
                  <Sparkles className="h-5 w-5 text-blue-500 shrink-0" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-blue-500 mb-1">เคล็ดลับ</p>
                    ใช้ "วิเคราะห์แบบเจาะลึก" เพื่อผลลัพธ์ที่แม่นยำที่สุด โดยรวมข้อมูลกราฟและข่าวสารเข้าด้วยกัน
                  </div>
                </CardContent>
              </Card>
            )}
          </AIControlSection>

          {/* Right Column: Results */}
          <AIResultSection>
            {/* Empty State */}
            {!result && !isLoading && (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-12 border-2 border-dashed border-border/50 rounded-3xl bg-card/10">
                <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-6 animate-pulse">
                  <Sparkles className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-bold mb-2">พร้อมวิเคราะห์</h3>
                <p className="text-center max-w-md">
                  เลือกโหมดและกด "เริ่มวิเคราะห์" เพื่อรับข้อมูลเชิงลึกจาก AI
                </p>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="h-full flex flex-col items-center justify-center space-y-8">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-primary/20 animate-spin border-t-primary" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                  </div>
                </div>
                <div className="text-center space-y-4 max-w-md mx-auto">
                  <h3 className="text-xl font-bold animate-pulse">
                    {loadingStep === 0 && "กำลังดึงข้อมูลตลาดล่าสุด..."}
                    {loadingStep === 1 && "กำลังคำนวณ GEX และ Technicals..."}
                    {loadingStep === 2 && "กำลังตรวจสอบข่าวเศรษฐกิจ..."}
                    {loadingStep === 3 && "AI กำลังวิเคราะห์หาจุดเข้าเทรด..."}
                    {loadingStep >= 4 && "กำลังสรุปผลลัพธ์..."}
                  </h3>

                  {/* Progress Steps */}
                  <div className="space-y-3">
                    <ProgressStep
                      active={loadingStep === 0}
                      completed={loadingStep > 0}
                      label="ดึงข้อมูล Volume, OI, Price"
                    />
                    <ProgressStep
                      active={loadingStep === 1}
                      completed={loadingStep > 1}
                      label="คำนวณ Greeks & Indicators"
                    />
                    <ProgressStep
                      active={loadingStep === 2}
                      completed={loadingStep > 2}
                      label="ตรวจสอบปฏิทินเศรษฐกิจ"
                    />
                    <ProgressStep
                      active={loadingStep >= 3}
                      completed={false}
                      label="AI Analysis & Reasoning"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Error State */}
            {result && !result.success && (
              <Card className="border-red-500/30 bg-red-500/5">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-6 w-6 text-red-500 shrink-0" />
                    <div>
                      <p className="font-medium text-red-500">การวิเคราะห์ล้มเหลว</p>
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

            {/* Success Result */}
            {result?.success && result.analysis && (
              <>
                <AIStatsCards result={result.analysis} />
                <AIResultDisplay result={result.analysis} />
              </>
            )}
          </AIResultSection>
        </AIDashboardLayout>
      </div>
    </div>
  );
}

function ProgressStep({ active, completed, label }: { active: boolean; completed: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-3 text-sm transition-colors duration-300 ${active ? "text-yellow-500 font-bold" :
        completed ? "text-green-500" :
          "text-muted-foreground"
      }`}>
      <div className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all duration-300 ${active ? "border-yellow-500 bg-yellow-500/20" :
          completed ? "border-green-500 bg-green-500" :
            "border-muted-foreground/30"
        }`}>
        {completed && <Check className="w-2.5 h-2.5 text-white" />}
        {active && <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />}
      </div>
      {label}
    </div>
  );
}
