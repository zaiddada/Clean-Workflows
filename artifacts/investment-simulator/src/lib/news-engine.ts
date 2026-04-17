/**
 * News Engine — structured news dataset with 30–50 headlines per stock.
 *
 * Each news item has:
 *   - stock / sector targeting
 *   - type: positive | negative | neutral
 *   - impact: numeric price multiplier (e.g. -0.06 = –6%)
 *   - headline: realistic generated text
 *   - urgency: "breaking" | "flash" | "regular" — controls UI animation
 *
 * Also includes broad market news and sector-wide events.
 *
 * Events fire every 20–40 seconds (~5-10 ticks at 3-5s interval).
 */

export type NewsType = "positive" | "negative" | "neutral";
export type NewsUrgency = "breaking" | "flash" | "regular";

export type NewsItem = {
  stock?: string;
  sector?: string;
  type: NewsType;
  impact: number;
  headline: string;
  urgency: NewsUrgency;
};

import { STOCKS, type StockView } from "./market-engine";

// ─── Event timing configuration ──────────────────────────
/** Events fire every 20-40 seconds. At ~4s/tick that's 5-10 ticks. */
export const EVENT_INTERVAL_MIN_TICKS = 5;
export const EVENT_INTERVAL_MAX_TICKS = 10;
export function getNextEventTicks(): number {
  return EVENT_INTERVAL_MIN_TICKS + Math.floor(Math.random() * (EVENT_INTERVAL_MAX_TICKS - EVENT_INTERVAL_MIN_TICKS + 1));
}

// ─── Per-stock headline templates ─────────────────────────

const POSITIVE_HEADLINES: string[] = [
  "reports stronger demand outlook after management update",
  "gains as analysts point to improving margin visibility",
  "moves higher after simulated institutional buying interest",
  "shows recovery as investors return to large-cap names",
  "rises after upbeat sector commentary",
  "climbs on improving growth expectations",
  "advances as market sentiment turns constructive",
  "sees renewed buying after recent weakness",
  "benefits from positive earnings revision talk",
  "trends upward as risk appetite improves",
  "gets upgraded by brokerage with higher target price",
  "rallies after strong quarterly revenue guidance",
  "surges on optimistic industry demand forecast",
  "lifted by favorable regulatory development",
  "jumps as foreign fund inflows pick up pace",
  "supported by expansion into high-margin segments",
  "boosted by partnership with major technology firm",
  "outperforms peers on improving cash flow trajectory",
  "gains traction as order book strengthens visibly",
  "rises on better-than-expected client acquisition data",
  "strengthened by robust export demand signals",
  "advances after management raises full-year guidance",
  "benefits from falling input costs improving margins",
  "sees fresh accumulation from long-term investors",
  "climbs after favorable analyst consensus revision",
  "supported by government policy tailwind for sector",
  "trends higher on back of innovation pipeline update",
  "boosts confidence after resolving pending legal matter",
  "lifted as supply chain normalization accelerates",
  "rallies on speculation of strategic acquisition target",
  "gains after announcing share buyback program",
  "rises following strong operating cash flow report",
  "advances on improved credit rating outlook",
  "climbs as new product launch exceeds expectations",
  "surges after winning major government contract",
  "benefits from competitor exit creating market share opportunity",
  "jumps following record-breaking quarterly revenue",
  "strengthened by institutional investors increasing stake",
  "gains after management signals dividend increase",
  "rises as ESG ratings improve attracting new fund inflows",
];

