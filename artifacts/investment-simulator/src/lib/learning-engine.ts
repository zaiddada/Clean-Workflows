/**
 * Learning Engine — behavior tracking, insight generation,
 * and counterfactual "what could you have done better?" analysis.
 *
 * Tracks:
 *   - Buy price, sell price, time held, market trend during trade
 *
 * After sell, generates:
 *   - Panic-sell detection insight
 *   - Frequent-trading detection
 *   - Win/loss streak analysis
 *   - Hold duration analysis
 *   - Counterfactual: "If you held N more ticks, your outcome would be …"
 */

import type { StockView, Trend } from "./market-engine";

export type TradeType = "BUY" | "SELL";

export type Trade = {
  id: string;
  type: TradeType;
  stockId: string;
  stockName: string;
  price: number;
  quantity: number;
  timeIndex: number;
  createdAt: string;
  profitOrLoss?: number;
  label?: "Panic Sell" | "Normal Sell";
  trendAtTrade?: string;
};

export type BehaviorLog = {
  id: string;
  stockId: string;
  behavior: "Panic Sell" | "Normal Sell";
  message: string;
  timeIndex: number;
  profitOrLoss: number;
};

export type SellEvent = {
  action: "SELL";
  stock: string;
  buy_price: number;
  sell_price: number;
  profit_or_loss: number;
  behavior: "Panic Sell" | "Normal Sell";
  time: number;
  /** Time index when the stock was originally bought */
  buyTimeIndex?: number;
  /** Trend at the time of sell */
  trendAtSell?: Trend;
  /** Price history snapshot after sell for counterfactual */
  priceSnapshotAfterSell?: number[];
};

export type PortfolioItem = {
  stockId: string;
  quantity: number;
  averageBuyPrice: number;
  /** Time index of first buy for this holding */
  firstBuyTimeIndex?: number;
};

export type SimulatorUser = {
  username: string;
  password: string;
  balance: number;
  portfolio: Record<string, PortfolioItem>;
  tradeHistory: Trade[];
  behaviorLog: BehaviorLog[];
  sellEvents: SellEvent[];
};

export type Insight = {
  performance: number;
  behavior: string;
  suggestion: string;
  counterfactual?: string;
  frequentTrading?: boolean;
  /** Additional insights from analysis */
  additionalInsights?: string[];
  /** Win rate over recent trades */
  winRate?: number;
  /** Average hold duration in ticks */
  avgHoldDuration?: number;
};

export const INITIAL_BALANCE = 100_000;

// ─── Helpers ──────────────────────────────────────────────

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Counterfactual analysis ──────────────────────────────

/**
 * After a sell, we store the next N price ticks for that stock.
 * Then we can tell the user what would have happened if they held.
 * Now returns multiple checkpoint results for a richer analysis.
 */
export function generateCounterfactual(
  sellPrice: number,
  buyPrice: number,
  priceHistoryAfterSell: number[],
): string | undefined {
  if (!priceHistoryAfterSell || priceHistoryAfterSell.length < 3) return undefined;

  // Look at price after ~5, 10, and max available ticks
  const checkpoints = [
    { ticks: 5, label: "~20 seconds" },
    { ticks: 10, label: "~40 seconds" },
    { ticks: Math.min(priceHistoryAfterSell.length, 20), label: "~1 minute" },
  ];

  const results: string[] = [];
  const sellProfitLoss = sellPrice - buyPrice;

  for (const cp of checkpoints) {
    const futurePrice = priceHistoryAfterSell[Math.min(cp.ticks - 1, priceHistoryAfterSell.length - 1)];
    if (futurePrice === undefined) continue;

    const hypotheticalPL = futurePrice - buyPrice;

    if (hypotheticalPL > sellProfitLoss) {
      const improvement = hypotheticalPL - sellProfitLoss;
      const improvementPct = ((improvement / buyPrice) * 100).toFixed(1);
      results.push(
        `If you held for ${cp.label} more, your ${sellProfitLoss < 0 ? "loss" : "gain"} would have improved by ₹${Math.abs(Math.round(improvement)).toLocaleString("en-IN")} (${improvementPct}%).`,
      );
    } else if (hypotheticalPL < sellProfitLoss) {
      results.push(
        `Holding ${cp.label} longer would have worsened your result. Your sell timing was reasonable.`,
      );
    }
  }

  if (results.length === 0) return undefined;

  // If all checkpoints say holding was better, emphasize patience
  const betterCount = results.filter((r) => r.includes("improved")).length;
  if (betterCount === results.length && betterCount >= 2) {
    return results[results.length - 1] + " Patience would have paid off here.";
  }

  // Return the most interesting one (the last checkpoint)
  return results[results.length - 1];
}

