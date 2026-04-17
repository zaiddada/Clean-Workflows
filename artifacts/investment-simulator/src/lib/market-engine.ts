/**
 * Market Engine — structured, realistic price simulation.
 *
 * Each stock carries:
 *   - trend: "up" | "down" | "neutral"
 *   - volatility: bounded ±0.5%–1%
 *   - momentum: previous move's direction partially carries forward
 *   - history: rolling window of prices
 *
 * Price updates combine:
 *   1. Base fluctuation (±0.5%–1%)
 *   2. Trend bias (slight push in trend direction)
 *   3. Momentum (previous direction influence)
 *   4. Smooth wave (sin-based oscillation for natural feel)
 *   5. Mean reversion (prevents runaway prices)
 *   6. Sector correlation (stocks in same sector move together)
 *   7. Event impact (from news engine)
 */

export type Trend = "up" | "down" | "neutral";
export type LastMove = "up" | "down" | "flat";
export type MarketSentiment = "bullish" | "bearish" | "neutral" | "volatile";

export type StockDefinition = {
  id: string;
  name: string;
  sector: string;
  price: number;
  trend: Trend;
  volatility: number;
};

export type StockView = StockDefinition & {
  currentPrice: number;
  previousPrice: number;
  percentChange: number;
  recentDipIndex: number;
  totalTrend: number;
  observedVolatility: number;
  history: number[];
  lastMove: LastMove;
  momentum: number;
  lastEvent?: import("./news-engine").NewsItem;
  /** Ticks since last trend change — used for organic trend decay */
  trendAge: number;
  /** Smoothed moving average for mean reversion */
  sma: number;
  /** Consecutive ticks in the same direction */
  streak: number;
  /** Intraday high since session start */
  sessionHigh: number;
  /** Intraday low since session start */
  sessionLow: number;
};

export const STOCKS: StockDefinition[] = [
  { id: "RELIANCE", name: "Reliance", sector: "Energy", price: 2500, trend: "neutral", volatility: 0.008 },
  { id: "TCS", name: "TCS", sector: "IT Services", price: 3500, trend: "neutral", volatility: 0.007 },
  { id: "HDFCBANK", name: "HDFC Bank", sector: "Banking", price: 1500, trend: "neutral", volatility: 0.007 },
  { id: "INFY", name: "Infosys", sector: "IT Services", price: 1420, trend: "neutral", volatility: 0.008 },
  { id: "ICICI", name: "ICICI Bank", sector: "Banking", price: 980, trend: "neutral", volatility: 0.008 },
  { id: "SBI", name: "SBI", sector: "Banking", price: 730, trend: "neutral", volatility: 0.009 },
  { id: "ITC", name: "ITC", sector: "Consumer", price: 450, trend: "neutral", volatility: 0.006 },
  { id: "ADANI", name: "Adani Enterprises", sector: "Infrastructure", price: 3050, trend: "neutral", volatility: 0.011 },
];

// ─── Tick interval configuration ──────────────────────────
/** Price update interval in ms (3-5 seconds). Actual value varies per tick. */
export const TICK_INTERVAL_MIN = 3000;
export const TICK_INTERVAL_MAX = 5000;
export function getRandomTickInterval(): number {
  return TICK_INTERVAL_MIN + Math.random() * (TICK_INTERVAL_MAX - TICK_INTERVAL_MIN);
}

// ─── Helpers ──────────────────────────────────────────────

export function calculateObservedVolatility(history: number[]): number {
  const start = Math.max(1, history.length - 8);
  const changes: number[] = [];
  for (let i = start; i < history.length; i += 1) {
    const prev = history[i - 1];
    const curr = history[i];
    if (curr && prev) {
      changes.push(Math.abs(((curr - prev) / prev) * 100));
    }
  }
  if (!changes.length) return 0;
  return changes.reduce((s, v) => s + v, 0) / changes.length;
}

export function getRecentDipIndex(history: number[]): number {
  for (let i = history.length - 1; i > Math.max(0, history.length - 5); i -= 1) {
    const curr = history[i];
    const prev = history[i - 1];
    if (prev && curr) {
      const change = ((curr - prev) / prev) * 100;
      if (change <= -5) return i - 1;
    }
  }
  return -1;
}

