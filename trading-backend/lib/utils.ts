import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get relative time string in Thai
 * @example "5 นาทีที่แล้ว", "2 ชั่วโมงที่แล้ว"
 */
export function getRelativeTime(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "เมื่อสักครู่";
  if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
  return formatDateTime(date);
}

export function getSignalColor(type: string): string {
  switch (type) {
    case "BUY":
      return "text-green-500";
    case "SELL":
      return "text-red-500";
    default:
      return "text-gray-400";
  }
}

export function getSignalBgColor(type: string): string {
  switch (type) {
    case "BUY":
      return "bg-green-500/10 border-green-500/30";
    case "SELL":
      return "bg-red-500/10 border-red-500/30";
    default:
      return "bg-gray-500/10 border-gray-500/30";
  }
}

export function parseProductInfo(title: string): { product: string; expiry: string } {
  // Handle CME QuikStrike format: "OG4F6 Open Interest" or "OG4F6 Intraday Volume"
  const cmeMatch = title.match(/^([A-Z]{2}\d[A-Z]\d)\s+(Open Interest|Intraday Volume|OI Change)/i);
  if (cmeMatch) {
    // Extract product code (e.g., OG4F6 -> OG = Gold Options, 4F6 = Feb 2024)
    const code = cmeMatch[1];
    const product = code.substring(0, 2); // OG, GC, etc.
    const expiry = code.substring(2); // 4F6 (year + month code + contract #)
    return { product, expiry: code }; // Use full code as expiry for uniqueness
  }

  // Parse titles like "Gold Dec 2024 (OG Z4)" or "Gold Options Dec 2024"
  const match = title.match(/(\w+)\s+(?:Options\s+)?(\w+\s+\d{4})/i);
  if (match) {
    return {
      product: match[1],
      expiry: match[2],
    };
  }

  // Fallback: use title as product if nothing matches
  return { product: title.split(" ")[0] || "Unknown", expiry: "Unknown" };
}
