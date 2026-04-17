import { type ReactNode, useEffect, useMemo, useState } from "react";
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

type Screen = "dashboard" | "portfolio" | "history" | "insights";
type AuthMode = "login" | "signup";
type ThemeMode = "light" | "dark";
type TradeType = "BUY" | "SELL";

type StockDefinition = {
  id: string;
  name: string;
  sector: string;
  timeline: number[];
};

type StockView = StockDefinition & {
  currentPrice: number;
  previousPrice: number;
  percentChange: number;
  recentDipIndex: number;
  totalTrend: number;
  volatility: number;
};

type PortfolioItem = {
  stockId: string;
  quantity: number;
  averageBuyPrice: number;
};

type Trade = {
  id: string;
  type: TradeType;
  stockId: string;
  stockName: string;
  price: number;
  timeIndex: number;
  createdAt: string;
  profitOrLoss?: number;
  label?: "Panic Sell" | "Normal Sell";
};

type BehaviorLog = {
  id: string;
  stockId: string;
  behavior: "Panic Sell" | "Normal Sell";
  message: string;
  timeIndex: number;
  profitOrLoss: number;
};

type SellEvent = {
  action: "SELL";
  stock: string;
  buy_price: number;
  sell_price: number;
  profit_or_loss: number;
  behavior: "Panic Sell" | "Normal Sell";
  time: number;
};

type SimulatorUser = {
  username: string;
  password: string;
  balance: number;
  portfolio: Record<string, PortfolioItem>;
  tradeHistory: Trade[];
  behaviorLog: BehaviorLog[];
  sellEvents: SellEvent[];
};

type PortfolioRow = PortfolioItem & {
  stockName: string;
  currentPrice: number;
  currentValue: number;
  investedValue: number;
  profitLoss: number;
  profitLossPercent: number;
};

const INITIAL_BALANCE = 100000;
const STORAGE_KEY = "investment-simulator-users-v2";
const SESSION_KEY = "investment-simulator-session-v2";

const STOCKS: StockDefinition[] = [
  { id: "RELIANCE", name: "Reliance", sector: "Energy", timeline: [2500, 2528, 2495, 2552, 2410, 2268, 2295, 2358, 2432, 2475, 2535, 2580, 2548, 2605, 2440, 2315, 2352, 2415, 2490, 2562, 2620, 2590, 2665, 2708] },
  { id: "TCS", name: "TCS", sector: "IT Services", timeline: [3500, 3472, 3528, 3590, 3410, 3195, 3242, 3318, 3388, 3465, 3542, 3615, 3580, 3655, 3440, 3260, 3312, 3395, 3480, 3568, 3635, 3600, 3688, 3745] },
  { id: "HDFCBANK", name: "HDFC Bank", sector: "Banking", timeline: [1500, 1516, 1490, 1532, 1448, 1358, 1382, 1416, 1462, 1495, 1534, 1562, 1544, 1588, 1492, 1408, 1430, 1468, 1510, 1550, 1582, 1560, 1605, 1632] },
  { id: "INFY", name: "Infosys", sector: "IT Services", timeline: [1420, 1438, 1412, 1460, 1378, 1295, 1318, 1354, 1398, 1435, 1482, 1516, 1492, 1538, 1444, 1362, 1388, 1424, 1470, 1512, 1540, 1524, 1572, 1605] },
  { id: "ICICI", name: "ICICI Bank", sector: "Banking", timeline: [980, 994, 972, 1008, 948, 890, 906, 930, 962, 990, 1018, 1045, 1028, 1060, 995, 938, 952, 982, 1012, 1042, 1068, 1052, 1085, 1110] },
  { id: "SBI", name: "SBI", sector: "Banking", timeline: [730, 742, 724, 756, 708, 665, 678, 698, 722, 746, 770, 792, 780, 806, 754, 712, 726, 748, 775, 798, 818, 806, 835, 858] },
  { id: "ITC", name: "ITC", sector: "Consumer", timeline: [450, 456, 448, 462, 438, 414, 422, 434, 446, 458, 472, 484, 478, 492, 464, 438, 446, 458, 472, 486, 498, 490, 506, 518] },
  { id: "ADANI", name: "Adani Enterprises", sector: "Infrastructure", timeline: [3050, 3105, 2990, 3160, 2940, 2660, 2725, 2845, 2978, 3068, 3195, 3310, 3235, 3380, 3098, 2865, 2935, 3075, 3210, 3355, 3470, 3410, 3560, 3685] },
];

const NEWS_BANK = [
  "Reliance shares drop after broad market correction",
  "IT stocks show recovery trend after early selling",
  "Banking names remain volatile as investors reassess risk",
  "Consumer stocks hold steady while high-beta names swing",
  "Market sentiment improves after sharp intraday dip",
  "Analysts warn beginners not to overreact to short-term moves",
  "Recovery pattern appears in large-cap simulated basket",
  "Infrastructure stocks move sharply as volatility increases",
];

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

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function findStock(stockId: string) {
  return STOCKS.find((stock) => stock.id === stockId);
}