/** Simple SMA over last N prices */
function computeSMA(history: number[], window: number = 10): number {
  const slice = history.slice(-window);
  if (slice.length === 0) return 0;
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

/** Pseudo-random with seed for smooth wave (poor man's Perlin) */
function smoothNoise(x: number): number {
  const n = Math.sin(x * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Interpolated smooth noise for organic feel */
function interpolatedNoise(x: number): number {
  const ix = Math.floor(x);
  const fx = x - ix;
  const a = smoothNoise(ix);
  const b = smoothNoise(ix + 1);
  // Smoothstep interpolation
  const t = fx * fx * (3 - 2 * fx);
  return a + (b - a) * t;
}

// ─── Market sentiment ────────────────────────────────────

export function computeMarketSentiment(stocks: StockView[]): MarketSentiment {
  const avgChange = stocks.reduce((t, s) => t + s.percentChange, 0) / Math.max(stocks.length, 1);
  const avgVol = stocks.reduce((t, s) => t + s.observedVolatility, 0) / Math.max(stocks.length, 1);

  if (avgVol > 1.5) return "volatile";
  if (avgChange > 0.8) return "bullish";
  if (avgChange < -0.8) return "bearish";
  return "neutral";
}

// ─── Initialize ───────────────────────────────────────────

export function initializeMarketStocks(): StockView[] {
  return STOCKS.map((stock) => ({
    ...stock,
    currentPrice: stock.price,
    previousPrice: stock.price,
    percentChange: 0,
    recentDipIndex: -1,
    totalTrend: 0,
    observedVolatility: 0,
    history: [stock.price],
    lastMove: "flat" as LastMove,
    momentum: 0,
    trendAge: 0,
    sma: stock.price,
    streak: 0,
    sessionHigh: stock.price,
    sessionLow: stock.price,
  }));
}

// ─── Core price update ───────────────────────────────────

const MOMENTUM_DECAY = 0.30;            // how much previous move carries forward
const MOMENTUM_CAP = 0.015;             // cap momentum to prevent runaway
const TREND_BIAS_STRENGTH = 0.0020;     // slight directional push from trend
const BASE_NOISE_SCALE = 0.85;          // multiplier on volatility for base random
const WAVE_SCALE = 0.28;                // sin-wave amplitude
const WAVE2_SCALE = 0.15;               // second harmonic for complexity
const MICRO_NOISE = 0.0018;             // tiny extra randomness
const MEAN_REVERSION_STRENGTH = 0.08;   // pull toward SMA
const MEAN_REVERSION_THRESHOLD = 0.04;  // trigger when price deviates > 4% from SMA
const SECTOR_CORRELATION = 0.25;        // how much sector peers influence each other
const STREAK_DAMPING = 0.12;            // reduces movement if streak is long (mean reversion)
const HISTORY_LENGTH = 180;             // rolling history window (extended for better graphs)

export function updateMarketStocks(
  previousStocks: StockView[],
  timeIndex: number,
  event?: import("./news-engine").NewsItem,
): StockView[] {
  // Pre-compute sector average movements for correlation
  const sectorMovements: Record<string, number[]> = {};
  for (const stock of previousStocks) {
    if (!sectorMovements[stock.sector]) sectorMovements[stock.sector] = [];
    sectorMovements[stock.sector]!.push(stock.momentum);
  }
  const sectorAvgMomentum: Record<string, number> = {};
  for (const [sector, movements] of Object.entries(sectorMovements)) {
    sectorAvgMomentum[sector] = movements.reduce((s, v) => s + v, 0) / Math.max(movements.length, 1);
  }

  return previousStocks.map((stock, stockIndex) => {
    // Does the current event apply to this stock?
    const appliesToStock = Boolean(
      event &&
        (event.stock === stock.id ||
          event.sector === stock.sector ||
          (!event.stock && !event.sector)),
    );

    // 1. TREND BIAS — organic, fades with age
    const trendDecay = Math.max(0, 1 - stock.trendAge * 0.06); // trend weakens over ~16 ticks
    const trendBias =
      stock.trend === "up"
        ? TREND_BIAS_STRENGTH * trendDecay
        : stock.trend === "down"
          ? -TREND_BIAS_STRENGTH * trendDecay
          : 0;

    // 2. SMOOTH WAVE — dual harmonic for organic feel (offset per-stock)
    const phase1 = (timeIndex + stockIndex * 2.7) / 4.2;
    const phase2 = (timeIndex + stockIndex * 1.3) / 7.8;
    const smoothWave =
      Math.sin(phase1) * stock.volatility * WAVE_SCALE +
      Math.sin(phase2) * stock.volatility * WAVE2_SCALE;

    // 3. INTERPOLATED NOISE — smoother than pure random
    const noiseVal = interpolatedNoise(timeIndex * 0.3 + stockIndex * 17.3);
    const baseNoise = (noiseVal - 0.5) * stock.volatility * BASE_NOISE_SCALE;

    // 4. BASE RANDOM FLUCTUATION — Gaussian-ish (sum of 3 uniform = rough normal)
    const u1 = Math.random(), u2 = Math.random(), u3 = Math.random();
    const gaussianApprox = (u1 + u2 + u3) / 3 - 0.5; // centered around 0
    const baseRandom = gaussianApprox * stock.volatility * 0.6;

    // 5. MOMENTUM (capped, with decay)
    const clampedMomentum = Math.max(-MOMENTUM_CAP, Math.min(MOMENTUM_CAP, stock.momentum));
    const momentumContribution = clampedMomentum * MOMENTUM_DECAY;

    // 6. MEAN REVERSION — pull toward SMA when price deviates too far
    let meanReversionForce = 0;
    if (stock.sma > 0) {
      const deviation = (stock.currentPrice - stock.sma) / stock.sma;
      if (Math.abs(deviation) > MEAN_REVERSION_THRESHOLD) {
        meanReversionForce = -deviation * MEAN_REVERSION_STRENGTH;
      }
    }

    // 7. SECTOR CORRELATION — peer influence
    const sectorPull = (sectorAvgMomentum[stock.sector] || 0) * SECTOR_CORRELATION;

    // 8. STREAK DAMPING — long streaks become less likely to continue
    const streakDamp = stock.streak > 3
      ? -Math.sign(stock.momentum) * STREAK_DAMPING * Math.min(stock.streak - 3, 4) * 0.001
      : 0;

    // 9. MICRO NOISE
    const noise = (Math.random() - 0.5) * MICRO_NOISE;

    // 10. EVENT IMPACT
    const eventImpact = appliesToStock && event ? event.impact : 0;

    // Combined movement
    const rawMovement =
      baseNoise + baseRandom + trendBias + smoothWave + noise +
      momentumContribution + meanReversionForce + sectorPull + streakDamp + eventImpact;

    // Clamp total movement to prevent extreme single-tick jumps (max ±12%)
    const movement = Math.max(-0.12, Math.min(0.12, rawMovement));

    // New price (floor at ₹10, use unrounded for precision then round for display)
    const rawPrice = stock.currentPrice * (1 + movement);
    const currentPrice = Math.max(10, Math.round(rawPrice));
    const previousPrice = stock.currentPrice;

    // Percent change from last tick
    const percentChange = previousPrice
      ? ((currentPrice - previousPrice) / previousPrice) * 100
      : 0;

    // New momentum = this tick's actual percent change (as fraction)
    const newMomentum = previousPrice
      ? (currentPrice - previousPrice) / previousPrice
      : 0;

    // Streak tracking
    const moveDir = percentChange > 0.02 ? 1 : percentChange < -0.02 ? -1 : 0;
    const prevDir = stock.streak > 0 ? (stock.lastMove === "up" ? 1 : stock.lastMove === "down" ? -1 : 0) : 0;
    const newStreak = moveDir !== 0 && moveDir === prevDir ? stock.streak + 1 : moveDir !== 0 ? 1 : 0;

    // Rolling history
    const history = [...stock.history, currentPrice].slice(-HISTORY_LENGTH);

    // SMA
    const sma = computeSMA(history, 12);

    // Overall trend from session start
    const firstPrice = history[0] || stock.price;
    const totalTrend = firstPrice ? ((currentPrice - firstPrice) / firstPrice) * 100 : 0;

    // Session high/low
    const sessionHigh = Math.max(stock.sessionHigh, currentPrice);
    const sessionLow = Math.min(stock.sessionLow, currentPrice);

    // Update trend direction from event (if applicable)
    let nextTrend: Trend = stock.trend;
    let nextTrendAge = stock.trendAge + 1;

    if (appliesToStock && event?.type !== "neutral") {
      nextTrend = event?.type === "positive" ? "up" : "down";
      nextTrendAge = 0;
    }

    // Natural trend decay: after ~12-20 ticks without event, trend reverts to neutral
    // Uses trendAge for deterministic decay instead of pure random
    if (!appliesToStock && stock.trend !== "neutral" && stock.trendAge > 12) {
      // Probability increases with age
      const decayProb = Math.min(0.35, (stock.trendAge - 12) * 0.04);
      if (Math.random() < decayProb) {
        nextTrend = "neutral";
        nextTrendAge = 0;
      }
    }

    // Determine last move with slightly wider threshold for "flat"
    const lastMove: LastMove = percentChange > 0.04 ? "up" : percentChange < -0.04 ? "down" : "flat";

    return {
      ...stock,
      trend: nextTrend,
      trendAge: nextTrendAge,
      previousPrice,
      currentPrice,
      percentChange,
      totalTrend,
      observedVolatility: calculateObservedVolatility(history),
      recentDipIndex: getRecentDipIndex(history),
      history,
      lastMove,
      momentum: newMomentum,
      sma,
      streak: newStreak,
      sessionHigh,
      sessionLow,
      lastEvent: appliesToStock ? event : undefined,
    };
  });
}

export function findStock(stockId: string): StockDefinition | undefined {
  return STOCKS.find((s) => s.id === stockId);
}
