import { SWRConfiguration } from "swr";

/**
 * Global SWR Configuration
 * 
 * Optimized settings for Gold Options Analytics Dashboard
 */

// ============================================
// Default Fetcher
// ============================================

export const defaultFetcher = async (url: string) => {
  const res = await fetch(url);
  
  if (!res.ok) {
    const error = new Error("An error occurred while fetching the data.");
    throw error;
  }
  
  return res.json();
};

// ============================================
// SWR Configuration Presets
// ============================================

/**
 * Default SWR config for most API calls
 * - Dedupes requests within 30 seconds
 * - Doesn't revalidate on focus (reduces unnecessary API calls)
 * - Retries 3 times on error
 */
export const defaultSwrConfig: SWRConfiguration = {
  fetcher: defaultFetcher,
  
  // Revalidation settings
  revalidateOnFocus: false,        // Don't refetch when tab gains focus
  revalidateOnReconnect: true,     // Refetch when network reconnects
  revalidateIfStale: true,         // Use stale data while revalidating
  
  // Deduplication
  dedupingInterval: 30000,         // 30 seconds - prevent duplicate requests
  
  // Error handling
  errorRetryCount: 3,              // Retry 3 times on error
  errorRetryInterval: 5000,        // Wait 5 seconds between retries
  
  // Loading behavior
  keepPreviousData: true,          // Keep showing old data while loading new
  
  // Performance
  focusThrottleInterval: 5000,     // Throttle focus events to 5 seconds
  loadingTimeout: 3000,            // Show loading after 3 seconds if slow
};

/**
 * Real-time SWR config for live data (signals, current prices)
 * - Short refresh interval
 * - Revalidates on focus
 */
export const realtimeSwrConfig: SWRConfiguration = {
  ...defaultSwrConfig,
  refreshInterval: 30000,          // Refresh every 30 seconds
  revalidateOnFocus: true,         // Refetch when tab gains focus
  dedupingInterval: 10000,         // Shorter deduping for real-time data
};

/**
 * Static SWR config for rarely changing data (settings, history)
 * - Long refresh interval
 * - Never revalidates on focus
 */
export const staticSwrConfig: SWRConfiguration = {
  ...defaultSwrConfig,
  refreshInterval: 0,              // No auto-refresh
  revalidateOnFocus: false,        // Never refetch on focus
  dedupingInterval: 60000,         // 1 minute deduping
  errorRetryCount: 2,              // Fewer retries for static data
};

/**
 * Polling SWR config for background updates
 * - Regular polling interval
 * - Silent errors (doesn't show error state immediately)
 */
export const pollingSwrConfig: SWRConfiguration = {
  ...defaultSwrConfig,
  refreshInterval: 60000,          // Poll every minute
  revalidateOnFocus: false,
  errorRetryCount: 5,              // More retries for background polling
  errorRetryInterval: 10000,       // Longer wait between retries
};

// ============================================
// SWR Key Generators
// ============================================

/**
 * Generate SWR key for analysis API
 */
export function getAnalysisKey(product?: string): string {
  return product 
    ? `/api/analysis?product=${encodeURIComponent(product)}` 
    : "/api/analysis";
}

/**
 * Generate SWR key for data API
 */
export function getDataKey(type: string, limit?: number, offset?: number): string {
  const params = new URLSearchParams({ type });
  if (limit) params.set("limit", limit.toString());
  if (offset) params.set("offset", offset.toString());
  return `/api/data?${params.toString()}`;
}

/**
 * Generate SWR key for signals API
 */
export function getSignalsKey(
  limit?: number, 
  offset?: number, 
  filter?: string | null
): string {
  const params = new URLSearchParams();
  if (limit) params.set("limit", limit.toString());
  if (offset) params.set("offset", offset.toString());
  if (filter) params.set("type", filter);
  return `/api/signals?${params.toString()}`;
}

// ============================================
// Custom Hooks Config
// ============================================

/**
 * Get SWR config based on data type
 */
export function getSwrConfig(
  type: "realtime" | "static" | "polling" | "default" = "default",
  customConfig?: Partial<SWRConfiguration>
): SWRConfiguration {
  const baseConfig = {
    realtime: realtimeSwrConfig,
    static: staticSwrConfig,
    polling: pollingSwrConfig,
    default: defaultSwrConfig,
  }[type];

  return {
    ...baseConfig,
    ...customConfig,
  };
}