const NEGATIVE_HEADLINES: string[] = [
  "faces regulatory concerns affecting growth outlook",
  "drops as investors react to margin pressure",
  "falls after weak sector commentary",
  "slips as profit-booking accelerates",
  "declines after uncertainty rises around near-term demand",
  "comes under pressure from broad market selling",
  "weakens as volatility increases across the sector",
  "falls after cautious analyst commentary",
  "sees selling pressure after simulated risk warning",
  "drops as traders react to negative news flow",
  "declines on report of rising competitive intensity",
  "falls as input cost inflation raises concern",
  "weakens after delayed product launch timeline",
  "hit by downgrade from prominent research house",
  "faces headwinds from currency fluctuation exposure",
  "drops on news of key leadership change uncertainty",
  "loses ground as domestic demand signals soften",
  "slips after lower-than-expected order inflow update",
  "pressured by supply chain disruption concerns",
  "declines as institutional investors trim positions",
  "weakens amid cautious global macro outlook",
  "falls on reports of inventory pileup across channels",
  "hit by margin squeeze from rising operating costs",
  "drops after management flags near-term execution risks",
  "sees outflows after disappointing analyst day presentation",
  "declines as government subsidy rollback weighs on outlook",
  "pressured by spike in sector-wide default concerns",
  "falls after profit warning from comparable peer company",
  "weakens on higher-than-expected attrition rate data",
  "drops as credit rating agency places outlook on watch",
  "slips after surprise management departure announced",
  "falls as quarterly margins miss analyst estimates",
  "pressured by rising raw material costs globally",
  "declines following unfavorable court ruling on key case",
  "drops after major client contract not renewed",
  "weakens as foreign investors reduce exposure to sector",
  "falls on report of production facility shutdown",
  "hit by unexpected tax liability disclosure",
  "declines after guidance cut for next two quarters",
  "pressured by industry-wide pricing war concerns",
];

const NEUTRAL_HEADLINES: string[] = [
  "trades steady while investors wait for fresh cues",
  "moves in a narrow range as volume remains normal",
  "holds near recent levels with mixed sentiment",
  "sees muted reaction to sector developments",
  "stays range-bound during quiet market conditions",
  "shows limited movement after balanced commentary",
  "remains stable as broader market direction is unclear",
  "consolidates after recent price action",
  "sees cautious positioning from short-term traders",
  "holds steady as investors assess the next trend",
  "flat as market participants await quarterly results",
  "unchanged amid low trading volume session",
  "stable as institutional and retail flows balance out",
  "moves sideways with no clear directional catalyst",
  "in a holding pattern as traders evaluate mixed data",
];

// Positive impacts: +3% to +7%
const POSITIVE_IMPACTS = [
  0.032, 0.038, 0.044, 0.050, 0.057,
  0.064, 0.047, 0.036, 0.052, 0.069,
  0.041, 0.055, 0.062, 0.035, 0.048,
  0.053, 0.059, 0.043, 0.066, 0.046,
  0.037, 0.058, 0.042, 0.051, 0.063,
  0.045, 0.056, 0.039, 0.054, 0.060,
  0.033, 0.049, 0.061, 0.040, 0.067,
  0.044, 0.057, 0.034, 0.050, 0.065,
];

// Negative impacts: -3% to -10%
const NEGATIVE_IMPACTS = [
  -0.033, -0.041, -0.052, -0.064, -0.071,
  -0.085, -0.096, -0.046, -0.058, -0.074,
  -0.037, -0.049, -0.062, -0.078, -0.055,
  -0.043, -0.067, -0.088, -0.039, -0.053,
  -0.069, -0.081, -0.044, -0.057, -0.072,
  -0.035, -0.060, -0.076, -0.047, -0.091,
  -0.036, -0.054, -0.065, -0.083, -0.042,
  -0.059, -0.073, -0.048, -0.066, -0.087,
];

// ─── Determine urgency based on impact magnitude ─────────

function impactToUrgency(impact: number): NewsUrgency {
  const abs = Math.abs(impact);
  if (abs >= 0.07) return "breaking";
  if (abs >= 0.045) return "flash";
  return "regular";
}

// ─── Build the full per-stock news database ───────────────

export const NEWS_DATABASE: NewsItem[] = STOCKS.flatMap((stock) => [
  ...POSITIVE_HEADLINES.map((headline, i) => {
    const impact = POSITIVE_IMPACTS[i % POSITIVE_IMPACTS.length]!;
    return {
      stock: stock.id,
      type: "positive" as const,
      impact,
      headline: `${stock.name} ${headline}`,
      urgency: impactToUrgency(impact),
    };
  }),
  ...NEGATIVE_HEADLINES.map((headline, i) => {
    const impact = NEGATIVE_IMPACTS[i % NEGATIVE_IMPACTS.length]!;
    return {
      stock: stock.id,
      type: "negative" as const,
      impact,
      headline: `${stock.name} ${headline}`,
      urgency: impactToUrgency(impact),
    };
  }),
  ...NEUTRAL_HEADLINES.map((headline) => ({
    stock: stock.id,
    type: "neutral" as const,
    impact: 0,
    headline: `${stock.name} ${headline}`,
    urgency: "regular" as const,
  })),
]);

