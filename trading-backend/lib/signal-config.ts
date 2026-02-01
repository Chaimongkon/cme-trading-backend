import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  LucideIcon,
} from "lucide-react";

// ============================================
// Signal Types
// ============================================

export type SignalType = "BUY" | "SELL" | "NEUTRAL" | "STRONG_BUY" | "STRONG_SELL";
export type SentimentType = "BULLISH" | "BEARISH" | "NEUTRAL";

// ============================================
// Signal Configuration
// ============================================

export interface SignalConfigItem {
  /** Thai label */
  label: string;
  /** English label */
  labelEn: string;
  /** Text color class */
  color: string;
  /** Background color class (solid) */
  bgColor: string;
  /** Light background color class */
  bgLight: string;
  /** Gradient class for hero sections */
  gradient: string;
  /** Border color class */
  borderColor: string;
  /** Ring color class */
  ringColor: string;
  /** Lucide icon component */
  icon: LucideIcon;
}

export const signalConfig: Record<SignalType, SignalConfigItem> = {
  STRONG_BUY: {
    label: "ซื้อแข็งแกร่ง",
    labelEn: "Strong Buy",
    color: "text-green-500",
    bgColor: "bg-green-500",
    bgLight: "bg-green-500/10",
    gradient: "from-green-500/20 via-green-500/5 to-transparent",
    borderColor: "border-green-500/50",
    ringColor: "ring-green-500",
    icon: TrendingUp,
  },
  BUY: {
    label: "ซื้อ",
    labelEn: "Buy",
    color: "text-green-400",
    bgColor: "bg-green-400",
    bgLight: "bg-green-400/10",
    gradient: "from-green-400/20 via-green-400/5 to-transparent",
    borderColor: "border-green-400/50",
    ringColor: "ring-green-400",
    icon: ArrowUpRight,
  },
  NEUTRAL: {
    label: "ไซด์เวย์",
    labelEn: "Neutral",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500",
    bgLight: "bg-yellow-500/10",
    gradient: "from-yellow-500/20 via-yellow-500/5 to-transparent",
    borderColor: "border-yellow-500/50",
    ringColor: "ring-yellow-500",
    icon: Minus,
  },
  SELL: {
    label: "ขาย",
    labelEn: "Sell",
    color: "text-red-400",
    bgColor: "bg-red-400",
    bgLight: "bg-red-400/10",
    gradient: "from-red-400/20 via-red-400/5 to-transparent",
    borderColor: "border-red-400/50",
    ringColor: "ring-red-400",
    icon: ArrowDownRight,
  },
  STRONG_SELL: {
    label: "ขายแข็งแกร่ง",
    labelEn: "Strong Sell",
    color: "text-red-500",
    bgColor: "bg-red-500",
    bgLight: "bg-red-500/10",
    gradient: "from-red-500/20 via-red-500/5 to-transparent",
    borderColor: "border-red-500/50",
    ringColor: "ring-red-500",
    icon: TrendingDown,
  },
};

// ============================================
// Sentiment Configuration
// ============================================

export interface SentimentConfigItem {
  label: string;
  labelEn: string;
  color: string;
  bgColor: string;
  bgLight: string;
}

export const sentimentConfig: Record<SentimentType, SentimentConfigItem> = {
  BULLISH: {
    label: "ขาขึ้น",
    labelEn: "Bullish",
    color: "text-green-500",
    bgColor: "bg-green-500",
    bgLight: "bg-green-500/10",
  },
  BEARISH: {
    label: "ขาลง",
    labelEn: "Bearish",
    color: "text-red-500",
    bgColor: "bg-red-500",
    bgLight: "bg-red-500/10",
  },
  NEUTRAL: {
    label: "ทรงตัว",
    labelEn: "Neutral",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500",
    bgLight: "bg-yellow-500/10",
  },
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get signal config by type, with fallback to NEUTRAL
 */
export function getSignalConfig(type: string): SignalConfigItem {
  return signalConfig[type as SignalType] || signalConfig.NEUTRAL;
}

/**
 * Get sentiment config by type, with fallback to NEUTRAL
 */
export function getSentimentConfig(type: string): SentimentConfigItem {
  return sentimentConfig[type as SentimentType] || sentimentConfig.NEUTRAL;
}

/**
 * Get PCR signal color
 */
export function getPcrColor(signal: string): string {
  if (signal === "BULLISH") return "text-green-400";
  if (signal === "BEARISH") return "text-red-400";
  return "text-gray-400";
}

/**
 * Get PCR signal background
 */
export function getPcrBgColor(signal: string): string {
  if (signal === "BULLISH") return "bg-green-500/20";
  if (signal === "BEARISH") return "bg-red-500/20";
  return "bg-gray-500/20";
}

/**
 * Translate signal type to Thai
 */
export function translateSignal(signal: string): string {
  const config = signalConfig[signal as SignalType] || sentimentConfig[signal as SentimentType];
  return config?.label || signal;
}

/**
 * Get signal strength as 1-5 from 0-100 score
 */
export function getSignalStrength(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 80) return 5;
  if (score >= 60) return 4;
  if (score >= 40) return 3;
  if (score >= 20) return 2;
  return 1;
}

/**
 * Get confidence level label
 */
export function getConfidenceLabel(score: number): string {
  if (score >= 80) return "สูงมาก";
  if (score >= 60) return "สูง";
  if (score >= 40) return "ปานกลาง";
  if (score >= 20) return "ต่ำ";
  return "ต่ำมาก";
}

/**
 * Get confidence color
 */
export function getConfidenceColor(score: number): string {
  if (score >= 70) return "text-green-500";
  if (score >= 50) return "text-yellow-500";
  return "text-red-500";
}
