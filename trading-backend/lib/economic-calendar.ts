/**
 * Economic Calendar Module
 * 
 * Fetches and provides economic events that affect gold prices
 * Fed meetings, NFP, CPI, GDP, etc.
 */

// ============================================
// Types
// ============================================

export interface EconomicEvent {
  id: string;
  title: string;
  titleTh: string;
  date: Date;
  time: string; // HH:MM format in ET/NY time
  impact: "HIGH" | "MEDIUM" | "LOW";
  currency: string;
  forecast?: string;
  previous?: string;
  actual?: string;
  description: string;
  goldImpact: string; // How it affects gold
}

export interface UpcomingEvents {
  today: EconomicEvent[];
  thisWeek: EconomicEvent[];
  highImpactCount: number;
  warnings: string[];
  tradingCaution: "HIGH" | "MEDIUM" | "LOW" | "NONE";
}

// ============================================
// Gold-Related Economic Events Database
// ============================================

const GOLD_IMPORTANT_EVENTS: Record<string, { titleTh: string; goldImpact: string; impact: "HIGH" | "MEDIUM" | "LOW" }> = {
  // Fed Events - Highest impact on gold
  "FOMC Meeting": {
    titleTh: "ประชุม FOMC",
    goldImpact: "มีผลกระทบสูงมาก - ดอกเบี้ยขึ้น = Gold ลง, ดอกเบี้ยลง = Gold ขึ้น",
    impact: "HIGH",
  },
  "Fed Interest Rate Decision": {
    titleTh: "ประกาศดอกเบี้ย Fed",
    goldImpact: "มีผลกระทบสูงมาก - ดอกเบี้ยขึ้น = Gold ลง, ดอกเบี้ยลง = Gold ขึ้น",
    impact: "HIGH",
  },
  "Fed Chair Powell Speaks": {
    titleTh: "ประธาน Fed พูด",
    goldImpact: "อาจทำให้ตลาดผันผวน ขึ้นกับเนื้อหา",
    impact: "HIGH",
  },
  "FOMC Minutes": {
    titleTh: "รายงานการประชุม FOMC",
    goldImpact: "ให้ข้อมูลเชิงลึกเกี่ยวกับทิศทางนโยบาย",
    impact: "MEDIUM",
  },

  // Employment Data
  "Nonfarm Payrolls": {
    titleTh: "ตัวเลขจ้างงานนอกภาคเกษตร (NFP)",
    goldImpact: "ตัวเลขดี = USD แข็ง = Gold ลง, ตัวเลขแย่ = Gold ขึ้น",
    impact: "HIGH",
  },
  "Unemployment Rate": {
    titleTh: "อัตราว่างงาน",
    goldImpact: "ว่างงานสูง = เศรษฐกิจอ่อน = Gold ขึ้น",
    impact: "HIGH",
  },
  "Initial Jobless Claims": {
    titleTh: "ขอรับสวัสดิการว่างงาน",
    goldImpact: "ตัวเลขสูง = เศรษฐกิจอ่อน = Gold ขึ้น",
    impact: "MEDIUM",
  },

  // Inflation Data
  "CPI": {
    titleTh: "ดัชนีราคาผู้บริโภค (CPI)",
    goldImpact: "เงินเฟ้อสูง = Fed ขึ้นดอกเบี้ย = Gold ลง (ระยะสั้น) แต่เป็น Hedge เงินเฟ้อ (ระยะยาว)",
    impact: "HIGH",
  },
  "Core CPI": {
    titleTh: "CPI พื้นฐาน (ไม่รวมอาหาร/พลังงาน)",
    goldImpact: "สำคัญกว่า CPI ทั่วไป Fed ดูตัวนี้เป็นหลัก",
    impact: "HIGH",
  },
  "PPI": {
    titleTh: "ดัชนีราคาผู้ผลิต (PPI)",
    goldImpact: "เป็น Leading indicator ของ CPI",
    impact: "MEDIUM",
  },
  "PCE Price Index": {
    titleTh: "ดัชนีราคา PCE",
    goldImpact: "Fed ใช้ตัวนี้วัดเงินเฟ้อหลัก มีผลกระทบสูง",
    impact: "HIGH",
  },

  // GDP & Economic Growth
  "GDP": {
    titleTh: "ผลิตภัณฑ์มวลรวมในประเทศ",
    goldImpact: "GDP ต่ำ = เศรษฐกิจอ่อน = Fed ลดดอกเบี้ย = Gold ขึ้น",
    impact: "HIGH",
  },
  "ISM Manufacturing PMI": {
    titleTh: "ดัชนี PMI ภาคการผลิต",
    goldImpact: "<50 = หดตัว = Gold ขึ้น, >50 = ขยายตัว = Gold ลง",
    impact: "MEDIUM",
  },
  "ISM Services PMI": {
    titleTh: "ดัชนี PMI ภาคบริการ",
    goldImpact: "<50 = หดตัว = Gold ขึ้น, >50 = ขยายตัว = Gold ลง",
    impact: "MEDIUM",
  },

  // Consumer Data
  "Retail Sales": {
    titleTh: "ยอดค้าปลีก",
    goldImpact: "ยอดขายดี = เศรษฐกิจแข็งแรง = Gold ลง",
    impact: "MEDIUM",
  },
  "Consumer Confidence": {
    titleTh: "ความเชื่อมั่นผู้บริโภค",
    goldImpact: "ความเชื่อมั่นสูง = เศรษฐกิจดี = Gold ลง",
    impact: "LOW",
  },

  // Housing
  "Existing Home Sales": {
    titleTh: "ยอดขายบ้านมือสอง",
    goldImpact: "มีผลกระทบต่ำต่อ Gold",
    impact: "LOW",
  },
  "New Home Sales": {
    titleTh: "ยอดขายบ้านใหม่",
    goldImpact: "มีผลกระทบต่ำต่อ Gold",
    impact: "LOW",
  },

  // Dollar Index Events
  "DXY": {
    titleTh: "ดัชนีดอลลาร์",
    goldImpact: "DXY ขึ้น = Gold ลง, DXY ลง = Gold ขึ้น (สัมพันธ์ผกผัน)",
    impact: "MEDIUM",
  },

  // Geopolitical (manual tracking)
  "Geopolitical Event": {
    titleTh: "เหตุการณ์ทางภูมิรัฐศาสตร์",
    goldImpact: "ความไม่แน่นอนสูง = Safe Haven = Gold ขึ้น",
    impact: "HIGH",
  },
};

