import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  ChevronRight,
  Clock,
  Gauge,
  History,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Moon,
  Newspaper,
  ShieldCheck,
  Sun,
  Target,
  TrendingDown,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

// ─── Engine imports ────────────────────────────────────────
import {
  type StockView,
  type Trend,
  type MarketSentiment,
  STOCKS,
  initializeMarketStocks,
  updateMarketStocks,
  findStock,
  getRandomTickInterval,
  computeMarketSentiment,
} from "@/lib/market-engine";
import {
  type NewsItem,
  type NewsUrgency,
  NEWS_DATABASE,
  selectMarketEvent,
  buildMarketAlert,
  getNextEventTicks,
  getContextualAlert,
} from "@/lib/news-engine";
import {
  type Trade,
  type BehaviorLog,
  type SellEvent,
  type PortfolioItem,
  type SimulatorUser,
  type Insight,
  INITIAL_BALANCE,
  makeId,
  getInsight,
  generateCounterfactual,
  isFrequentTrader,
} from "@/lib/learning-engine";

type Screen = "dashboard" | "portfolio" | "history" | "insights";
type AuthMode = "login" | "signup";
type ThemeMode = "light" | "dark";

/** Tracks post-sell price data for counterfactual analysis */
type CounterfactualTracker = {
  id: string;
  stockId: string;
  buyPrice: number;
  sellPrice: number;
  sellTimeIndex: number;
  priceSnapshots: number[];
};

type PortfolioRow = PortfolioItem & {
  stockName: string;
  currentPrice: number;
  currentValue: number;
  investedValue: number;
  profitLoss: number;
  profitLossPercent: number;
};

const STORAGE_KEY = "investment-simulator-users-v2";
const SESSION_KEY = "investment-simulator-session-v2";


