/**
 * Price Feed Module
 * 
 * Fetches real-time XAU Spot price from Yahoo Finance
 * for spread calculation and level conversion
 */

// ============================================
// Types
// ============================================

export interface SpotPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  timestamp: Date;
  source: string;
}

export interface SpreadInfo {
  /** CME Futures price */
  futures_price: number;
  /** XAU Spot price */
  spot_price: number;
  /** Spread = Futures - Spot */
  spread: number;
  /** Spread as percentage */
  spread_percent: number;
  /** Last updated */
  updated_at: Date;
}

export interface ConvertedLevels {
  /** Original CME levels */
  cme: {
    put_wall: number;
    call_wall: number;
    max_pain: number;
    support_levels: number[];
    resistance_levels: number[];
  };
  /** Converted XAU levels */
  xau: {
    put_wall: number;
    call_wall: number;
    max_pain: number;
    support_levels: number[];
    resistance_levels: number[];
  };
  /** Spread used for conversion */
  spread: number;
  /** Current XAU spot price */
  xau_spot: number;
}

// ============================================
// Yahoo Finance API (No API Key Required!)
// ============================================

// ============================================
// Multiple Price Sources for Reliability
// ============================================

/**
 * Primary: Fetch from OANDA API (FREE Practice Account)
 * Register at: https://www.oanda.com/demo-account/
 * Get API key from: https://www.oanda.com/demo-account/tpa/personal_token
 */
async function fetchFromOanda(): Promise<SpotPrice> {
  const apiKey = process.env.OANDA_API_KEY;
  const accountId = process.env.OANDA_ACCOUNT_ID;

  if (!apiKey || !accountId) {
    throw new Error("OANDA API key or Account ID not configured");
  }

  // Use practice API (free) or live API
  const baseUrl = process.env.OANDA_LIVE === "true"
    ? "https://api-fxtrade.oanda.com"
    : "https://api-fxpractice.oanda.com";

  const url = `${baseUrl}/v3/accounts/${accountId}/pricing?instruments=XAU_USD`;

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OANDA API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.prices || data.prices.length === 0) {
    throw new Error("No XAU/USD price from OANDA");
  }

  const priceData = data.prices[0];
  // Calculate mid price from bid/ask
  const bid = parseFloat(priceData.bids?.[0]?.price || 0);
  const ask = parseFloat(priceData.asks?.[0]?.price || 0);
  const midPrice = (bid + ask) / 2;

  if (midPrice <= 0) {
    throw new Error("Invalid OANDA price data");
  }

  return {
    symbol: "XAU/USD",
    price: Math.round(midPrice * 100) / 100,
    change: 0,
    changePercent: 0,
    previousClose: midPrice,
    timestamp: new Date(priceData.time),
    source: "OANDA",
  };
}

/**
 * Secondary: Fetch from Metals.live API (FREE, no key, real-time!)
 * https://metals.live - Provides real-time spot prices
 */
async function fetchFromMetalsLive(): Promise<SpotPrice> {
  const url = "https://api.metals.live/v1/spot";

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Metals.live API error: ${response.status}`);
  }

  const data = await response.json();

  // Find gold in the response array
  const gold = data.find((m: { metal: string }) => m.metal === "gold");

  if (!gold || !gold.price) {
    throw new Error("Gold price not found in Metals.live response");
  }

  return {
    symbol: "XAU/USD",
    price: Math.round(gold.price * 100) / 100,
    change: 0,
    changePercent: 0,
    previousClose: gold.price,
    timestamp: new Date(),
    source: "Metals.live",
  };
}

/**
 * Secondary: Fetch from Twelve Data (FREE tier: 800 calls/day)
 */
async function fetchFromTwelveData(): Promise<SpotPrice> {
  const apiKey = process.env.TWELVEDATA_API_KEY;

  if (!apiKey) {
    throw new Error("Twelve Data API key not configured");
  }

  const url = `https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${apiKey}`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Twelve Data API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.code || !data.price) {
    throw new Error(data.message || "Invalid Twelve Data response");
  }

  const price = parseFloat(data.price);

  return {
    symbol: "XAU/USD",
    price: Math.round(price * 100) / 100,
    change: 0,
    changePercent: 0,
    previousClose: price,
    timestamp: new Date(),
    source: "Twelve Data",
  };
}

/**
 * Tertiary: Fetch from Yahoo Finance GC=F (Gold Futures)
 * Note: This is futures price, may differ from spot by ~10-20 points
 */
async function fetchFromYahooFinance(): Promise<SpotPrice> {
  const symbol = "GC=F";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance API error: ${response.status}`);
  }

  const data = await response.json();

  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error("Invalid Yahoo Finance response");
  }

  const meta = result.meta;
  const price = meta.regularMarketPrice;
  const previousClose = meta.previousClose || meta.chartPreviousClose || price;
  const change = price - previousClose;
  const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

  return {
    symbol: "XAU/USD",
    price: Math.round(price * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    previousClose: Math.round(previousClose * 100) / 100,
    timestamp: new Date(),
    source: "Yahoo Finance (Futures)",
  };
}