// ============================================
// Static Calendar Data (2024-2026)
// In production, fetch from API like Forex Factory or Investing.com
// ============================================

function getStaticEvents(): EconomicEvent[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Generate some example events for the current period
  const events: EconomicEvent[] = [];

  // Fed meetings (approximately every 6 weeks)
  const fedMeetingDates = [
    new Date(year, 0, 29), // Jan
    new Date(year, 2, 19), // Mar
    new Date(year, 4, 7),  // May
    new Date(year, 5, 18), // Jun
    new Date(year, 6, 30), // Jul
    new Date(year, 8, 17), // Sep
    new Date(year, 10, 5), // Nov
    new Date(year, 11, 17), // Dec
  ];

  for (const date of fedMeetingDates) {
    events.push({
      id: `fomc-${date.toISOString().split("T")[0]}`,
      title: "FOMC Meeting",
      titleTh: "ประชุม FOMC",
      date,
      time: "14:00",
      impact: "HIGH",
      currency: "USD",
      description: "Federal Open Market Committee meeting - interest rate decision",
      goldImpact: "มีผลกระทบสูงมาก - ดอกเบี้ยขึ้น = Gold ลง, ดอกเบี้ยลง = Gold ขึ้น",
    });
  }

  // NFP (First Friday of each month)
  for (let m = 0; m < 12; m++) {
    const firstDay = new Date(year, m, 1);
    const dayOfWeek = firstDay.getDay();
    const firstFriday = new Date(year, m, 1 + ((5 - dayOfWeek + 7) % 7));

    events.push({
      id: `nfp-${year}-${m + 1}`,
      title: "Nonfarm Payrolls",
      titleTh: "ตัวเลขจ้างงานนอกภาคเกษตร (NFP)",
      date: firstFriday,
      time: "08:30",
      impact: "HIGH",
      currency: "USD",
      description: "Monthly employment report showing job creation/loss",
      goldImpact: "ตัวเลขดี = USD แข็ง = Gold ลง, ตัวเลขแย่ = Gold ขึ้น",
    });
  }

  // CPI (Usually around 10th-14th of each month)
  for (let m = 0; m < 12; m++) {
    const cpiDate = new Date(year, m, 12);

    events.push({
      id: `cpi-${year}-${m + 1}`,
      title: "CPI",
      titleTh: "ดัชนีราคาผู้บริโภค (CPI)",
      date: cpiDate,
      time: "08:30",
      impact: "HIGH",
      currency: "USD",
      description: "Consumer Price Index - main inflation measure",
      goldImpact: "เงินเฟ้อสูง = Fed ขึ้นดอกเบี้ย = Gold อาจลงระยะสั้น",
    });
  }

  // Filter to upcoming events only
  return events.filter(e => e.date >= new Date(now.getTime() - 24 * 60 * 60 * 1000))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ============================================
// Fetch Events (Simulated - use real API in production)
// ============================================

/**
 * Get economic events for a date range
 * In production, integrate with:
 * - Forex Factory API
 * - Investing.com API
 * - TradingView Economic Calendar
 */
export async function getEconomicEvents(daysAhead = 7): Promise<EconomicEvent[]> {
  try {
    // Import prisma dynamically to avoid circular deps
    const { default: prisma } = await import("@/lib/db");

    const now = new Date();
    const endDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    // Fetch from DB
    const dbEvents = await prisma.economicEvent.findMany({
      where: {
        date: {
          gte: new Date(now.setHours(0, 0, 0, 0)),
          lte: endDate
        }
      },
      orderBy: { date: 'asc' }
    });

    if (dbEvents.length > 0) {
      return dbEvents.map(e => ({
        id: e.externalId,
        title: e.title,
        titleTh: e.title, // Use English title as fallback or map if possible
        date: e.date,
        time: e.time,
        impact: e.impact as "HIGH" | "MEDIUM" | "LOW",
        currency: e.currency,
        forecast: e.forecast || undefined,
        actual: e.actual || undefined,
        previous: e.previous || undefined,
        description: e.title,
        goldImpact: GOLD_IMPORTANT_EVENTS[e.title]?.goldImpact || "อาจมีผลกระทบต่อความผันผวน",
      }));
    }
  } catch (e) {
    console.warn("Failed to fetch events from DB, using static data", e);
  }

  // Fallback to static data
  const allEvents = getStaticEvents();
  const endDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);

  return allEvents.filter(e => e.date <= endDate);
}