function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function loadUsers(): Record<string, SimulatorUser> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveUsers(users: Record<string, SimulatorUser>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function createUser(username: string, password: string): SimulatorUser {
  return {
    username,
    password,
    balance: INITIAL_BALANCE,
    portfolio: {},
    tradeHistory: [],
    behaviorLog: [],
    sellEvents: [],
  };
}


export default function Home() {
  const { toast } = useToast();
  const [users, setUsers] = useState<Record<string, SimulatorUser>>(() => loadUsers());
  const [currentUsername, setCurrentUsername] = useState<string>(() => localStorage.getItem(SESSION_KEY) || "");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [timeIndex, setTimeIndex] = useState(0);
  const [selectedStockId, setSelectedStockId] = useState(STOCKS[0]?.id || "");
  const [stocks, setStocks] = useState<StockView[]>(() => initializeMarketStocks());
  const [activeNews, setActiveNews] = useState<NewsItem[]>([]);
  const [marketAlert, setMarketAlert] = useState("Live market engine warming up");
  const [nextEventAt, setNextEventAt] = useState(() => getNextEventTicks());
  const [cfTrackers, setCfTrackers] = useState<CounterfactualTracker[]>([]);
  const [sentiment, setSentiment] = useState<MarketSentiment>("neutral");
  const tickTimeoutRef = useRef<number | null>(null);

  const currentUser = currentUsername ? users[currentUsername] : undefined;

  // Variable-interval tick loop (3-5 seconds per tick)
  useEffect(() => {
    if (!currentUser) return;

    const tick = () => {
      setTimeIndex((previous) => {
        const nextTimeIndex = previous + 1;
        const shouldTriggerEvent = nextTimeIndex >= nextEventAt;

        setStocks((previousStocks) => {
          const event = shouldTriggerEvent ? selectMarketEvent(previousStocks, nextTimeIndex) : undefined;
          const updatedStocks = updateMarketStocks(previousStocks, nextTimeIndex, event);

          // Update market sentiment
          setSentiment(computeMarketSentiment(updatedStocks));

          if (event) {
            setActiveNews((previousNews) => [event, ...previousNews].slice(0, 10));
            setMarketAlert(buildMarketAlert(event));
            setNextEventAt(nextTimeIndex + getNextEventTicks());
          } else {
            // Use contextual alerts between events
            setMarketAlert((prev) => getContextualAlert(updatedStocks, prev));
          }

          // Update counterfactual trackers with current prices
          setCfTrackers((prev) =>
            prev
              .map((tracker) => {
                const s = updatedStocks.find((st) => st.id === tracker.stockId);
                if (!s || tracker.priceSnapshots.length >= 20) return tracker;
                return { ...tracker, priceSnapshots: [...tracker.priceSnapshots, s.currentPrice] };
              })
              .filter((tracker) => tracker.priceSnapshots.length <= 20),
          );

          return updatedStocks;
        });

        return nextTimeIndex;
      });

      // Schedule next tick with variable interval (3-5 seconds)
      tickTimeoutRef.current = window.setTimeout(tick, getRandomTickInterval());
    };

    // Start first tick
    tickTimeoutRef.current = window.setTimeout(tick, getRandomTickInterval());

    return () => {
      if (tickTimeoutRef.current) window.clearTimeout(tickTimeoutRef.current);
    };
  }, [currentUser, nextEventAt]);

  useEffect(() => {
    saveUsers(users);
  }, [users]);

  const selectedStock = stocks.find((stock) => stock.id === selectedStockId) || stocks[0];
  const marketAverageChange = stocks.reduce((total, stock) => total + stock.percentChange, 0) / Math.max(stocks.length, 1);
  const marketPhase = marketAverageChange <= -1.8 ? "dip" : marketAverageChange >= 1.6 ? "recovery" : "normal";

  const updateCurrentUser = (updater: (user: SimulatorUser) => SimulatorUser) => {
    if (!currentUser) return;
    setUsers((previous) => ({
      ...previous,
      [currentUser.username]: updater(previous[currentUser.username] || currentUser),
    }));
  };

  const handleAuth = () => {
    const username = authUsername.trim();
    const password = authPassword.trim();

    if (!username || !password) {
      toast({ title: "Enter username and password", description: "Both fields are needed to continue.", variant: "destructive" });
      return;
    }

    if (authMode === "signup") {
      if (users[username]) {
        toast({ title: "Username already exists", description: "Try logging in or choose another username.", variant: "destructive" });
        return;
      }
      const nextUser = createUser(username, password);
      setUsers((previous) => ({ ...previous, [username]: nextUser }));
      setCurrentUsername(username);
      localStorage.setItem(SESSION_KEY, username);
      setAuthUsername("");
      setAuthPassword("");
      toast({ title: "Account created", description: "You have ₹100,000 in virtual cash to begin learning." });
      return;
    }

    const user = users[username];
    if (!user || user.password !== password) {
      toast({ title: "Login failed", description: "Check your username and password.", variant: "destructive" });
      return;
    }

    setCurrentUsername(username);
    localStorage.setItem(SESSION_KEY, username);
    setAuthUsername("");
    setAuthPassword("");
    toast({ title: "Welcome back", description: "Your simulator progress has been loaded." });
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setCurrentUsername("");
    setScreen("dashboard");
    toast({ title: "Logged out", description: "Your progress is saved on this device." });
  };

  const buyStock = (stock: StockView) => {
    if (!currentUser) return;
    if (currentUser.balance < stock.currentPrice) {
      toast({ title: "Not enough balance", description: `You need ${formatCurrency(stock.currentPrice)} to buy ${stock.name}.`, variant: "destructive" });
      return;
    }

    updateCurrentUser((user) => {
      const existing = user.portfolio[stock.id] || { stockId: stock.id, quantity: 0, averageBuyPrice: 0 };
      const nextQuantity = existing.quantity + 1;
      const nextAverage = Math.round(((existing.quantity * existing.averageBuyPrice) + stock.currentPrice) / nextQuantity);
      const trade: Trade = {
        id: makeId("trade"),
        type: "BUY",
        stockId: stock.id,
        stockName: stock.name,
        price: stock.currentPrice,
        quantity: 1,
        timeIndex,
        createdAt: new Date().toISOString(),
        trendAtTrade: stock.trend,
      };

      return {
        ...user,
        balance: user.balance - stock.currentPrice,
        portfolio: {
          ...user.portfolio,
          [stock.id]: {
            stockId: stock.id,
            quantity: nextQuantity,
            averageBuyPrice: nextAverage,
            firstBuyTimeIndex: existing.firstBuyTimeIndex ?? timeIndex,
          },
        },
        tradeHistory: [trade, ...user.tradeHistory],
      };
    });

    toast({ title: "Bought 1 share", description: `${stock.name} was added at ${formatCurrency(stock.currentPrice)}.` });
  };

  const sellStock = (stock: StockView) => {
    if (!currentUser) return;
    const holding = currentUser.portfolio[stock.id];
    if (!holding || holding.quantity <= 0) {
      toast({ title: "No shares to sell", description: `You do not own ${stock.name} yet.`, variant: "destructive" });
      return;
    }

    const profitOrLoss = stock.currentPrice - holding.averageBuyPrice;
    const isAfterRecentDip = stock.recentDipIndex >= 0 && timeIndex - stock.recentDipIndex <= 3;
    const behavior: "Panic Sell" | "Normal Sell" = isAfterRecentDip ? "Panic Sell" : "Normal Sell";
    const message = behavior === "Panic Sell"
      ? "You sold during a dip. Historically, markets recover after such drops."
      : "You exited your position. Long-term investing often requires patience.";

    updateCurrentUser((user) => {
      const existing = user.portfolio[stock.id] || holding;
      const nextQuantity = Math.max(0, existing.quantity - 1);
      const nextPortfolio = { ...user.portfolio, [stock.id]: { ...existing, quantity: nextQuantity } };
      if (nextQuantity === 0) delete nextPortfolio[stock.id];

      const trade: Trade = {
        id: makeId("trade"),
        type: "SELL",
        stockId: stock.id,
        stockName: stock.name,
        price: stock.currentPrice,
        quantity: 1,
        timeIndex,
        createdAt: new Date().toISOString(),
        profitOrLoss,
        label: behavior,
        trendAtTrade: stock.trend,
      };
      const behaviorEntry: BehaviorLog = {
        id: makeId("behavior"),
        stockId: stock.id,
        behavior,
        message,
        timeIndex,
        profitOrLoss,
      };
      const sellEvent: SellEvent = {
        action: "SELL",
        stock: stock.id,
        buy_price: existing.averageBuyPrice,
        sell_price: stock.currentPrice,
        profit_or_loss: profitOrLoss,
        behavior,
        time: timeIndex,
        buyTimeIndex: existing.firstBuyTimeIndex,
        trendAtSell: stock.trend as Trend,
      };

      // Start tracking counterfactual for this sell
      setCfTrackers((prev) => [
        {
          id: makeId("cf"),
          stockId: stock.id,
          buyPrice: existing.averageBuyPrice,
          sellPrice: stock.currentPrice,
          sellTimeIndex: timeIndex,
          priceSnapshots: [],
        },
        ...prev.slice(0, 4),
      ]);

      return {
        ...user,
        balance: user.balance + stock.currentPrice,
        portfolio: nextPortfolio,
        tradeHistory: [trade, ...user.tradeHistory],
        behaviorLog: [behaviorEntry, ...user.behaviorLog],
        sellEvents: [sellEvent, ...user.sellEvents],
      };
    });

    toast({
      title: behavior,
      description: message,
      variant: behavior === "Panic Sell" ? "destructive" : "default",
      duration: 8000,
    });
  };

  const portfolioRows = useMemo<PortfolioRow[]>(() => {
    if (!currentUser) return [];
    return Object.values(currentUser.portfolio).map((holding) => {
      const stock = stocks.find((item) => item.id === holding.stockId);
      const currentPrice = stock?.currentPrice || 0;
      const currentValue = currentPrice * holding.quantity;
      const investedValue = holding.averageBuyPrice * holding.quantity;
      const profitLoss = currentValue - investedValue;
      return {
        ...holding,
        stockName: stock?.name || holding.stockId,
        currentPrice,
        currentValue,
        investedValue,
        profitLoss,
        profitLossPercent: investedValue ? (profitLoss / investedValue) * 100 : 0,
      };
    });
  }, [currentUser, stocks]);

  const portfolioValue = portfolioRows.reduce((total, row) => total + row.currentValue, 0);
  const investedValue = portfolioRows.reduce((total, row) => total + row.investedValue, 0);
  const totalProfitLoss = portfolioValue - investedValue;
  const netWorth = (currentUser?.balance || 0) + portfolioValue;

  const chartData = selectedStock
    ? selectedStock.history.map((price, index) => ({ time: `T${Math.max(1, timeIndex - selectedStock.history.length + index + 2)}`, price }))
    : [];

  // Compute insight with counterfactual from trackers
  const latestCf = cfTrackers.find((t) => t.priceSnapshots.length >= 3);
  const insight = useMemo<Insight | undefined>(() => {
    if (!currentUser) return undefined;
    const base = getInsight(currentUser, totalProfitLoss, stocks);
    // Overlay counterfactual from live tracker if available
    if (latestCf && latestCf.priceSnapshots.length >= 3) {
      const cfResult = generateCounterfactual(latestCf.sellPrice, latestCf.buyPrice, latestCf.priceSnapshots);
      if (cfResult) base.counterfactual = cfResult;
    }
    return base;
  }, [currentUser, totalProfitLoss, stocks, latestCf?.priceSnapshots.length]);
  const rotatedNews = useMemo(() => {
    const selectedSector = selectedStock?.sector || "Market";
    const fallback = `${selectedStock?.name || "Market"} ${selectedStock?.percentChange && selectedStock.percentChange < 0 ? "faces pressure" : "shows momentum"} as ${selectedSector.toLowerCase()} sentiment shifts`;
    const neutralNews = NEWS_DATABASE
      .filter((news) => news.stock === selectedStock?.id && news.type === "neutral")
      .slice(0, 4)
      .map((news) => news.headline);
    return [...activeNews.map((news) => news.headline), fallback, ...neutralNews].slice(0, 5);
  }, [activeNews, selectedStock]);

  if (!currentUser) {
    return (
      <div className={`${theme === "dark" ? "dark" : ""}`}>
        <div className="min-h-[100dvh] overflow-hidden bg-background text-foreground">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,hsl(var(--primary)/0.20),transparent_32%),radial-gradient(circle_at_80%_0%,hsl(var(--success)/0.12),transparent_28%)]" />
          <div className="relative mx-auto grid min-h-[100dvh] max-w-6xl items-center gap-8 px-5 py-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-7">
              <Badge className="border border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">Beginner finance dashboard</Badge>
              <div className="space-y-5">
                <h1 className="max-w-3xl text-5xl font-black tracking-[-0.04em] text-foreground md:text-7xl">InvestSim</h1>
                <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                  A premium market simulator for practicing decisions with virtual money, live charts, simulated news, and behavior insights.
                </p>
              </div>
              <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
                <FeatureCard icon={<ShieldCheck className="h-5 w-5" />} title="Risk free" text="No real money or stock tips." />
                <FeatureCard icon={<Activity className="h-5 w-5" />} title="Live movement" text="Prices update every few seconds." />
                <FeatureCard icon={<Lightbulb className="h-5 w-5" />} title="Behavior first" text="Learn from panic and patience." />
              </div>
            </div>

            <Card className="glass-card border-white/10 shadow-2xl shadow-primary/10">
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl">{authMode === "login" ? "Log in" : "Create account"}</CardTitle>
                  <CardDescription>{authMode === "login" ? "Continue your local simulator progress." : "Start with ₹100,000 in virtual cash."}</CardDescription>
                </div>
                <Button size="icon" variant="outline" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </CardHeader>
              <CardContent className="space-y-5">
                <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); handleAuth(); }}>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" autoComplete="username" value={authUsername} onChange={(event) => setAuthUsername(event.target.value)} placeholder="student_user" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Enter password" />
                  </div>
                  <Button className="w-full" size="lg" type="submit">{authMode === "login" ? "Log in" : "Sign up"}</Button>
                </form>
                <Button className="w-full" variant="ghost" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}>
                  {authMode === "login" ? "New here? Sign up" : "Already have an account? Log in"}
                </Button>
                <p className="rounded-2xl border bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                  Account data is stored locally on this device for learning simulation only. Do not use a sensitive password.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${theme === "dark" ? "dark" : ""}`}>
      <div className="min-h-[100dvh] bg-background text-foreground">
        <div className="grid min-h-[100dvh] lg:grid-cols-[248px_minmax(0,1fr)]">
          <Sidebar screen={screen} setScreen={setScreen} logout={logout} />

          <div className="min-w-0">
            <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-xl">
              <div className="flex flex-col gap-4 px-4 py-4 xl:flex-row xl:items-center xl:justify-between xl:px-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">Market time T{timeIndex + 1}</p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight">{screen === "dashboard" ? "Dashboard" : screen === "portfolio" ? "Portfolio" : screen === "history" ? "Trade History" : "Learning Insights"}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <TopMetric title="Cash" value={formatCurrency(currentUser.balance)} />
                  <TopMetric title="Net Worth" value={formatCurrency(netWorth)} />
                  <TopMetric title="P/L" value={`${totalProfitLoss >= 0 ? "+" : ""}${formatCurrency(totalProfitLoss)}`} valueClassName={totalProfitLoss >= 0 ? "text-success" : "text-destructive"} />
                  <Button size="icon" variant="outline" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </header>

            <main className="space-y-5 px-4 py-5 xl:px-6">
              {screen === "dashboard" && (
                <DashboardScreen
                  stocks={stocks}
                  selectedStock={selectedStock}
                  selectedStockId={selectedStockId}
                  setSelectedStockId={setSelectedStockId}
                  portfolio={currentUser.portfolio}
                  chartData={chartData}
                  marketPhase={marketPhase}
                  buyStock={buyStock}
                  sellStock={sellStock}
                  news={rotatedNews}
                  activeNews={activeNews}
                  marketAlert={marketAlert}
                  insight={insight}
                  sentiment={sentiment}
                />
              )}

              {screen === "portfolio" && <PortfolioScreen rows={portfolioRows} portfolioValue={portfolioValue} totalProfitLoss={totalProfitLoss} />}
              {screen === "history" && <HistoryScreen trades={currentUser.tradeHistory} behaviorLog={currentUser.behaviorLog} />}
              {screen === "insights" && <InsightsScreen insight={insight} behaviorLog={currentUser.behaviorLog} trades={currentUser.tradeHistory} news={rotatedNews} activeNews={activeNews} />}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <Card className="glass-card border-white/10">
      <CardContent className="p-4">
        <div className="mb-3 text-primary">{icon}</div>
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