/**
 * Secondary: Fetch from Open Exchange Rates (limited free tier)
 */
async function fetchFromOpenExchange(): Promise<SpotPrice> {
  const appId = process.env.OPENEXCHANGE_APP_ID;
  
  if (!appId) {
    throw new Error("OpenExchange APP_ID not configured");
  }
  
  const url = `https://openexchangerates.org/api/latest.json?app_id=${appId}&symbols=XAU`;
  
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`OpenExchange API error: ${response.status}`);
  }

  const data = await response.json();
  
  // XAU is in oz per USD, so we need 1/rate
  if (!data.rates?.XAU) {
    throw new Error("Invalid OpenExchange response");
  }

  const price = 1 / data.rates.XAU;
  
  return {
    symbol: "XAU/USD",
    price: Math.round(price * 100) / 100,
    change: 0,
    changePercent: 0,
    previousClose: price,
    timestamp: new Date(),
    source: "Open Exchange Rates",
  };
}

/**
 * Tertiary: Fetch from GoldAPI.io (Free tier: 300 requests/month)
 * Register at: https://www.goldapi.io/
 */
async function fetchFromGoldApi(): Promise<SpotPrice> {
  const apiKey = process.env.GOLDAPI_KEY;
  
  if (!apiKey) {
    throw new Error("GoldAPI key not configured");
  }
  
  const url = "https://www.goldapi.io/api/XAU/USD";
  
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "x-access-token": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`GoldAPI error: ${response.status}`);
  }

  const data = await response.json();
  
  return {
    symbol: "XAU/USD",
    price: data.price || 0,
    change: data.ch || 0,
    changePercent: data.chp || 0,
    previousClose: data.prev_close_price || data.price,
    timestamp: new Date(data.timestamp * 1000),
    source: "GoldAPI.io",
  };
}

/**
 * Quaternary: Fetch from Metals.dev (Free tier available)
 * https://metals.dev/
 */
async function fetchFromMetalsDev(): Promise<SpotPrice> {
  const apiKey = process.env.METALSDEV_API_KEY;
  
  if (!apiKey) {
    throw new Error("Metals.dev API key not configured");
  }
  
  const url = `https://api.metals.dev/v1/latest?api_key=${apiKey}&currency=USD&unit=oz`;
  
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Metals.dev API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.metals?.gold) {
    throw new Error("Invalid Metals.dev response");
  }

  return {
    symbol: "XAU/USD",
    price: Math.round(data.metals.gold * 100) / 100,
    change: 0,
    changePercent: 0,
    previousClose: data.metals.gold,
    timestamp: new Date(),
    source: "Metals.dev",
  };
}

/**
 * Calculate XAU price from CME Futures with estimated spread
 * This is a fallback when no live API works
 */