// ============================================
// Get Upcoming Events Summary
// ============================================

/**
 * Get summary of upcoming events with trading caution level
 */
export async function getUpcomingEventsSummary(): Promise<UpcomingEvents> {
  const events = await getEconomicEvents(7);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const today = events.filter(e => e.date >= todayStart && e.date < todayEnd);
  const thisWeek = events.filter(e => e.date >= todayStart && e.date < weekEnd);

  const highImpactCount = events.filter(e => e.impact === "HIGH").length;
  const todayHighImpact = today.filter(e => e.impact === "HIGH");

  // Determine trading caution level
  let tradingCaution: UpcomingEvents["tradingCaution"] = "NONE";
  const warnings: string[] = [];

  if (todayHighImpact.length > 0) {
    tradingCaution = "HIGH";
    for (const event of todayHighImpact) {
      warnings.push(`⚠️ วันนี้ ${event.time} ET: ${event.titleTh} - ${event.goldImpact}`);
    }
  } else if (highImpactCount > 2) {
    tradingCaution = "MEDIUM";
    warnings.push(`📅 มี ${highImpactCount} ข่าวสำคัญในสัปดาห์นี้`);
  } else if (highImpactCount > 0) {
    tradingCaution = "LOW";
  }

  return {
    today,
    thisWeek,
    highImpactCount,
    warnings,
    tradingCaution,
  };
}

// ============================================
// Format for AI Prompt
// ============================================

/**
 * Format economic calendar for AI analysis prompt
 */
