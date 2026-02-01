"use client";

import { useState } from "react";
import { useAnalyzeData, getSignalColor, getSignalBgColor, getSignalLabel } from "@/hooks/use-analysis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Loader2, Play } from "lucide-react";

// ============================================
// Analyze Form Component - Direct POST Analysis
// ============================================

const EXAMPLE_DATA = {
  current_price: 2750.5,
  strikes: [
    { strike_price: 2650, call_oi: 500, put_oi: 3200, call_volume: 50, put_volume: 120 },
    { strike_price: 2700, call_oi: 1200, put_oi: 4500, call_volume: 100, put_volume: 200 },
    { strike_price: 2725, call_oi: 1800, put_oi: 3800, call_volume: 150, put_volume: 180 },
    { strike_price: 2750, call_oi: 2500, put_oi: 2500, call_volume: 300, put_volume: 250 },
    { strike_price: 2775, call_oi: 3200, put_oi: 1800, call_volume: 200, put_volume: 120 },
    { strike_price: 2800, call_oi: 4000, put_oi: 1200, call_volume: 180, put_volume: 80 },
    { strike_price: 2850, call_oi: 2800, put_oi: 600, call_volume: 100, put_volume: 30 },
  ],
};

export function AnalyzeForm() {
  const { analyze, data, isLoading, error } = useAnalyzeData();
  const [jsonInput, setJsonInput] = useState(JSON.stringify(EXAMPLE_DATA, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setParseError(null);
    
    try {
      const parsed = JSON.parse(jsonInput);
      await analyze(parsed);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Invalid JSON");
    }
  };

  const loadExample = () => {
    setJsonInput(JSON.stringify(EXAMPLE_DATA, null, 2));
    setParseError(null);
  };

  const signalType = data?.signal?.signal || "NEUTRAL";
  const signalColor = getSignalColor(signalType);
  const signalBgColor = getSignalBgColor(signalType);
  const signalLabel = getSignalLabel(signalType);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Input Form */}
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-lg">วิเคราะห์ข้อมูล Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>JSON Input</Label>
            <Button variant="outline" size="sm" onClick={loadExample}>
              โหลดตัวอย่าง
            </Button>
          </div>
          
          <Textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="font-mono text-sm h-80"
            placeholder='{"current_price": 2750, "strikes": [...]}'
          />

          {parseError && (
            <p className="text-sm text-destructive">{parseError}</p>
          )}

          <Button onClick={handleAnalyze} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                กำลังวิเคราะห์...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                วิเคราะห์
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-lg">ผลการวิเคราะห์</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          {!data && !error && (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>กรอกข้อมูลและกด "วิเคราะห์" เพื่อดูผลลัพธ์</p>
            </div>
          )}

          {data && (
            <div className="space-y-6">
              {/* Signal & Sentiment */}
              <div className="flex items-center justify-center py-4">
                <div className={`${signalBgColor} text-white px-6 py-3 rounded-xl flex items-center gap-3 shadow-lg`}>
                  {signalType === "BUY" ? (
                    <TrendingUp className="h-6 w-6" />
                  ) : signalType === "SELL" ? (
                    <TrendingDown className="h-6 w-6" />
                  ) : (
                    <Minus className="h-6 w-6" />
                  )}
                  <div>
                    <span className="text-xl font-bold">{signalLabel}</span>
                    <p className="text-xs opacity-80">{data.signal.sentiment}</p>
                  </div>
                </div>
              </div>

              {/* Confidence Score (0-100) */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Confidence Score</p>
                <div className="relative w-full h-4 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${signalBgColor} transition-all duration-500`}
                    style={{ width: `${data.signal.score}%` }}
                  />
                </div>
                <p className={`text-2xl font-bold mt-2 ${signalColor}`}>
                  {data.signal.score}%
                </p>
              </div>

              {/* Reason */}
              <div className="border-t border-border/40 pt-4">
                <p className="text-sm text-center text-muted-foreground">
                  {data.signal.reason}
                </p>
              </div>

              {/* Key Levels */}
              <div className="grid grid-cols-3 gap-4 border-t border-border/40 pt-4">
                <div className="text-center">
                  <p className="text-xs text-green-400">Put Wall (Support)</p>
                  <p className="font-mono font-bold">
                    {formatNumber(data.signal.key_levels.put_wall, 0)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-purple-400">Max Pain</p>
                  <p className="font-mono font-bold">
                    {formatNumber(data.signal.key_levels.max_pain, 0)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-red-400">Call Wall (Resistance)</p>
                  <p className="font-mono font-bold">
                    {formatNumber(data.signal.key_levels.call_wall, 0)}
                  </p>
                </div>
              </div>

              {/* Significant Strikes */}
              {data.signal.key_levels.significant_strikes.length > 0 && (
                <div className="border-t border-border/40 pt-4">
                  <p className="text-xs text-muted-foreground mb-2">Strike ที่มี Volume สูงผิดปกติ:</p>
                  <div className="flex flex-wrap gap-2">
                    {data.signal.key_levels.significant_strikes.map((strike, i) => (
                      <span key={i} className="px-2 py-1 bg-yellow-500/20 text-yellow-500 text-xs rounded font-mono">
                        {formatNumber(strike, 0)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* PCR */}
              <div className="grid grid-cols-3 gap-4 border-t border-border/40 pt-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">OI PCR</p>
                  <p className="font-mono">{data.pcr.oi_pcr}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Vol PCR</p>
                  <p className="font-mono">{data.pcr.volume_pcr}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">VWAP</p>
                  <p className="font-mono">{data.market.vwap}</p>
                </div>
              </div>

              {/* Scoring Visualization */}
              {data.signal.factor_scores && (
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
                        {data.signal.factor_scores.pcr_score > 0 ? (
                          <div 
                            className="h-full bg-green-500 ml-[50%]" 
                            style={{ width: `${Math.abs(data.signal.factor_scores.pcr_score) * 2}%` }} 
                          />
                        ) : data.signal.factor_scores.pcr_score < 0 ? (
                          <div 
                            className="h-full bg-red-500 mr-[50%] ml-auto" 
                            style={{ width: `${Math.abs(data.signal.factor_scores.pcr_score) * 2}%`, marginLeft: `${50 - Math.abs(data.signal.factor_scores.pcr_score) * 2}%` }} 
                          />
                        ) : null}
                      </div>
                      <span className={`text-xs w-12 text-right font-mono ${data.signal.factor_scores.pcr_score > 0 ? 'text-green-400' : data.signal.factor_scores.pcr_score < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {data.signal.factor_scores.pcr_score > 0 ? '+' : ''}{data.signal.factor_scores.pcr_score}
                      </span>
                    </div>
                    
                    {/* VWAP Score */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-24 text-muted-foreground">VWAP Trend</span>
                      <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-px h-full bg-gray-500" />
                        </div>
                        {data.signal.factor_scores.vwap_score > 0 ? (
                          <div 
                            className="h-full bg-green-500 ml-[50%]" 
                            style={{ width: `${Math.abs(data.signal.factor_scores.vwap_score) * 2}%` }} 
                          />
                        ) : data.signal.factor_scores.vwap_score < 0 ? (
                          <div 
                            className="h-full bg-red-500" 
                            style={{ width: `${Math.abs(data.signal.factor_scores.vwap_score) * 2}%`, marginLeft: `${50 - Math.abs(data.signal.factor_scores.vwap_score) * 2}%` }} 
                          />
                        ) : null}
                      </div>
                      <span className={`text-xs w-12 text-right font-mono ${data.signal.factor_scores.vwap_score > 0 ? 'text-green-400' : data.signal.factor_scores.vwap_score < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {data.signal.factor_scores.vwap_score > 0 ? '+' : ''}{data.signal.factor_scores.vwap_score}
                      </span>
                    </div>
                    
                    {/* OI Flow Score */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-24 text-muted-foreground">OI Flow</span>
                      <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-px h-full bg-gray-500" />
                        </div>
                        {data.signal.factor_scores.flow_score > 0 ? (
                          <div 
                            className="h-full bg-green-500 ml-[50%]" 
                            style={{ width: `${Math.abs(data.signal.factor_scores.flow_score) * 2}%` }} 
                          />
                        ) : data.signal.factor_scores.flow_score < 0 ? (
                          <div 
                            className="h-full bg-red-500" 
                            style={{ width: `${Math.abs(data.signal.factor_scores.flow_score) * 2}%`, marginLeft: `${50 - Math.abs(data.signal.factor_scores.flow_score) * 2}%` }} 
                          />
                        ) : null}
                      </div>
                      <span className={`text-xs w-12 text-right font-mono ${data.signal.factor_scores.flow_score > 0 ? 'text-green-400' : data.signal.factor_scores.flow_score < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {data.signal.factor_scores.flow_score > 0 ? '+' : ''}{data.signal.factor_scores.flow_score}
                      </span>
                    </div>
                    
                    {/* Wall Score */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-24 text-muted-foreground">Wall Position</span>
                      <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-px h-full bg-gray-500" />
                        </div>
                        {data.signal.factor_scores.wall_score > 0 ? (
                          <div 
                            className="h-full bg-green-500 ml-[50%]" 
                            style={{ width: `${Math.min(Math.abs(data.signal.factor_scores.wall_score) * 2, 50)}%` }} 
                          />
                        ) : data.signal.factor_scores.wall_score < 0 ? (
                          <div 
                            className="h-full bg-red-500" 
                            style={{ width: `${Math.min(Math.abs(data.signal.factor_scores.wall_score) * 2, 50)}%`, marginLeft: `${50 - Math.min(Math.abs(data.signal.factor_scores.wall_score) * 2, 50)}%` }} 
                          />
                        ) : null}
                      </div>
                      <span className={`text-xs w-12 text-right font-mono ${data.signal.factor_scores.wall_score > 0 ? 'text-green-400' : data.signal.factor_scores.wall_score < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {data.signal.factor_scores.wall_score > 0 ? '+' : ''}{data.signal.factor_scores.wall_score}
                      </span>
                    </div>
                    
                    {/* Max Pain Score */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-24 text-muted-foreground">Max Pain</span>
                      <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-px h-full bg-gray-500" />
                        </div>
                        {data.signal.factor_scores.max_pain_score > 0 ? (
                          <div 
                            className="h-full bg-green-500 ml-[50%]" 
                            style={{ width: `${Math.abs(data.signal.factor_scores.max_pain_score) * 2}%` }} 
                          />
                        ) : data.signal.factor_scores.max_pain_score < 0 ? (
                          <div 
                            className="h-full bg-red-500" 
                            style={{ width: `${Math.abs(data.signal.factor_scores.max_pain_score) * 2}%`, marginLeft: `${50 - Math.abs(data.signal.factor_scores.max_pain_score) * 2}%` }} 
                          />
                        ) : null}
                      </div>
                      <span className={`text-xs w-12 text-right font-mono ${data.signal.factor_scores.max_pain_score > 0 ? 'text-green-400' : data.signal.factor_scores.max_pain_score < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {data.signal.factor_scores.max_pain_score > 0 ? '+' : ''}{data.signal.factor_scores.max_pain_score}
                      </span>
                    </div>
                    
                    {/* Total Line */}
                    <div className="border-t border-border/40 mt-2 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-24 font-medium text-foreground">TOTAL</span>
                        <div className="flex-1 h-4 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              data.signal.score >= 60 ? 'bg-green-500' : 
                              data.signal.score <= 40 ? 'bg-red-500' : 
                              'bg-yellow-500'
                            }`}
                            style={{ width: `${data.signal.score}%` }}
                          />
                        </div>
                        <span className={`text-sm w-12 text-right font-mono font-bold ${
                          data.signal.score >= 60 ? 'text-green-400' : 
                          data.signal.score <= 40 ? 'text-red-400' : 
                          'text-yellow-400'
                        }`}>
                          {data.signal.score}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Positive Factors */}
              {data.signal.factors.positive.length > 0 && (
                <div className="border-t border-border/40 pt-4">
                  <p className="text-xs font-medium text-green-400 mb-2">✓ ปัจจัยบวก (Bullish)</p>
                  <ul className="space-y-1">
                    {data.signal.factors.positive.map((factor, i) => (
                      <li key={i} className="text-xs text-green-400/80 flex items-start gap-2">
                        <span>+</span>
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Negative Factors */}
              {data.signal.factors.negative.length > 0 && (
                <div className="border-t border-border/40 pt-4">
                  <p className="text-xs font-medium text-red-400 mb-2">✗ ปัจจัยลบ (Bearish)</p>
                  <ul className="space-y-1">
                    {data.signal.factors.negative.map((factor, i) => (
                      <li key={i} className="text-xs text-red-400/80 flex items-start gap-2">
                        <span>-</span>
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Human-Readable Summary */}
              {data.signal.summary && (
                <div className="border-t border-border/40 pt-4">
                  <p className="text-xs font-medium text-primary mb-3">📖 คำอธิบายสำหรับผู้เริ่มต้น</p>
                  <div className="bg-card/50 rounded-lg p-4 border border-border/30">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                      {data.signal.summary}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