async function calculateFromCmeFutures(): Promise<SpotPrice> {
  try {
    // Import prisma dynamically to avoid circular deps
    const { default: prisma } = await import("@/lib/db");
    
    const oiSnapshot = await prisma.oiSnapshot.findFirst({
      orderBy: { extractedAt: "desc" },
      select: { futurePrice: true, extractedAt: true },
    });

    if (!oiSnapshot?.futurePrice) {
      throw new Error("No CME futures data available");
    }

    // Typical CME-XAU spread is 10-20 points
    // Use 15 as average estimate
    const estimatedSpread = 15;
    const estimatedXauPrice = oiSnapshot.futurePrice - estimatedSpread;

    return {
      symbol: "XAU/USD",
      price: Math.round(estimatedXauPrice * 100) / 100,
      change: 0,
      changePercent: 0,
      previousClose: estimatedXauPrice,
      timestamp: new Date(),
      source: `CME Futures (est. spread: -${estimatedSpread})`,
    };
  } catch (error) {
    // Re-throw with more context
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`CME Estimate failed: ${msg}`);
  }
}

/**
 * Last resort: Return null/placeholder
 * Used when market is closed and no data available
 */
function getMarketClosedPlaceholder(): SpotPrice {
  return {
    symbol: "XAU/USD",
    price: 0,
    change: 0,
    changePercent: 0,
    previousClose: 0,
    timestamp: new Date(),
    source: "Market Closed - กรุณากรอกราคาเอง",
  };
}

/**
 * Main function: Try multiple sources with fallback
 * Returns a placeholder if all sources fail (e.g., market closed)
 */