// ─── Frequent trading detection ───────────────────────────

export function isFrequentTrader(trades: Trade[], windowTicks: number = 20): boolean {
  if (trades.length < 6) return false;
  const latestTime = trades[0]?.timeIndex || 0;
  const recentTrades = trades.filter(
    (t) => t.timeIndex >= latestTime - windowTicks,
  );
  // More than 6 trades in the last ~60-80 seconds = frequent
  return recentTrades.length >= 6;
}

// ─── Win/Loss streak ──────────────────────────────────────

function analyzeStreak(sellEvents: SellEvent[]): { streak: number; type: "win" | "loss" | "none" } {
  if (sellEvents.length === 0) return { streak: 0, type: "none" };

  let streak = 0;
  const firstType = (sellEvents[0]?.profit_or_loss || 0) >= 0 ? "win" : "loss";

  for (const event of sellEvents) {
    const isWin = event.profit_or_loss >= 0;
    if ((firstType === "win" && isWin) || (firstType === "loss" && !isWin)) {
      streak++;
    } else {
      break;
    }
  }

  return { streak, type: firstType };
}

// ─── Hold duration analysis ───────────────────────────────

function analyzeHoldDuration(sellEvents: SellEvent[]): { avgDuration: number; tooShort: boolean } {
  const durations = sellEvents
    .filter((e) => e.buyTimeIndex !== undefined)
    .map((e) => e.time - (e.buyTimeIndex || 0));

  if (durations.length === 0) return { avgDuration: 0, tooShort: false };

  const avg = durations.reduce((s, v) => s + v, 0) / durations.length;
  return { avgDuration: avg, tooShort: avg < 3 }; // Less than 3 ticks (~12 seconds)
}

// ─── Win rate calculation ─────────────────────────────────

function calculateWinRate(sellEvents: SellEvent[]): number {
  if (sellEvents.length === 0) return 0;
  const wins = sellEvents.filter((e) => e.profit_or_loss >= 0).length;
  return (wins / sellEvents.length) * 100;
}

// ─── Sell during dip vs recovery ──────────────────────────

function analyzeSellTiming(event: SellEvent, _stocks: StockView[]): string | undefined {
  if (!event.trendAtSell) return undefined;

  if (event.trendAtSell === "down" && event.profit_or_loss < 0) {
    return "You sold during a downtrend at a loss. Historically, markets often recover after short-term declines. Consider setting a mental stop-loss level before entering a trade.";
  }
  if (event.trendAtSell === "up" && event.profit_or_loss > 0) {
    return "Good timing — you sold during an uptrend and locked in profit. Consider if the trend could have continued for more gains.";
  }
  if (event.trendAtSell === "up" && event.profit_or_loss < 0) {
    return "The market was recovering when you sold at a loss. Waiting a bit longer during an uptrend might have recovered your position.";
  }
  return undefined;
}

// ─── Insight generation ──────────────────────────────────