// ─── Broad market / sector-wide news ─────────────────────

export const BROAD_MARKET_NEWS: NewsItem[] = [
  { sector: "IT Services", type: "positive", impact: 0.041, headline: "Tech stocks trending up after recovery in global software sentiment", urgency: "flash" },
  { sector: "IT Services", type: "negative", impact: -0.038, headline: "IT sector under pressure after weak US tech earnings guidance", urgency: "regular" },
  { sector: "IT Services", type: "positive", impact: 0.055, headline: "IT stocks rally as US clients signal accelerated digital spending", urgency: "flash" },
  { sector: "IT Services", type: "negative", impact: -0.062, headline: "Technology companies face selloff amid global growth fears", urgency: "breaking" },
  { sector: "Banking", type: "negative", impact: -0.055, headline: "Banking stocks slip as risk appetite cools across the market", urgency: "flash" },
  { sector: "Banking", type: "positive", impact: 0.043, headline: "Banking sector rallies on strong credit growth data", urgency: "flash" },
  { sector: "Banking", type: "negative", impact: -0.072, headline: "Banks under pressure as RBI signals potential rate action", urgency: "breaking" },
  { sector: "Banking", type: "positive", impact: 0.058, headline: "Banking stocks surge as NPA ratios hit multi-year low", urgency: "flash" },
  { sector: "Energy", type: "negative", impact: -0.048, headline: "Energy stocks face pressure after simulated policy uncertainty", urgency: "flash" },
  { sector: "Energy", type: "positive", impact: 0.045, headline: "Energy sector gains as crude prices recover on supply concerns", urgency: "flash" },
  { sector: "Energy", type: "positive", impact: 0.063, headline: "Energy stocks surge as OPEC announces production cuts", urgency: "breaking" },
  { sector: "Energy", type: "negative", impact: -0.058, headline: "Energy sector weakens on demand slowdown fears", urgency: "flash" },
  { sector: "Consumer", type: "positive", impact: 0.034, headline: "Consumer stocks hold firm as defensive buying improves", urgency: "regular" },
  { sector: "Consumer", type: "negative", impact: -0.036, headline: "Consumer sector weakens as inflation data raises spending concerns", urgency: "regular" },
  { sector: "Consumer", type: "positive", impact: 0.048, headline: "FMCG names rally as rural demand shows recovery signs", urgency: "flash" },
  { sector: "Consumer", type: "negative", impact: -0.052, headline: "Consumer stocks face pressure from rising packaging costs", urgency: "flash" },
  { sector: "Infrastructure", type: "positive", impact: 0.052, headline: "Infrastructure shares rally as government spending plans boost sentiment", urgency: "flash" },
  { sector: "Infrastructure", type: "negative", impact: -0.044, headline: "Infra stocks retreat as project delays weigh on outlook", urgency: "regular" },
  { sector: "Infrastructure", type: "positive", impact: 0.068, headline: "Infra sector surges on massive new highway development announcement", urgency: "breaking" },
  { sector: "Infrastructure", type: "negative", impact: -0.061, headline: "Infrastructure stocks tumble on report of policy review uncertainty", urgency: "flash" },
  // Broad market events
  { type: "negative", impact: -0.039, headline: "Market dip detected — broad selling across large-cap stocks", urgency: "breaking" },
  { type: "positive", impact: 0.036, headline: "Broad market recovers as investors buy after earlier dip", urgency: "flash" },
  { type: "negative", impact: -0.045, headline: "Market-wide selloff triggered by global uncertainty", urgency: "breaking" },
  { type: "positive", impact: 0.040, headline: "Indices rebound as buying emerges in oversold territory", urgency: "flash" },
  { type: "negative", impact: -0.032, headline: "Profit-booking drags indices lower after multi-day rally", urgency: "regular" },
  { type: "positive", impact: 0.038, headline: "Benchmark index hits session high on strong buying momentum", urgency: "flash" },
  { type: "negative", impact: -0.068, headline: "Flash crash alert — sudden broad market decline triggered by algorithmic selling", urgency: "breaking" },
  { type: "positive", impact: 0.055, headline: "Sharp V-shaped recovery as bargain hunters step in aggressively", urgency: "breaking" },
  { type: "positive", impact: 0.042, headline: "Global risk-on sentiment lifts Indian indices to new session highs", urgency: "flash" },
  { type: "negative", impact: -0.051, headline: "Market under heavy selling pressure as FII outflows accelerate", urgency: "breaking" },
];