export async function fetchXauSpotPrice(): Promise<SpotPrice> {
  const sources = [
    { name: "OANDA", fn: fetchFromOanda },
    { name: "Metals.live", fn: fetchFromMetalsLive },
    { name: "Twelve Data", fn: fetchFromTwelveData },
    { name: "GoldAPI", fn: fetchFromGoldApi },
    { name: "Yahoo Finance", fn: fetchFromYahooFinance },
    { name: "Metals.dev", fn: fetchFromMetalsDev },
    { name: "OpenExchange", fn: fetchFromOpenExchange },
    { name: "CME Estimate", fn: calculateFromCmeFutures },
  ];

  const errors: string[] = [];

  for (const source of sources) {
    try {
      console.log(`[XAU] Trying ${source.name}...`);
      const result = await source.fn();
      console.log(`[XAU] ${source.name} succeeded: $${result.price}`);
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${source.name}: ${msg}`);
      console.warn(`[XAU] ${source.name} failed:`, msg);
    }
  }

  // Instead of throwing, return a placeholder for manual input
  console.warn(`[XAU] All sources failed. Returning placeholder for manual input.`);
  console.warn(`[XAU] Errors: ${errors.join("; ")}`);
  
  return getMarketClosedPlaceholder();
}

/**
 * Alias for backward compatibility
 */
export const fetchXauSpotPriceV7 = fetchXauSpotPrice;

// ============================================
// Spread Calculation
// ============================================

/**
 * Calculate spread between CME Futures and XAU Spot
 */
export function calculateSpread(
  futuresPrice: number,
  spotPrice: number
): SpreadInfo {
  const spread = futuresPrice - spotPrice;
  const spreadPercent = spotPrice > 0 ? (spread / spotPrice) * 100 : 0;

  return {
    futures_price: Math.round(futuresPrice * 100) / 100,
    spot_price: Math.round(spotPrice * 100) / 100,
    spread: Math.round(spread * 100) / 100,
    spread_percent: Math.round(spreadPercent * 1000) / 1000,
    updated_at: new Date(),
  };
}

// ============================================
// Level Conversion
// ============================================

/**
 * Convert CME levels to XAU levels by subtracting spread
 */
export function convertLevelsToXau(
  cmeLevels: {
    put_wall: number;
    call_wall: number;
    max_pain: number;
    support_levels?: number[];
    resistance_levels?: number[];
  },
  spread: number,
  xauSpot: number
): ConvertedLevels {
  const convertPrice = (cmePrice: number) => 
    Math.round((cmePrice - spread) * 100) / 100;

  return {
    cme: {
      put_wall: cmeLevels.put_wall,
      call_wall: cmeLevels.call_wall,
      max_pain: cmeLevels.max_pain,
      support_levels: cmeLevels.support_levels || [],
      resistance_levels: cmeLevels.resistance_levels || [],
    },
    xau: {
      put_wall: convertPrice(cmeLevels.put_wall),
      call_wall: convertPrice(cmeLevels.call_wall),
      max_pain: convertPrice(cmeLevels.max_pain),
      support_levels: (cmeLevels.support_levels || []).map(convertPrice),
      resistance_levels: (cmeLevels.resistance_levels || []).map(convertPrice),
    },
    spread,
    xau_spot: xauSpot,
  };
}

/**
 * Get trading zones for XAU based on converted levels
 */
export function getTradingZones(
  convertedLevels: ConvertedLevels,
  currentXauPrice: number
): {
  buy_zone: { start: number; end: number; description: string };
  sell_zone: { start: number; end: number; description: string };
  current_position: "BUY_ZONE" | "SELL_ZONE" | "NEUTRAL_ZONE";
  distance_to_support: number;
  distance_to_resistance: number;
} {
  const xau = convertedLevels.xau;
  
  // Buy zone: near put wall (support)
  const buyZoneStart = xau.put_wall - 5; // 5 points below
  const buyZoneEnd = xau.put_wall + 10;   // 10 points above
  
  // Sell zone: near call wall (resistance)
  const sellZoneStart = xau.call_wall - 10; // 10 points below
  const sellZoneEnd = xau.call_wall + 5;    // 5 points above
  
  // Determine current position
  let currentPosition: "BUY_ZONE" | "SELL_ZONE" | "NEUTRAL_ZONE";
  
  if (currentXauPrice >= buyZoneStart && currentXauPrice <= buyZoneEnd) {
    currentPosition = "BUY_ZONE";
  } else if (currentXauPrice >= sellZoneStart && currentXauPrice <= sellZoneEnd) {
    currentPosition = "SELL_ZONE";
  } else {
    currentPosition = "NEUTRAL_ZONE";
  }
  
  return {
    buy_zone: {
      start: buyZoneStart,
      end: buyZoneEnd,
      description: `Buy Zone: ${buyZoneStart.toFixed(2)} - ${buyZoneEnd.toFixed(2)} (ใกล้แนวรับ ${xau.put_wall})`,
    },
    sell_zone: {
      start: sellZoneStart,
      end: sellZoneEnd,
      description: `Sell Zone: ${sellZoneStart.toFixed(2)} - ${sellZoneEnd.toFixed(2)} (ใกล้แนวต้าน ${xau.call_wall})`,
    },
    current_position: currentPosition,
    distance_to_support: Math.round((currentXauPrice - xau.put_wall) * 100) / 100,
    distance_to_resistance: Math.round((xau.call_wall - currentXauPrice) * 100) / 100,
  };
}

// ============================================
// Formatting Helpers
// ============================================

/**
 * Format price for display
 */
export function formatPrice(price: number, decimals = 2): string {
  return price.toFixed(decimals);
}

/**
 * Format spread for display
 */
export function formatSpread(spread: SpreadInfo): string {
  const sign = spread.spread >= 0 ? "+" : "";
  return `${sign}${spread.spread.toFixed(2)} (${sign}${spread.spread_percent.toFixed(3)}%)`;
}

/**
 * Get spread status description
 */
export function getSpreadStatus(spread: number): {
  status: "NORMAL" | "HIGH" | "LOW";
  description: string;
} {
  // Normal futures premium for gold is typically 10-20 points
  if (spread >= 10 && spread <= 25) {
    return {
      status: "NORMAL",
      description: `Spread ปกติ (${spread.toFixed(2)} points)`,
    };
  } else if (spread > 25) {
    return {
      status: "HIGH",
      description: `Spread สูงผิดปกติ (${spread.toFixed(2)} points) - อาจมี Contango`,
    };
  } else if (spread < 10) {
    return {
      status: "LOW",
      description: `Spread ต่ำ (${spread.toFixed(2)} points) - Futures ใกล้ Spot`,
    };
  }
  
  return {
    status: "NORMAL",
    description: `Spread: ${spread.toFixed(2)} points`,
  };
}
