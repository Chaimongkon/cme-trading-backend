"use client";

import useSWR from "swr";
import { realtimeSwrConfig } from "@/lib/swr-config";

// ============================================
// Types
// ============================================

export interface XauSpotData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  timestamp: string;
  source: string;
}

export interface SpreadData {
  futures_price: number;
  spot_price: number;
  spread: number;
  spread_percent: number;
  status: {
    status: "NORMAL" | "HIGH" | "LOW";
    description: string;
  };
  updated_at: string;
}

export interface LevelData {
  cme: {
    put_wall: number;
    call_wall: number;
    max_pain: number;
    support_levels: number[];
    resistance_levels: number[];
  };
  xau: {
    put_wall: number;
    call_wall: number;
    max_pain: number;
    support_levels: number[];
    resistance_levels: number[];
  };
  spread: number;
  xau_spot: number;
}

export interface TradingZones {
  buy_zone: {
    start: number;
    end: number;
    description: string;
  };
  sell_zone: {
    start: number;
    end: number;
    description: string;
  };
  current_position: "BUY_ZONE" | "SELL_ZONE" | "NEUTRAL_ZONE";
  distance_to_support: number;
  distance_to_resistance: number;
}

export interface XauResponse {
  success: boolean;
  xau: XauSpotData;
  spread: SpreadData | null;
  levels: LevelData | null;
  trading_zones: TradingZones | null;
  generated_at: string;
  error?: string;
}

// ============================================
// Hook: useXauPrice
// ============================================

/**
 * Hook to fetch XAU spot price and converted levels
 * 
 * @param refreshInterval - Auto-refresh interval in ms (default: 30s)
 * @param includeLevels - Whether to include CME→XAU level conversion
 */
export function useXauPrice(refreshInterval = 30000, includeLevels = true) {
  const url = `/api/xau${includeLevels ? "" : "?levels=false"}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<XauResponse>(
    url,
    {
      ...realtimeSwrConfig,
      refreshInterval,
    }
  );

  return {
    // XAU Spot data
    xau: data?.xau || null,
    xauPrice: data?.xau?.price || null,
    xauChange: data?.xau?.change || null,
    xauChangePercent: data?.xau?.changePercent || null,
    
    // Spread data
    spread: data?.spread || null,
    spreadValue: data?.spread?.spread || null,
    futuresPrice: data?.spread?.futures_price || null,
    
    // Converted levels
    levels: data?.levels || null,
    cmeLevels: data?.levels?.cme || null,
    xauLevels: data?.levels?.xau || null,
    
    // Trading zones
    tradingZones: data?.trading_zones || null,
    currentPosition: data?.trading_zones?.current_position || null,
    
    // Loading states
    isLoading,
    isValidating,
    isError: !!error || (data && !data.success),
    error: error?.message || data?.error,
    
    // Utilities
    refresh: mutate,
    generatedAt: data?.generated_at,
  };
}

// ============================================
// Hook: useManualXauInput
// ============================================

/**
 * Hook for manual XAU price input
 * Use when Yahoo Finance is not available
 */
export function useManualXauInput() {
  const submitXauPrice = async (xauPrice: number, cmePrice?: number) => {
    const response = await fetch("/api/xau", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        xau_price: xauPrice,
        cme_price: cmePrice,
      }),
    });

    const result: XauResponse = await response.json();
    return result;
  };

  return { submitXauPrice };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Format price change with color indicator
 */
export function formatPriceChange(change: number, percent: number): {
  text: string;
  color: "green" | "red" | "gray";
  icon: "↑" | "↓" | "→";
} {
  if (change > 0) {
    return {
      text: `+${change.toFixed(2)} (+${percent.toFixed(2)}%)`,
      color: "green",
      icon: "↑",
    };
  } else if (change < 0) {
    return {
      text: `${change.toFixed(2)} (${percent.toFixed(2)}%)`,
      color: "red",
      icon: "↓",
    };
  }
  return {
    text: `${change.toFixed(2)} (${percent.toFixed(2)}%)`,
    color: "gray",
    icon: "→",
  };
}

/**
 * Get position color
 */
export function getPositionColor(position: string): string {
  switch (position) {
    case "BUY_ZONE":
      return "text-green-500";
    case "SELL_ZONE":
      return "text-red-500";
    default:
      return "text-yellow-500";
  }
}

/**
 * Get position label in Thai
 */
export function getPositionLabel(position: string): string {
  switch (position) {
    case "BUY_ZONE":
      return "📗 อยู่ใน Buy Zone";
    case "SELL_ZONE":
      return "📕 อยู่ใน Sell Zone";
    default:
      return "📒 อยู่ในโซนกลาง";
  }
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format levels for MT4/MT5 copy
 */
export function formatLevelsForCopy(levels: LevelData): string {
  const lines = [
    "=== XAU Trading Levels ===",
    "",
    `📗 Buy Zone (Support): ${levels.xau.put_wall.toFixed(2)}`,
    `📕 Sell Zone (Resistance): ${levels.xau.call_wall.toFixed(2)}`,
    `🎯 Max Pain: ${levels.xau.max_pain.toFixed(2)}`,
    "",
    "Support Levels:",
    ...levels.xau.support_levels.map((l, i) => `  S${i + 1}: ${l.toFixed(2)}`),
    "",
    "Resistance Levels:",
    ...levels.xau.resistance_levels.map((l, i) => `  R${i + 1}: ${l.toFixed(2)}`),
    "",
    `Spread: ${levels.spread.toFixed(2)} (CME - XAU)`,
    `Generated: ${new Date().toLocaleString("th-TH")}`,
  ];

  return lines.join("\n");
}