// ─── Event selection ──────────────────────────────────────

/** Used history to avoid repeating the same news */
const recentNewsIndices = new Set<number>();
const MAX_RECENT_MEMORY = 20;

export function selectMarketEvent(
  stocks: StockView[],
  timeIndex: number,
): NewsItem | undefined {
  // ~38% chance of a broad/sector event
  if (Math.random() < 0.38) {
    let idx: number;
    let attempts = 0;
    do {
      idx = Math.floor(Math.random() * BROAD_MARKET_NEWS.length);
      attempts++;
    } while (recentNewsIndices.has(10000 + idx) && attempts < 8);

    recentNewsIndices.add(10000 + idx);
    if (recentNewsIndices.size > MAX_RECENT_MEMORY) {
      const first = recentNewsIndices.values().next().value;
      if (first !== undefined) recentNewsIndices.delete(first);
    }

    return BROAD_MARKET_NEWS[idx];
  }

  // Otherwise pick a random stock's non-neutral news
  const stock = stocks[Math.floor(Math.random() * stocks.length)] || stocks[0];
  const candidates = NEWS_DATABASE.filter(
    (n) => n.stock === stock?.id && n.type !== "neutral",
  );
  if (candidates.length === 0) return undefined;

  let idx: number;
  let attempts = 0;
  do {
    idx = Math.floor(Math.random() * candidates.length);
    attempts++;
  } while (recentNewsIndices.has(idx) && attempts < 8);

  recentNewsIndices.add(idx);
  if (recentNewsIndices.size > MAX_RECENT_MEMORY) {
    const first = recentNewsIndices.values().next().value;
    if (first !== undefined) recentNewsIndices.delete(first);
  }

  return candidates[idx];
}

// ─── Alert string builder ────────────────────────────────

export function buildMarketAlert(event: NewsItem): string {
  if (event.urgency === "breaking" && event.impact <= -0.06)
    return "🔴 BREAKING: Major market decline detected";
  if (event.urgency === "breaking" && event.impact >= 0.06)
    return "🟢 BREAKING: Strong market rally underway";
  if (event.headline.toLowerCase().includes("dip") || event.impact <= -0.055)
    return "⚠ Market dip detected";
  if (event.headline.toLowerCase().includes("flash crash"))
    return "🔴 Flash crash alert — high volatility";
  if (event.sector)
    return `${event.sector} stocks trending ${event.type === "positive" ? "up 📈" : "down 📉"}`;
  if (event.stock)
    return `${event.stock} reacts to breaking simulated news`;
  return event.type === "positive"
    ? "Broad market trending up 📈"
    : "⚠ Broad market pressure detected";
}

// ─── Contextual market alert from state ──────────────────

export function getContextualAlert(
  stocks: StockView[],
  currentAlert: string,
): string {
  const avgChange = stocks.reduce((t, s) => t + s.percentChange, 0) / Math.max(stocks.length, 1);
  const risers = stocks.filter((s) => s.percentChange > 0.5).length;
  const fallers = stocks.filter((s) => s.percentChange < -0.5).length;

  if (avgChange <= -2.0) return "⚠ Market dip detected — broad selling pressure";
  if (avgChange >= 2.0) return "📈 Strong rally — broad buying momentum";
  if (risers >= 6) return "📈 Most stocks rising — positive market breadth";
  if (fallers >= 6) return "📉 Most stocks falling — weak market breadth";

  // Check sector-specific movements
  const sectorChanges: Record<string, number[]> = {};
  for (const s of stocks) {
    if (!sectorChanges[s.sector]) sectorChanges[s.sector] = [];
    sectorChanges[s.sector]!.push(s.percentChange);
  }
  for (const [sector, changes] of Object.entries(sectorChanges)) {
    const avg = changes.reduce((t, v) => t + v, 0) / changes.length;
    if (avg > 1.2) return `${sector} stocks rising 📈`;
    if (avg < -1.2) return `${sector} stocks under pressure 📉`;
  }

  return currentAlert;
}
