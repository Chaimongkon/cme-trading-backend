export type AnalysisMode = "standard" | "enhanced" | "consensus";
export type ProviderType = "auto" | "openai" | "gemini" | "deepseek" | "deepseek-r1";

export interface AIAnalysisResult {
    recommendation: "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";
    confidence: number;
    entry_zone: {
        start: number;
        end: number;
        description: string;
    };
    stop_loss: number;
    take_profit_1: number;
    take_profit_2: number;
    take_profit_3?: number;
    risk_reward_ratio: number;
    summary: string;
    reasoning: string[];
    bullish_factors: string[];
    bearish_factors: string[];
    warnings: string[];
    suggested_timeframe: string;
    model: string;
    processing_time_ms: number;
}

export interface AIAnalysisResponse {
    success: boolean;
    analysis?: AIAnalysisResult;
    input_data?: Record<string, unknown>;
    processing_time_ms?: number;
    error?: string;
    suggestion?: string;
}
