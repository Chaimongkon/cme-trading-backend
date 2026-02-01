"use client";

import useSWR from "swr";
import { 
  getAnalysisKey, 
  realtimeSwrConfig,
  staticSwrConfig,
} from "@/lib/swr-config";

// ============================================
// Types
// ============================================

export interface AnalysisSignal {
  signal: "BUY" | "SELL" | "NEUTRAL";
  score: number;  // 0-100 confidence
  sentiment: "Bullish" | "Bearish" | "Sideway";
  reason: string;
  summary: string; // Human-readable explanation for beginners
  factors: {
    positive: string[];
    negative: string[];
  };
  key_levels: {
    max_pain: number;
    call_wall: number;
    put_wall: number;
    significant_strikes: number[];
  };
  factor_scores: {
    pcr_score: number;
    vwap_score: number;
    wall_score: number;
    max_pain_score: number;
    flow_score: number;
    volume_score: number;
  };
  volume_analysis?: {
    total_call_volume: number;
    total_put_volume: number;
    total_volume: number;
    volume_pcr: number;
    avg_volume_per_strike: number;
    atm_volume_concentration: number;
    signal: "BULLISH" | "BEARISH" | "NEUTRAL";
    confidence: number;
    description: string;
    volume_spikes: Array<{
      strike: number;
      total_volume: number;
      call_volume: number;
      put_volume: number;
      volume_ratio: number;
      is_call_dominant: boolean;
      near_price: boolean;
    }>;
  };
  breakdown: string[];
}

export interface AnalysisPCR {
  oi_pcr: number;
  volume_pcr: number;
  atm_pcr: number;
  signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  totals: {
    total_put_oi: number;
    total_call_oi: number;
    total_put_volume: number;
    total_call_volume: number;
  };
}

export interface AnalysisMaxPain {
  max_pain_strike: number;
  distance_from_price: number;
  distance_percent: number;
  signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  description: string;
}

export interface AnalysisWalls {
  support: { strike: number; put_oi: number; strength: number };
  resistance: { strike: number; call_oi: number; strength: number };
  support_levels: Array<{ strike: number; put_oi: number }>;
  resistance_levels: Array<{ strike: number; call_oi: number }>;
}

export interface AnalysisData {
  market: {
    current_price: number;
    vwap: number;
    strikes_count: number;
  };
  walls: AnalysisWalls;
  pcr: AnalysisPCR;
  max_pain: AnalysisMaxPain;
  signal: AnalysisSignal;
  summary: {
    bias: "BULLISH" | "BEARISH" | "NEUTRAL";
    action: "BUY" | "SELL" | "HOLD";
    score: number;
    confidence: number;
    key_levels: {
      primary_support: number;
      primary_resistance: number;
      max_pain: number;
    };
  };
}

export interface AnalysisResponse {
  success: boolean;
  data?: AnalysisData;
  analysis?: {
    marketData: {
      product: string;
      expiry: string;
      currentPrice: number;
      extractedAt: string;
      strikesCount: number;
    };
    signal: {
      type: string;
      strength: number;
      confidence: number;
      score: number;
      sentiment: "Bullish" | "Bearish" | "Sideway";
      reason: string;
      summary: string;
      factors: string[];
      positiveFactors: string[];
      negativeFactors: string[];
      factorScores: {
        pcr_score: number;
        vwap_score: number;
        wall_score: number;
        max_pain_score: number;
        flow_score: number;
        volume_score: number;
      };
      keyLevels: {
        max_pain: number;
        call_wall: number;
        put_wall: number;
        significant_strikes: number[];
      };
      volumeAnalysis?: {
        signal: "BULLISH" | "BEARISH" | "NEUTRAL";
        confidence: number;
        description: string;
      };
    };
    pcr: {
      oiPcr: number;
      volumePcr: number;
      atmPcr: number;
    };
    maxPain: {
      maxPainStrike: number;
      distancePercent: number;
    };
    keyLevels: {
      support: Array<{ strike: number; putOi: number }>;
      resistance: Array<{ strike: number; callOi: number }>;
    };
  };
  error?: string;
  generated_at?: string;
  generatedAt?: string;
}

// ============================================
// Hook: useAnalysis (from database)
// ============================================

/**
 * Hook to fetch latest analysis from database
 * Uses SWR for caching and revalidation
 * 
 * Optimizations:
 * - Dedupes requests within 30 seconds
 * - Keeps previous data while loading
 * - Configurable refresh interval
 * 
 * @param product - Optional product filter
 * @param refreshInterval - Auto-refresh interval in ms (default: 30s for realtime)
 */
export function useAnalysis(product?: string, refreshInterval = 30000) {
  const url = getAnalysisKey(product);
  
  const { data, error, isLoading, isValidating, mutate } = useSWR<AnalysisResponse>(
    url,
    {
      ...realtimeSwrConfig,
      refreshInterval,
    }
  );

  return {
    data: data?.analysis,
    isLoading,
    isValidating,
    isError: !!error,
    error: error?.message || data?.error,
    refresh: mutate,
    generatedAt: data?.generatedAt,
  };
}

// ============================================
// Hook: useAnalyzeData (direct POST)
// ============================================

interface AnalyzeInput {
  current_price: number;
  vwap?: number;
  strikes: Array<{
    strike_price: number;
    call_oi: number;
    put_oi: number;
    call_volume: number;
    put_volume: number;
    call_oi_change?: number;
    put_oi_change?: number;
  }>;
}

/**
 * Hook to analyze raw data via POST
 * 
 * @example
 * const { analyze, data, isLoading } = useAnalyzeData();
 * 
 * // Trigger analysis
 * await analyze({
 *   current_price: 2750.5,
 *   strikes: [...]
 * });
 */
export function useAnalyzeData() {
  const { data, error, isLoading, mutate } = useSWR<AnalysisResponse | null>(
    "analyze-result",
    null, // No automatic fetching
    staticSwrConfig // Use static config - no auto refresh for manual analysis
  );

  const analyze = async (input: AnalyzeInput): Promise<AnalysisResponse> => {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const result: AnalysisResponse = await response.json();
    
    // Update SWR cache
    mutate(result, false);
    
    return result;
  };

  return {
    analyze,
    data: data?.data,
    isLoading,
    isError: !!error,
    error: error?.message || data?.error,
  };
}

// ============================================
// Utility: Signal Color/Icon helpers
// ============================================

export function getSignalColor(signal: string): string {
  switch (signal) {
    case "BUY":
    case "STRONG_BUY":
    case "BULLISH":
      return "text-green-500";
    case "SELL":
    case "STRONG_SELL":
    case "BEARISH":
      return "text-red-500";
    default:
      return "text-gray-500";
  }
}

export function getSignalBgColor(signal: string): string {
  switch (signal) {
    case "BUY":
    case "STRONG_BUY":
    case "BULLISH":
      return "bg-green-500";
    case "SELL":
    case "STRONG_SELL":
    case "BEARISH":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
}

export function getSignalLabel(signal: string): string {
  switch (signal) {
    case "BUY":
      return "ซื้อ";
    case "STRONG_BUY":
      return "ซื้อแข็งแกร่ง";
    case "SELL":
      return "ขาย";
    case "STRONG_SELL":
      return "ขายแข็งแกร่ง";
    case "BULLISH":
      return "ขาขึ้น";
    case "BEARISH":
      return "ขาลง";
    default:
      return "ไซด์เวย์";
  }
}