function priceAt(stock: StockDefinition, index: number) {
  return stock.timeline[index % stock.timeline.length] ?? stock.timeline[0];
}

function getRecentDipIndex(stock: StockDefinition, currentIndex: number) {
  const limit = Math.min(currentIndex, stock.timeline.length - 1);
  for (let index = limit; index > Math.max(-1, limit - 4); index -= 1) {
    const current = stock.timeline[index];
    const previous = stock.timeline[index - 1];
    if (current && previous) {
      const change = ((current - previous) / previous) * 100;
      if (change <= -5) return index;
    }
  }
  return -1;
}

function calculateVolatility(timeline: number[], currentIndex: number) {
  const start = Math.max(1, currentIndex - 5);
  const changes: number[] = [];
  for (let index = start; index <= currentIndex; index += 1) {
    const previous = timeline[index - 1];
    const current = timeline[index];
    if (previous && current) {
      changes.push(Math.abs(((current - previous) / previous) * 100));
    }
  }
  if (!changes.length) return 0;
  return changes.reduce((total, value) => total + value, 0) / changes.length;
}

function getInsight(user: SimulatorUser, totalProfitLoss: number) {
  const lastBehavior = user.behaviorLog[0];
  const lastTrade = user.tradeHistory[0];
  const lastSixTradeResult = user.tradeHistory
    .slice(0, 6)
    .reduce((total, trade) => total + (trade.profitOrLoss || 0), 0);

  if (lastBehavior?.behavior === "Panic Sell") {
    return {
      performance: lastSixTradeResult,
      behavior: "You sold during a dip in the last trade.",
      suggestion: "Markets often recover after short-term drops. Pause before reacting to fear.",
    };
  }

  if (lastTrade?.type === "SELL") {
    return {
      performance: lastSixTradeResult,
      behavior: "Your last exit was not marked as panic selling.",
      suggestion: "Review why you sold: plan-based exits are usually better than emotion-based exits.",
    };
  }

  return {
    performance: totalProfitLoss,
    behavior: user.tradeHistory.length ? "You are building market experience through small decisions." : "No behavior pattern yet. Make a few trades to generate insights.",
    suggestion: "Watch the chart during dips and recoveries before deciding whether to sell.",
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

  const currentUser = currentUsername ? users[currentUsername] : undefined;
  const maxTimelineLength = STOCKS[0]?.timeline.length || 1;

  useEffect(() => {
    if (!currentUser) return;
    const interval = window.setInterval(() => {
      setTimeIndex((previous) => (previous + 1) % maxTimelineLength);
    }, 3800);
    return () => window.clearInterval(interval);
  }, [currentUser, maxTimelineLength]);

  useEffect(() => {
    saveUsers(users);
  }, [users]);

  const stocks = useMemo<StockView[]>(() => {
    return STOCKS.map((stock) => {
      const currentPrice = priceAt(stock, timeIndex);
      const previousPrice = priceAt(stock, timeIndex === 0 ? 0 : timeIndex - 1);
      const firstPrice = stock.timeline[0];
      const percentChange = previousPrice ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;
      const totalTrend = firstPrice ? ((currentPrice - firstPrice) / firstPrice) * 100 : 0;
      return {
        ...stock,
        currentPrice,
        previousPrice,
        percentChange,
        totalTrend,
        volatility: calculateVolatility(stock.timeline, timeIndex),
        recentDipIndex: getRecentDipIndex(stock, timeIndex),
      };
    });
  }, [timeIndex]);

  const selectedStock = stocks.find((stock) => stock.id === selectedStockId) || stocks[0];
  const marketAverageChange = stocks.reduce((total, stock) => total + stock.percentChange, 0) / Math.max(stocks.length, 1);
  const marketPhase = marketAverageChange <= -5 ? "dip" : marketAverageChange >= 4 ? "recovery" : "normal";

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
        timeIndex,
        createdAt: new Date().toISOString(),
      };

      return {
        ...user,
        balance: user.balance - stock.currentPrice,
        portfolio: {
          ...user.portfolio,
          [stock.id]: { stockId: stock.id, quantity: nextQuantity, averageBuyPrice: nextAverage },
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
        timeIndex,
        createdAt: new Date().toISOString(),
        profitOrLoss,
        label: behavior,
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
      };

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
    ? selectedStock.timeline.slice(0, timeIndex + 1).map((price, index) => ({ time: `T${index + 1}`, price }))
    : [];

  const insight = currentUser ? getInsight(currentUser, totalProfitLoss) : undefined;
  const rotatedNews = useMemo(() => {
    const selectedSector = selectedStock?.sector || "Market";
    const first = `${selectedStock?.name || "Market"} ${selectedStock?.percentChange && selectedStock.percentChange < 0 ? "faces pressure" : "shows momentum"} as ${selectedSector.toLowerCase()} sentiment shifts`;
    return [first, ...NEWS_BANK].slice(timeIndex % 3, (timeIndex % 3) + 5);
  }, [selectedStock, timeIndex]);

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
                  insight={insight}
                />
              )}

              {screen === "portfolio" && <PortfolioScreen rows={portfolioRows} portfolioValue={portfolioValue} totalProfitLoss={totalProfitLoss} />}
              {screen === "history" && <HistoryScreen trades={currentUser.tradeHistory} behaviorLog={currentUser.behaviorLog} />}
              {screen === "insights" && <InsightsScreen insight={insight} behaviorLog={currentUser.behaviorLog} trades={currentUser.tradeHistory} news={rotatedNews} />}
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
  insight,
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
  insight?: { performance: number; behavior: string; suggestion: string };
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
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">{selectedStock.name}</h2>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <p className="text-4xl font-black tracking-tight">{formatCurrency(selectedStock.currentPrice)}</p>
                  <p className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    {isPositive ? "+" : ""}{selectedStock.percentChange.toFixed(2)}%
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button size="lg" className="min-w-28" onClick={() => buyStock(selectedStock)}>Buy</Button>
                <Button size="lg" variant="outline" className="min-w-28 bg-background/70" disabled={!canSell} onClick={() => sellStock(selectedStock)}>Sell</Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {stocks.map((stock) => (
                <button
                  key={stock.id}
                  onClick={() => setSelectedStockId(stock.id)}
                  className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${selectedStockId === stock.id ? "border-primary bg-primary/10 shadow-lg shadow-primary/10" : "bg-background/65 hover:bg-background"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-black">{stock.name}</p>
                      <p className="text-xs text-muted-foreground">{stock.id}</p>
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
                <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#premiumPriceFill)" activeDot={{ r: 6 }} animationDuration={700} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard title="Day change" value={`${isPositive ? "+" : ""}${selectedStock.percentChange.toFixed(2)}%`} tone={isPositive ? "positive" : "negative"} icon={<Activity className="h-5 w-5" />} />
          <StatCard title="Total trend" value={`${selectedStock.totalTrend >= 0 ? "+" : ""}${selectedStock.totalTrend.toFixed(2)}%`} tone={selectedStock.totalTrend >= 0 ? "positive" : "negative"} icon={<TrendingUp className="h-5 w-5" />} />
          <StatCard title="Volatility" value={`${selectedStock.volatility.toFixed(2)}%`} tone="neutral" icon={<Gauge className="h-5 w-5" />} />
        </div>
      </section>

      <RightPanel news={news} insight={insight} />
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

function RightPanel({ news, insight }: { news: string[]; insight?: { performance: number; behavior: string; suggestion: string } }) {
  return (
    <aside className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Newspaper className="h-5 w-5 text-primary" />Market News</CardTitle>
          <CardDescription>Simulated headlines that create realistic market context.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {news.slice(0, 5).map((headline, index) => (
            <div key={`${headline}-${index}`} className="rounded-2xl border bg-background/55 p-4 transition hover:bg-muted/50">
              <div className="mb-2 flex items-center justify-between gap-3">
                <Badge variant="outline">Market</Badge>
                <span className="text-xs text-muted-foreground">T-{index + 1}</span>
              </div>
              <p className="text-sm font-semibold leading-6">{headline}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="insight-card overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5" />AI Learning Insights</CardTitle>
          <CardDescription>Rule-based today, structured for future AI feedback.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-background/65 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Last 1 Hour Performance</p>
            <p className={`mt-2 text-3xl font-black ${(insight?.performance || 0) >= 0 ? "text-success" : "text-destructive"}`}>{(insight?.performance || 0) >= 0 ? "+" : ""}{formatCurrency(insight?.performance || 0)}</p>
          </div>
          <div className="rounded-2xl border bg-background/65 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Behavior Insight</p>
            <p className="mt-2 text-sm font-semibold leading-6">{insight?.behavior}</p>
          </div>
          <div className="rounded-2xl border bg-background/65 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Suggestion</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{insight?.suggestion}</p>
          </div>
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

function InsightsScreen({ insight, behaviorLog, trades, news }: { insight?: { performance: number; behavior: string; suggestion: string }; behaviorLog: BehaviorLog[]; trades: Trade[]; news: string[] }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="insight-card">
        <CardHeader>
          <CardTitle>Learning Insights</CardTitle>
          <CardDescription>Behavior-focused guidance from your recent simulated decisions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <StatCard title="Last 1 hour" value={`${(insight?.performance || 0) >= 0 ? "+" : ""}${formatCurrency(insight?.performance || 0)}`} tone={(insight?.performance || 0) >= 0 ? "positive" : "negative"} icon={<BarChart3 className="h-5 w-5" />} />
          <StatCard title="Trades" value={String(trades.length)} tone="neutral" icon={<History className="h-5 w-5" />} />
          <StatCard title="Panic sells" value={String(behaviorLog.filter((item) => item.behavior === "Panic Sell").length)} tone="negative" icon={<TrendingDown className="h-5 w-5" />} />
          <div className="rounded-3xl border bg-background/60 p-5 md:col-span-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Behavior Insight</p>
            <p className="mt-2 text-lg font-black">{insight?.behavior}</p>
            <p className="mt-3 leading-7 text-muted-foreground">{insight?.suggestion}</p>
          </div>
        </CardContent>
      </Card>
      <RightPanel news={news} insight={insight} />
    </div>
  );
}