function Sidebar({ screen, setScreen, logout }: { screen: Screen; setScreen: (screen: Screen) => void; logout: () => void }) {
  const items: Array<{ id: Screen; label: string; icon: ReactNode }> = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "portfolio", label: "Portfolio", icon: <Briefcase className="h-4 w-4" /> },
    { id: "history", label: "Trade History", icon: <History className="h-4 w-4" /> },
    { id: "insights", label: "Learning Insights", icon: <Lightbulb className="h-4 w-4" /> },
  ];

  return (
    <aside className="border-b bg-card/70 p-4 backdrop-blur-xl lg:sticky lg:top-0 lg:h-[100dvh] lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col gap-6">
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-black tracking-tight">InvestSim</p>
            <p className="text-xs text-muted-foreground">Learning market desk</p>
          </div>
        </div>

        <nav className="grid gap-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              className={`flex items-center justify-between rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${screen === item.id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/15" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <span className="flex items-center gap-3">{item.icon}{item.label}</span>
              {screen === item.id && <ChevronRight className="h-4 w-4" />}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-3xl border bg-background/60 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Mode</p>
            <p className="mt-2 text-sm font-semibold">Simulation only</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">No real trades, real APIs, or investment advice.</p>
          </div>
          <Button variant="outline" className="w-full justify-start" onClick={logout}><LogOut className="mr-2 h-4 w-4" />Logout</Button>
        </div>
      </div>
    </aside>
  );
}