export function getInsight(
  user: SimulatorUser,
  totalProfitLoss: number,
  stocks: StockView[],
): Insight {
  const lastBehavior = user.behaviorLog[0];
  const lastSellEvent = user.sellEvents[0];
  const lastSixTradeResult = user.tradeHistory
    .slice(0, 6)
    .reduce((total, trade) => total + (trade.profitOrLoss || 0), 0);

  const frequent = isFrequentTrader(user.tradeHistory);
  const streakInfo = analyzeStreak(user.sellEvents);
  const holdInfo = analyzeHoldDuration(user.sellEvents);
  const winRate = calculateWinRate(user.sellEvents);

  // Counterfactual from last sell
  let counterfactual: string | undefined;
  if (lastSellEvent?.priceSnapshotAfterSell) {
    counterfactual = generateCounterfactual(
      lastSellEvent.sell_price,
      lastSellEvent.buy_price,
      lastSellEvent.priceSnapshotAfterSell,
    );
  }

  // Build additional insights
  const additionalInsights: string[] = [];

  // Streak insight
  if (streakInfo.streak >= 3) {
    if (streakInfo.type === "loss") {
      additionalInsights.push(
        `You're on a ${streakInfo.streak}-trade losing streak. Consider pausing and observing the market before your next trade.`
      );
    } else if (streakInfo.type === "win") {
      additionalInsights.push(
        `${streakInfo.streak} wins in a row! But don't let confidence lead to overtrading. Stay disciplined.`
      );
    }
  }

  // Hold duration insight
  if (holdInfo.tooShort && user.sellEvents.length >= 3) {
    additionalInsights.push(
      "Your average hold duration is very short. Quick trades often mean emotional decisions. Try holding positions for at least a few market ticks."
    );
  }

  // Win rate insight
  if (user.sellEvents.length >= 5) {
    if (winRate < 35) {
      additionalInsights.push(
        `Your win rate is ${winRate.toFixed(0)}%. Focus on entry timing — buy when the trend is neutral or rising, not during active selloffs.`
      );
    } else if (winRate > 70) {
      additionalInsights.push(
        `Strong ${winRate.toFixed(0)}% win rate! Your timing instincts are developing well. Watch for overconfidence.`
      );
    }
  }

  // Sell timing analysis
  if (lastSellEvent) {
    const timingInsight = analyzeSellTiming(lastSellEvent, stocks);
    if (timingInsight) additionalInsights.push(timingInsight);
  }

  if (frequent) {
    return {
      performance: lastSixTradeResult,
      behavior: "You are trading frequently, which may indicate reactive behavior.",
      suggestion:
        "Frequent trades increase emotional decision-making. Try holding positions longer and observe the trend before acting.",
      counterfactual,
      frequentTrading: true,
      additionalInsights,
      winRate,
      avgHoldDuration: holdInfo.avgDuration,
    };
  }

  if (lastBehavior?.behavior === "Panic Sell") {
    return {
      performance: lastSixTradeResult,
      behavior: "You sold during a dip in the last trade.",
      suggestion:
        "Markets often recover after short-term drops. Historically, patience during dips leads to better outcomes. Pause before reacting to fear.",
      counterfactual,
      additionalInsights,
      winRate,
      avgHoldDuration: holdInfo.avgDuration,
    };
  }

  if (lastSellEvent) {
    const wasProfit = lastSellEvent.profit_or_loss >= 0;
    return {
      performance: lastSixTradeResult,
      behavior: wasProfit
        ? "Your last exit locked in a profit. Good timing matters."
        : "Your last exit was at a loss. Review your entry timing.",
      suggestion: wasProfit
        ? "Consider whether holding longer could have yielded more. Plan-based exits are usually better than reactive ones."
        : "Review why you sold: was it fear or a planned stop-loss? Plan-based exits are usually better than emotion-based exits.",
      counterfactual,
      additionalInsights,
      winRate,
      avgHoldDuration: holdInfo.avgDuration,
    };
  }

  return {
    performance: totalProfitLoss,
    behavior: user.tradeHistory.length
      ? "You are building market experience through small decisions."
      : "No behavior pattern yet. Make a few trades to generate insights.",
    suggestion:
      "Watch the chart during dips and recoveries before deciding whether to sell.",
    counterfactual,
    additionalInsights,
    winRate,
    avgHoldDuration: holdInfo.avgDuration,
  };
}
