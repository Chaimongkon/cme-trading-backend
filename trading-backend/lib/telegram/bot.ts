import prisma from "@/lib/db";
import type { TradingSignal } from "@/lib/analysis";

const TELEGRAM_API = "https://api.telegram.org/bot";

export interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  disable_web_page_preview?: boolean;
}

// Legacy Signal interface (for backward compatibility)
export interface LegacySignal {
  type: "BUY" | "SELL" | "NEUTRAL";
  strength: number;
  reason: string;
  factors: {
    pcr: { value: number; signal: string };
    atmPcr: { value: number; signal: string };
    maxPain: { value: number; priceDistance: number; signal: string };
    oiTrend: { putChange: number; callChange: number; signal: string };
    atmOiBuildup: { signal: string };
    keyLevels: { support: number[]; resistance: number[] };
  };
}

/**
 * Send a message via Telegram Bot API
 */
export async function sendTelegramMessage(
  botToken: string,
  message: TelegramMessage
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...message,
        disable_web_page_preview: true,
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      return { ok: false, error: result.description || "Unknown error" };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to send message",
    };
  }
}

/**
 * Format signal message for Telegram (NEW format with TradingSignal)
 */
export function formatSignalMessage(
  signal: TradingSignal,
  product: string,
  currentPrice: number
): string {
  const emoji =
    signal.signal === "BUY" ? "🟢" : signal.signal === "SELL" ? "🔴" : "⚪";
  
  // Calculate strength from score (0-100 -> 1-5)
  const strength = Math.ceil(signal.score / 20);
  const stars = "⭐".repeat(Math.max(1, strength));

  // Get sentiment emoji
  const sentimentEmoji = 
    signal.sentiment === "Bullish" ? "📈" : 
    signal.sentiment === "Bearish" ? "📉" : "➡️";

  // Format confidence
  const confidenceBar = getConfidenceBar(signal.score);

  // Format key levels
  const keyLevels = signal.key_levels;
  
  // Get factor scores for emoji display
  const fs = signal.factor_scores;
  const pcrEmoji = fs.pcr_score > 0 ? "🟢" : fs.pcr_score < 0 ? "🔴" : "⚪";
  const vwapEmoji = fs.vwap_score > 0 ? "🟢" : fs.vwap_score < 0 ? "🔴" : "⚪";
  const flowEmoji = fs.flow_score > 0 ? "🟢" : fs.flow_score < 0 ? "🔴" : "⚪";
  const wallEmoji = fs.wall_score > 0 ? "🟢" : fs.wall_score < 0 ? "🔴" : "⚪";
  const maxPainEmoji = fs.max_pain_score > 0 ? "🟢" : fs.max_pain_score < 0 ? "🔴" : "⚪";
  const volumeEmoji = fs.volume_score > 0 ? "🟢" : fs.volume_score < 0 ? "🔴" : "⚪";

  // Volume confirmation status
  const volumeStatus = fs.volume_score > 0 
    ? "✅ Volume ยืนยัน" 
    : fs.volume_score < 0 
    ? "⚠️ Volume ขัดแย้ง" 
    : "➖ Volume ไม่ชัดเจน";

  return `
${emoji} <b>${product} สัญญาณ: ${signal.signal}</b>
${sentimentEmoji} Sentiment: ${signal.sentiment}
ความแรง: ${stars} (${strength}/5)

📊 <b>คะแนนความเชื่อมั่น:</b> ${signal.score}/100
${confidenceBar}

💰 <b>ราคาปัจจุบัน:</b> ${currentPrice.toFixed(2)}

📈 <b>Factor Scores:</b>
${pcrEmoji} PCR: ${fs.pcr_score > 0 ? "+" : ""}${fs.pcr_score}
${vwapEmoji} VWAP: ${fs.vwap_score > 0 ? "+" : ""}${fs.vwap_score}
${flowEmoji} OI Flow: ${fs.flow_score > 0 ? "+" : ""}${fs.flow_score}
${wallEmoji} Wall: ${fs.wall_score > 0 ? "+" : ""}${fs.wall_score}
${maxPainEmoji} Max Pain: ${fs.max_pain_score > 0 ? "+" : ""}${fs.max_pain_score}
${volumeEmoji} Volume: ${fs.volume_score > 0 ? "+" : ""}${fs.volume_score}

📍 <b>ระดับสำคัญ:</b>
🟢 แนวรับ (Put Wall): ${keyLevels.put_wall}
🔴 แนวต้าน (Call Wall): ${keyLevels.call_wall}
🎯 Max Pain: ${keyLevels.max_pain}

🔊 <b>Volume:</b> ${volumeStatus}

💡 <b>เหตุผล:</b>
${signal.reason}

⏰ ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
  `.trim();
}