function TopMetric({ title, value, valueClassName = "" }: { title: string; value: string; valueClassName?: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-2 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <p className={`text-sm font-black ${valueClassName}`}>{value}</p>
    </div>
  );
}

function DashboardScreen({
  stocks,
  selectedStock,
  selectedStockId,
  setSelectedStockId,
  portfolio,
  chartData,
  marketPhase,
  buyStock,
  sellStock,
  news,
  activeNews,
  marketAlert,
  insight,
  sentiment,
}: {
  stocks: StockView[];
  selectedStock?: StockView;
  selectedStockId: string;
  setSelectedStockId: (stockId: string) => void;
  portfolio: Record<string, PortfolioItem>;
  chartData: { time: string; price: number }[];
  marketPhase: "dip" | "recovery" | "normal";
  buyStock: (stock: StockView) => void;
  sellStock: (stock: StockView) => void;
  news: string[];
  activeNews: NewsItem[];
  marketAlert: string;
  insight?: Insight;
  sentiment: MarketSentiment;
}) {
  if (!selectedStock) return null;
  const isPositive = selectedStock.percentChange >= 0;
  const holding = portfolio[selectedStock.id];
  const canSell = Boolean(holding?.quantity);

  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0 space-y-5">
        <Card className="market-hero overflow-hidden border-white/10">
          <CardContent className="space-y-5 p-5 md:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className="bg-background/60">{selectedStock.sector}</Badge>
                  <Badge className={marketPhase === "dip" ? "bg-destructive/15 text-destructive hover:bg-destructive/15" : marketPhase === "recovery" ? "bg-success/15 text-success hover:bg-success/15" : "bg-primary/15 text-primary hover:bg-primary/15"}>
                    {marketPhase === "dip" ? "Market dip" : marketPhase === "recovery" ? "Recovery" : "Live market"}
                  </Badge>
                  <Badge variant="outline" className="bg-background/60 capitalize">Trend: {selectedStock.trend}</Badge>
                  <Badge variant="outline" className={`bg-background/60 ${sentiment === "bullish" ? "text-success" : sentiment === "bearish" ? "text-destructive" : sentiment === "volatile" ? "text-warning" : "text-muted-foreground"}`}>
                    <span className={`mr-1.5 inline-block h-2 w-2 rounded-full live-dot ${sentiment === "bullish" ? "bg-success" : sentiment === "bearish" ? "bg-destructive" : sentiment === "volatile" ? "bg-warning" : "bg-muted-foreground"}`} />
                    {sentiment === "bullish" ? "Bullish" : sentiment === "bearish" ? "Bearish" : sentiment === "volatile" ? "Volatile" : "Neutral"}
                  </Badge>
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">{selectedStock.name}</h2>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <p className={`rounded-2xl px-2 text-4xl font-black tracking-tight ${selectedStock.lastMove === "up" ? "price-flash-up" : selectedStock.lastMove === "down" ? "price-flash-down" : ""}`}>{formatCurrency(selectedStock.currentPrice)}</p>
                  <p className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    {isPositive ? "+" : ""}{selectedStock.percentChange.toFixed(2)}%
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>H: <span className="font-bold text-success">{formatCurrency(selectedStock.sessionHigh)}</span></span>
                  <span>L: <span className="font-bold text-destructive">{formatCurrency(selectedStock.sessionLow)}</span></span>
                  <span>Vol: <span className="font-bold">{selectedStock.observedVolatility.toFixed(2)}%</span></span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button size="lg" className="min-w-28" onClick={() => buyStock(selectedStock)}>Buy</Button>
                <Button size="lg" variant="outline" className="min-w-28 bg-background/70" disabled={!canSell} onClick={() => sellStock(selectedStock)}>Sell</Button>
              </div>
            </div>
            <div className={`flex items-center gap-3 rounded-2xl border bg-background/55 px-4 py-3 text-sm font-semibold ${marketAlert.includes("BREAKING") ? "alert-urgent border-destructive/30 bg-destructive/5" : marketAlert.includes("⚠") ? "alert-pulse border-warning/30" : ""}`}>
              <Bell className={`h-4 w-4 ${marketAlert.includes("BREAKING") ? "text-destructive" : "text-primary"}`} />
              <span>{marketAlert}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {stocks.map((stock) => (
                <button
                  key={stock.id}
                  onClick={() => setSelectedStockId(stock.id)}
                  className={`stock-card rounded-2xl border p-4 text-left ${selectedStockId === stock.id ? "border-primary bg-primary/10 shadow-lg shadow-primary/10" : "bg-background/65 hover:bg-background"} ${stock.lastMove === "up" ? "price-flash-up" : stock.lastMove === "down" ? "price-flash-down" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-black">{stock.name}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">{stock.id}</p>
                        {stock.trend !== "neutral" && (
                          <span className={`text-[10px] font-bold uppercase ${stock.trend === "up" ? "text-success" : "text-destructive"}`}>
                            {stock.trend === "up" ? "▲" : "▼"}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={stock.percentChange >= 0 ? "text-xs font-bold text-success" : "text-xs font-bold text-destructive"}>{stock.percentChange >= 0 ? "+" : ""}{stock.percentChange.toFixed(1)}%</span>
                  </div>
                  <p className="mt-3 text-lg font-black">{formatCurrency(stock.currentPrice)}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="chart-card overflow-hidden">
          <CardHeader className="flex-col gap-3 border-b md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Price vs Time</CardTitle>
              <CardDescription>Hover the graph to inspect simulated values. It updates live with the market clock.</CardDescription>
            </div>
            <Badge variant="outline" className="w-fit">{chartData.length} time points</Badge>
          </CardHeader>
          <CardContent className="h-[430px] p-4 md:p-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 18, left: 0, bottom: 12 }}>
                <defs>
                  <linearGradient id="premiumPriceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(value) => `₹${formatNumber(Number(value))}`} width={74} axisLine={false} tickLine={false} />
                <ChartTooltip
                  formatter={(value) => [formatCurrency(Number(value)), "Price"]}
                  contentStyle={{ borderRadius: 16, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
                />
                <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#premiumPriceFill)" activeDot={{ r: 6, strokeWidth: 2 }} animationDuration={400} animationEasing="ease-out" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard title="Tick change" value={`${isPositive ? "+" : ""}${selectedStock.percentChange.toFixed(2)}%`} tone={isPositive ? "positive" : "negative"} icon={<Activity className="h-5 w-5" />} />
          <StatCard title="Total trend" value={`${selectedStock.totalTrend >= 0 ? "+" : ""}${selectedStock.totalTrend.toFixed(2)}%`} tone={selectedStock.totalTrend >= 0 ? "positive" : "negative"} icon={<TrendingUp className="h-5 w-5" />} />
          <StatCard title="Volatility" value={`${selectedStock.observedVolatility.toFixed(2)}%`} tone="neutral" icon={<Gauge className="h-5 w-5" />} />
          <StatCard title="Momentum" value={`${selectedStock.momentum >= 0 ? "+" : ""}${(selectedStock.momentum * 100).toFixed(2)}%`} tone={selectedStock.momentum >= 0 ? "positive" : "negative"} icon={<TrendingDown className="h-5 w-5" />} />
        </div>
      </section>

      <RightPanel news={news} activeNews={activeNews} insight={insight} marketAlert={marketAlert} />
    </div>
  );
}

function StatCard({ title, value, tone, icon }: { title: string; value: string; tone: "positive" | "negative" | "neutral"; icon: ReactNode }) {
  const toneClass = tone === "positive" ? "text-success bg-success/10" : tone === "negative" ? "text-destructive bg-destructive/10" : "text-primary bg-primary/10";
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          <p className={`mt-2 text-2xl font-black ${tone === "positive" ? "text-success" : tone === "negative" ? "text-destructive" : ""}`}>{value}</p>
        </div>
        <div className={`rounded-2xl p-3 ${toneClass}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}

function RightPanel({ news, activeNews, insight, marketAlert }: { news: string[]; activeNews: NewsItem[]; marketAlert?: string; insight?: Insight }) {
  // Map headlines to their urgency from activeNews
  const urgencyMap = new Map<string, NewsUrgency>();
  for (const item of activeNews) {
    urgencyMap.set(item.headline, item.urgency);
  }

  return (
    <aside className="space-y-5">
      {marketAlert && (
        <Card className={`${marketAlert.includes("BREAKING") ? "border-destructive/30 bg-destructive/5 alert-urgent" : "border-primary/20 bg-primary/5"}`}>
          <CardContent className="flex items-start gap-3 p-4">
            <Bell className={`mt-0.5 h-5 w-5 ${marketAlert.includes("BREAKING") ? "text-destructive" : "text-primary"}`} />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Market alert</p>
              <p className="mt-1 text-sm font-bold">{marketAlert}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Newspaper className="h-5 w-5 text-primary" />Market News</CardTitle>
          <CardDescription>Simulated headlines that create realistic market context.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {news.slice(0, 5).map((headline, index) => {
            const urgency = urgencyMap.get(headline);
            const urgencyClass = index === 0
              ? (urgency === "breaking" ? "news-breaking" : urgency === "flash" ? "news-flash" : "news-highlight")
              : "";
            return (
              <div key={`${headline}-${index}`} className={`news-slide-in rounded-2xl border bg-background/55 p-4 transition hover:bg-muted/50 ${urgencyClass}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Market</Badge>
                    {urgency === "breaking" && <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15 text-[10px]">BREAKING</Badge>}
                    {urgency === "flash" && <Badge className="bg-warning/15 text-warning hover:bg-warning/15 text-[10px]">FLASH</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">T-{index + 1}</span>
                </div>
                <p className="text-sm font-semibold leading-6">{headline}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="insight-card overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5" />AI Learning Insights</CardTitle>
          <CardDescription>Behavior-focused guidance from your trading decisions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-background/65 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Recent Performance</p>
            <p className={`mt-2 text-3xl font-black ${(insight?.performance || 0) >= 0 ? "text-success" : "text-destructive"}`}>{(insight?.performance || 0) >= 0 ? "+" : ""}{formatCurrency(insight?.performance || 0)}</p>
            {insight?.winRate !== undefined && insight.winRate > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Win rate: <span className="font-bold">{insight.winRate.toFixed(0)}%</span></p>
            )}
          </div>
          {insight?.frequentTrading && (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-warning">⚡ Frequent Trading</p>
              <p className="mt-2 text-sm font-semibold leading-6">You are making many trades in a short period. This may indicate reactive behavior.</p>
            </div>
          )}
          <div className="rounded-2xl border bg-background/65 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Behavior Insight</p>
            <p className="mt-2 text-sm font-semibold leading-6">{insight?.behavior}</p>
          </div>
          <div className="rounded-2xl border bg-background/65 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Suggestion</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{insight?.suggestion}</p>
          </div>
          {insight?.additionalInsights && insight.additionalInsights.length > 0 && (
            <div className="space-y-2">
              {insight.additionalInsights.map((ai, idx) => (
                <div key={idx} className="rounded-2xl border border-accent/40 bg-accent/5 p-3">
                  <p className="text-xs font-semibold leading-5">{ai}</p>
                </div>
              ))}
            </div>
          )}
          {insight?.counterfactual && (
            <div className="cf-card rounded-2xl border border-primary/25 bg-primary/5 p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary"><Target className="h-4 w-4" />What could you have done better?</p>
              <p className="mt-2 text-sm font-semibold leading-6">{insight.counterfactual}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}

function PortfolioScreen({ rows, portfolioValue, totalProfitLoss }: { rows: PortfolioRow[]; portfolioValue: number; totalProfitLoss: number }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Briefcase className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="text-xl font-black">Your portfolio is empty</h2>
          <p className="mt-2 text-sm text-muted-foreground">Buy stocks from the dashboard to begin tracking holdings and profit/loss.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total value" value={formatCurrency(portfolioValue)} tone="neutral" icon={<Wallet className="h-5 w-5" />} />
        <StatCard title="Open P/L" value={`${totalProfitLoss >= 0 ? "+" : ""}${formatCurrency(totalProfitLoss)}`} tone={totalProfitLoss >= 0 ? "positive" : "negative"} icon={<BarChart3 className="h-5 w-5" />} />
        <StatCard title="Holdings" value={String(rows.length)} tone="neutral" icon={<Briefcase className="h-5 w-5" />} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Portfolio</CardTitle>
          <CardDescription>Structured holdings with quantity, average price, current price, and P/L.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 pr-4">Stock</th>
                <th className="py-3 pr-4">Quantity</th>
                <th className="py-3 pr-4">Avg price</th>
                <th className="py-3 pr-4">Current price</th>
                <th className="py-3 pr-4">Value</th>
                <th className="py-3 pr-4">P/L</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.stockId} className="transition hover:bg-muted/35">
                  <td className="py-4 pr-4 font-black">{row.stockName}</td>
                  <td className="py-4 pr-4">{row.quantity}</td>
                  <td className="py-4 pr-4">{formatCurrency(row.averageBuyPrice)}</td>
                  <td className="py-4 pr-4">{formatCurrency(row.currentPrice)}</td>
                  <td className="py-4 pr-4">{formatCurrency(row.currentValue)}</td>
                  <td className={`py-4 pr-4 font-black ${row.profitLoss >= 0 ? "text-success" : "text-destructive"}`}>{row.profitLoss >= 0 ? "+" : ""}{formatCurrency(row.profitLoss)} ({row.profitLossPercent.toFixed(2)}%)</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryScreen({ trades, behaviorLog }: { trades: Trade[]; behaviorLog: BehaviorLog[] }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
          <CardDescription>Every buy and sell with price, time, and result.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {trades.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">No trades yet.</div>
          ) : trades.map((trade) => (
            <TradeRow key={trade.id} trade={trade} />
          ))}
        </CardContent>
      </Card>
      <BehaviorLogCard behaviorLog={behaviorLog} />
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-2xl border bg-background/60 p-4 transition hover:bg-muted/35 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3">
        <div className={`rounded-2xl p-2 ${trade.type === "BUY" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
          {trade.type === "BUY" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        </div>
        <div>
          <p className="font-black">{trade.type} {trade.stockName}</p>
          <p className="text-xs text-muted-foreground">Time T{trade.timeIndex + 1} at {new Date(trade.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
        </div>
      </div>
      <div className="text-left sm:text-right">
        <p className="font-black">{formatCurrency(trade.price)}</p>
        {trade.label && <Badge variant={trade.label === "Panic Sell" ? "destructive" : "secondary"}>{trade.label}</Badge>}
        {typeof trade.profitOrLoss === "number" && (
          <p className={trade.profitOrLoss >= 0 ? "text-sm font-bold text-success" : "text-sm font-bold text-destructive"}>{trade.profitOrLoss >= 0 ? "+" : ""}{formatCurrency(trade.profitOrLoss)}</p>
        )}
      </div>
    </div>
  );
}

function BehaviorLogCard({ behaviorLog }: { behaviorLog: BehaviorLog[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" />Behavior Log</CardTitle>
        <CardDescription>Feedback created after sell decisions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {behaviorLog.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">Sell a stock to generate behavior feedback.</div>
        ) : behaviorLog.map((entry) => {
          const stock = findStock(entry.stockId);
          return (
            <div key={entry.id} className="rounded-2xl border bg-background/60 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-black">{stock?.name || entry.stockId}</p>
                <Badge variant={entry.behavior === "Panic Sell" ? "destructive" : "secondary"}>{entry.behavior}</Badge>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{entry.message}</p>
              <p className={`mt-2 text-sm font-black ${entry.profitOrLoss >= 0 ? "text-success" : "text-destructive"}`}>{entry.profitOrLoss >= 0 ? "+" : ""}{formatCurrency(entry.profitOrLoss)}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function InsightsScreen({ insight, behaviorLog, trades, news, activeNews }: { insight?: Insight; behaviorLog: BehaviorLog[]; trades: Trade[]; news: string[]; activeNews: NewsItem[] }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Card className="insight-card">
          <CardHeader>
            <CardTitle>Learning Insights</CardTitle>
            <CardDescription>Behavior-focused guidance from your recent simulated decisions.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <StatCard title="Performance" value={`${(insight?.performance || 0) >= 0 ? "+" : ""}${formatCurrency(insight?.performance || 0)}`} tone={(insight?.performance || 0) >= 0 ? "positive" : "negative"} icon={<BarChart3 className="h-5 w-5" />} />
            <StatCard title="Trades" value={String(trades.length)} tone="neutral" icon={<History className="h-5 w-5" />} />
            <StatCard title="Panic sells" value={String(behaviorLog.filter((item) => item.behavior === "Panic Sell").length)} tone="negative" icon={<TrendingDown className="h-5 w-5" />} />
            <StatCard title="Win rate" value={insight?.winRate !== undefined ? `${insight.winRate.toFixed(0)}%` : "—"} tone={(insight?.winRate || 0) >= 50 ? "positive" : "negative"} icon={<Target className="h-5 w-5" />} />
            <div className="rounded-3xl border bg-background/60 p-5 md:col-span-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Behavior Insight</p>
              <p className="mt-2 text-lg font-black">{insight?.behavior}</p>
              <p className="mt-3 leading-7 text-muted-foreground">{insight?.suggestion}</p>
            </div>
          </CardContent>
        </Card>

        {insight?.additionalInsights && insight.additionalInsights.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />Detailed Analysis</CardTitle>
              <CardDescription>Additional patterns detected from your trading behavior.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {insight.additionalInsights.map((ai, idx) => (
                <div key={idx} className="rounded-2xl border border-accent/40 bg-accent/5 p-4">
                  <p className="text-sm font-semibold leading-6">{ai}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {insight?.counterfactual && (
          <Card className="border-primary/20 overflow-hidden cf-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" />What could you have done better?</CardTitle>
              <CardDescription>Counterfactual analysis of your most recent sell decision.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5">
                <p className="text-sm font-semibold leading-7">{insight.counterfactual}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {insight?.frequentTrading && (
          <Card className="border-warning/20">
            <CardContent className="flex items-start gap-3 p-5">
              <div className="rounded-2xl bg-warning/10 p-3 text-warning"><Activity className="h-5 w-5" /></div>
              <div>
                <p className="font-black">Frequent Trading Detected</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">You are making many trades in a short window. Frequent trading often leads to worse outcomes due to emotional decision-making. Consider observing the market before your next move.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <RightPanel news={news} activeNews={activeNews} insight={insight} />
    </div>
  );
}