export function formatEconomicCalendarForAI(events: UpcomingEvents): string {
  const lines: string[] = [];

  lines.push("## ปฏิทินเศรษฐกิจ (Economic Calendar)");
  lines.push("");

  // Trading caution
  if (events.tradingCaution !== "NONE") {
    lines.push(`### ⚠️ ระดับความระวัง: ${events.tradingCaution}`);
    for (const warning of events.warnings) {
      lines.push(warning);
    }
    lines.push("");
  }

  // Today's events
  if (events.today.length > 0) {
    lines.push("### ข่าววันนี้");
    for (const event of events.today) {
      const impactEmoji = event.impact === "HIGH" ? "🔴" : event.impact === "MEDIUM" ? "🟡" : "🟢";
      lines.push(`- ${event.time} ET: ${impactEmoji} ${event.titleTh}`);
      lines.push(`  → ผลกระทบ: ${event.goldImpact}`);
    }
    lines.push("");
  } else {
    lines.push("### ข่าววันนี้: ไม่มีข่าวสำคัญ ✅");
    lines.push("");
  }

  // This week's high impact events
  const weekHighImpact = events.thisWeek.filter(e =>
    e.impact === "HIGH" &&
    e.date.getTime() > Date.now() + 24 * 60 * 60 * 1000
  );

  if (weekHighImpact.length > 0) {
    lines.push("### ข่าวสำคัญสัปดาห์นี้");
    for (const event of weekHighImpact.slice(0, 5)) {
      const dateStr = event.date.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
      lines.push(`- ${dateStr} ${event.time} ET: 🔴 ${event.titleTh}`);
    }
    lines.push("");
  }

  // Trading recommendation based on calendar
  lines.push("### คำแนะนำ");
  if (events.tradingCaution === "HIGH") {
    lines.push("- ❌ ควรหลีกเลี่ยงการเทรดก่อนข่าวสำคัญ 30 นาที");
    lines.push("- ⚠️ ตลาดอาจผันผวนรุนแรง");
    lines.push("- 🛡️ ถ้ามี Position ควรตั้ง SL ให้กว้างขึ้น");
  } else if (events.tradingCaution === "MEDIUM") {
    lines.push("- ⚠️ มีข่าวสำคัญในสัปดาห์นี้");
    lines.push("- 📊 ตรวจสอบปฏิทินก่อนวางแผนเทรด");
  } else {
    lines.push("- ✅ ไม่มีข่าวสำคัญระยะใกล้");
    lines.push("- 📈 สามารถเทรดตามสัญญาณได้ปกติ");
  }

  return lines.join("\n");
}

// ============================================
// Check if safe to trade
// ============================================

/**
 * Check if it's safe to trade based on upcoming events
 */
export async function isSafeToTrade(): Promise<{
  safe: boolean;
  reason: string;
  nextHighImpactEvent?: EconomicEvent;
}> {
  const events = await getUpcomingEventsSummary();
  const now = new Date();

  // Find next high impact event
  const upcoming = events.thisWeek
    .filter(e => e.impact === "HIGH" && e.date > now)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (upcoming.length === 0) {
    return {
      safe: true,
      reason: "ไม่มีข่าวสำคัญในสัปดาห์นี้",
    };
  }

  const next = upcoming[0];
  const hoursUntil = (next.date.getTime() - now.getTime()) / (60 * 60 * 1000);

  if (hoursUntil < 2) {
    return {
      safe: false,
      reason: `⚠️ ${next.titleTh} จะประกาศในอีก ${Math.round(hoursUntil * 60)} นาที - หลีกเลี่ยงการเทรด`,
      nextHighImpactEvent: next,
    };
  }

  if (hoursUntil < 6) {
    return {
      safe: true,
      reason: `📅 ${next.titleTh} จะประกาศในอีก ${Math.round(hoursUntil)} ชั่วโมง - เทรดได้แต่ระวัง`,
      nextHighImpactEvent: next,
    };
  }

  return {
    safe: true,
    reason: `✅ ข่าวสำคัญถัดไป: ${next.titleTh} (${next.date.toLocaleDateString("th-TH")})`,
    nextHighImpactEvent: next,
  };
}