/**
 * Get visual confidence bar
 */
function getConfidenceBar(score: number): string {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  
  if (score >= 60) {
    return "🟩".repeat(filled) + "⬜".repeat(empty);
  } else if (score <= 40) {
    return "🟥".repeat(filled) + "⬜".repeat(empty);
  } else {
    return "🟨".repeat(filled) + "⬜".repeat(empty);
  }
}

/**
 * Send signal notification to Telegram
 */
export async function sendSignalNotification(
  signal: TradingSignal,
  product: string,
  currentPrice: number
): Promise<{ sent: boolean; error?: string }> {
  try {
    const settings = await prisma.settings.findFirst({
      where: { id: "default" },
    });

    if (!settings?.telegramBotToken || !settings?.telegramChatId) {
      return { sent: false, error: "ยังไม่ได้ตั้งค่า Telegram" };
    }

    // Calculate strength from score (0-100 -> 1-5)
    const strength = Math.ceil(signal.score / 20);

    // Check if signal strength meets threshold
    if (strength < settings.signalThreshold) {
      return {
        sent: false,
        error: `ความแรงสัญญาณ (${strength}) ต่ำกว่าเกณฑ์ (${settings.signalThreshold})`,
      };
    }

    const message = formatSignalMessage(signal, product, currentPrice);

    const result = await sendTelegramMessage(settings.telegramBotToken, {
      chat_id: settings.telegramChatId,
      text: message,
      parse_mode: "HTML",
    });

    return { sent: result.ok, error: result.error };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send test notification
 */
export async function sendTestNotification(
  botToken: string,
  chatId: string
): Promise<{ ok: boolean; error?: string }> {
  const testMessage = `
🔔 <b>XAU Trading Bot - ข้อความทดสอบ</b>

นี่คือข้อความทดสอบเพื่อยืนยันว่าการเชื่อมต่อ Telegram ทำงานถูกต้อง

✅ Bot Token: ถูกต้อง
✅ Chat ID: ถูกต้อง
✅ การเชื่อมต่อ: สำเร็จ

⏰ ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
  `.trim();

  return sendTelegramMessage(botToken, {
    chat_id: chatId,
    text: testMessage,
    parse_mode: "HTML",
  });
}

/**
 * Send price alert notification
 */
export async function sendPriceAlert(
  product: string,
  currentPrice: number,
  alertType: "SUPPORT" | "RESISTANCE",
  level: number
): Promise<{ sent: boolean; error?: string }> {
  try {
    const settings = await prisma.settings.findFirst({
      where: { id: "default" },
    });

    if (!settings?.telegramBotToken || !settings?.telegramChatId) {
      return { sent: false, error: "ยังไม่ได้ตั้งค่า Telegram" };
    }

    const emoji = alertType === "SUPPORT" ? "🟢" : "🔴";
    const direction = alertType === "SUPPORT" ? "ใกล้แนวรับ" : "ใกล้แนวต้าน";

    const message = `
${emoji} <b>${product} แจ้งเตือนราคา</b>

ราคา${direction}!

💰 ราคาปัจจุบัน: ${currentPrice.toFixed(2)}
📍 ระดับ: ${level.toFixed(0)}

⏰ ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
    `.trim();

    const result = await sendTelegramMessage(settings.telegramBotToken, {
      chat_id: settings.telegramChatId,
      text: message,
      parse_mode: "HTML",
    });

    return { sent: result.ok, error: result.error };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
