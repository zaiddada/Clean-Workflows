import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
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
  BookOpen,
  Briefcase,
  Clock,
  LogOut,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type Screen = "dashboard" | "portfolio" | "history";
type AuthMode = "login" | "signup";
type TradeType = "BUY" | "SELL";

type StockDefinition = {
  id: string;
  name: string;
  timeline: number[];
};

type StockView = StockDefinition & {
  currentPrice: number;
  previousPrice: number;
  percentChange: number;
  recentDipIndex: number;
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

const INITIAL_BALANCE = 100000;
const STORAGE_KEY = "investment-simulator-users-v2";
const SESSION_KEY = "investment-simulator-session-v2";

const STOCKS: StockDefinition[] = [
  { id: "RELIANCE", name: "Reliance", timeline: [2500, 2528, 2495, 2552, 2410, 2268, 2295, 2358, 2432, 2475, 2535, 2580, 2548, 2605, 2440, 2315, 2352, 2415, 2490, 2562, 2620, 2590, 2665, 2708] },
  { id: "TCS", name: "TCS", timeline: [3500, 3472, 3528, 3590, 3410, 3195, 3242, 3318, 3388, 3465, 3542, 3615, 3580, 3655, 3440, 3260, 3312, 3395, 3480, 3568, 3635, 3600, 3688, 3745] },
  { id: "HDFCBANK", name: "HDFC Bank", timeline: [1500, 1516, 1490, 1532, 1448, 1358, 1382, 1416, 1462, 1495, 1534, 1562, 1544, 1588, 1492, 1408, 1430, 1468, 1510, 1550, 1582, 1560, 1605, 1632] },
  { id: "INFY", name: "Infosys", timeline: [1420, 1438, 1412, 1460, 1378, 1295, 1318, 1354, 1398, 1435, 1482, 1516, 1492, 1538, 1444, 1362, 1388, 1424, 1470, 1512, 1540, 1524, 1572, 1605] },
  { id: "ICICI", name: "ICICI Bank", timeline: [980, 994, 972, 1008, 948, 890, 906, 930, 962, 990, 1018, 1045, 1028, 1060, 995, 938, 952, 982, 1012, 1042, 1068, 1052, 1085, 1110] },
  { id: "SBI", name: "SBI", timeline: [730, 742, 724, 756, 708, 665, 678, 698, 722, 746, 770, 792, 780, 806, 754, 712, 726, 748, 775, 798, 818, 806, 835, 858] },
  { id: "ITC", name: "ITC", timeline: [450, 456, 448, 462, 438, 414, 422, 434, 446, 458, 472, 484, 478, 492, 464, 438, 446, 458, 472, 486, 498, 490, 506, 518] },
  { id: "ADANI", name: "Adani Enterprises", timeline: [3050, 3105, 2990, 3160, 2940, 2660, 2725, 2845, 2978, 3068, 3195, 3310, 3235, 3380, 3098, 2865, 2935, 3075, 3210, 3355, 3470, 3410, 3560, 3685] },
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

export default function Home() {
  const { toast } = useToast();
  const [users, setUsers] = useState<Record<string, SimulatorUser>>(() => loadUsers());
  const [currentUsername, setCurrentUsername] = useState<string>(() => localStorage.getItem(SESSION_KEY) || "");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [timeIndex, setTimeIndex] = useState(0);
  const [selectedStockId, setSelectedStockId] = useState(STOCKS[0]?.id || "");

  const currentUser = currentUsername ? users[currentUsername] : undefined;
  const maxTimelineLength = STOCKS[0]?.timeline.length || 1;

  useEffect(() => {
    if (!currentUser) return;
    const interval = window.setInterval(() => {
      setTimeIndex((previous) => (previous + 1) % maxTimelineLength);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [currentUser, maxTimelineLength]);

  useEffect(() => {
    saveUsers(users);
  }, [users]);

  const stocks = useMemo<StockView[]>(() => {
    return STOCKS.map((stock) => {
      const currentPrice = priceAt(stock, timeIndex);
      const previousPrice = priceAt(stock, timeIndex === 0 ? 0 : timeIndex - 1);
      const percentChange = previousPrice ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;
      return {
        ...stock,
        currentPrice,
        previousPrice,
        percentChange,
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

    toast({ title: "Bought 1 share", description: `${stock.name} was added to your portfolio at ${formatCurrency(stock.currentPrice)}.` });
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
      const nextPortfolio = {
        ...user.portfolio,
        [stock.id]: { ...existing, quantity: nextQuantity },
      };
      if (nextQuantity === 0) {
        delete nextPortfolio[stock.id];
      }

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

  const portfolioRows = useMemo(() => {
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

  if (!currentUser) {
    return (
      <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top_left,hsl(243_75%_92%),transparent_35%),linear-gradient(135deg,hsl(210_40%_98%),hsl(220_60%_96%))] px-4 py-10">
        <div className="mx-auto grid min-h-[calc(100dvh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Learning simulator</Badge>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight text-foreground md:text-6xl">Investment Simulator</h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                Practice market decisions with virtual money. Learn how dips, recovery, and emotions affect investing behavior without using real stock data or real cash.
              </p>
            </div>
            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              <Card className="border-primary/15 bg-white/80">
                <CardContent className="p-4">
                  <ShieldCheck className="mb-3 h-5 w-5 text-primary" />
                  <p className="text-sm font-semibold">No real trading</p>
                  <p className="mt-1 text-xs text-muted-foreground">Only learning behavior.</p>
                </CardContent>
              </Card>
              <Card className="border-primary/15 bg-white/80">
                <CardContent className="p-4">
                  <TrendingDown className="mb-3 h-5 w-5 text-destructive" />
                  <p className="text-sm font-semibold">Market dips</p>
                  <p className="mt-1 text-xs text-muted-foreground">Feel the panic safely.</p>
                </CardContent>
              </Card>
              <Card className="border-primary/15 bg-white/80">
                <CardContent className="p-4">
                  <BookOpen className="mb-3 h-5 w-5 text-success" />
                  <p className="text-sm font-semibold">Simple feedback</p>
                  <p className="mt-1 text-xs text-muted-foreground">Reflect after selling.</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="border-primary/10 bg-white/90 shadow-xl shadow-primary/10 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl">{authMode === "login" ? "Log in" : "Create account"}</CardTitle>
              <CardDescription>
                {authMode === "login" ? "Continue your local simulator progress." : "Start with ₹100,000 in virtual cash."}
              </CardDescription>
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
              <p className="rounded-xl bg-muted p-3 text-xs leading-5 text-muted-foreground">
                This MVP stores account data locally on this device for simulation only. It is intentionally simple and not meant for sensitive information.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-16">
      <header className="sticky top-0 z-20 border-b bg-card/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-primary"><Activity className="h-6 w-6" />Investment Simulator</h1>
            <p className="text-sm text-muted-foreground">Logged in as {currentUser.username}. Market time: T{timeIndex + 1}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["dashboard", "portfolio", "history"] as Screen[]).map((item) => (
              <Button key={item} variant={screen === item ? "default" : "outline"} onClick={() => setScreen(item)} className="capitalize">
                {item === "dashboard" ? "Dashboard" : item === "portfolio" ? "Portfolio" : "Trade History"}
              </Button>
            ))}
            <Button variant="ghost" onClick={logout}><LogOut className="mr-2 h-4 w-4" />Logout</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard title="Current balance" value={formatCurrency(currentUser.balance)} icon={<User className="h-5 w-5" />} />
          <MetricCard title="Portfolio value" value={formatCurrency(portfolioValue)} icon={<Briefcase className="h-5 w-5" />} />
          <MetricCard title="Net worth" value={formatCurrency(netWorth)} icon={<BarChart3 className="h-5 w-5" />} />
          <MetricCard title="Total P/L" value={`${totalProfitLoss >= 0 ? "+" : ""}${formatCurrency(totalProfitLoss)}`} icon={totalProfitLoss >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />} valueClassName={totalProfitLoss >= 0 ? "text-success" : "text-destructive"} />
        </section>

        {marketPhase !== "normal" && (
          <Card className={marketPhase === "dip" ? "border-destructive/30 bg-destructive/10" : "border-success/30 bg-success/10"}>
            <CardContent className="flex items-start gap-3 p-4">
              {marketPhase === "dip" ? <TrendingDown className="mt-0.5 h-5 w-5 text-destructive" /> : <TrendingUp className="mt-0.5 h-5 w-5 text-success" />}
              <div>
                <p className="font-semibold">{marketPhase === "dip" ? "Market dip in progress" : "Recovery pattern in progress"}</p>
                <p className="text-sm text-muted-foreground">
                  {marketPhase === "dip" ? "Prices dropped sharply. This is where panic selling often happens." : "Prices are recovering after earlier drops. Notice how fear can change once prices move up again."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {screen === "dashboard" && (
          <DashboardScreen
            stocks={stocks}
            selectedStock={selectedStock}
            selectedStockId={selectedStockId}
            setSelectedStockId={setSelectedStockId}
            portfolio={currentUser.portfolio}
            chartData={chartData}
            buyStock={buyStock}
            sellStock={sellStock}
          />
        )}

        {screen === "portfolio" && <PortfolioScreen rows={portfolioRows} />}

        {screen === "history" && <HistoryScreen trades={currentUser.tradeHistory} behaviorLog={currentUser.behaviorLog} />}
      </main>
    </div>
  );
}

function MetricCard({ title, value, icon, valueClassName = "" }: { title: string; value: string; icon: React.ReactNode; valueClassName?: string }) {
  return (
    <Card className="bg-card/90">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          <p className={`mt-2 text-2xl font-extrabold ${valueClassName}`}>{value}</p>
        </div>
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">{icon}</div>
      </CardContent>
    </Card>
  );
}

function DashboardScreen({
  stocks,
  selectedStock,
  selectedStockId,
  setSelectedStockId,
  portfolio,
  chartData,
  buyStock,
  sellStock,
}: {
  stocks: StockView[];
  selectedStock?: StockView;
  selectedStockId: string;
  setSelectedStockId: (stockId: string) => void;
  portfolio: Record<string, PortfolioItem>;
  chartData: { time: string; price: number }[];
  buyStock: (stock: StockView) => void;
  sellStock: (stock: StockView) => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Dashboard</h2>
          <p className="text-sm text-muted-foreground">All stocks move together through the same simulated time index.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {stocks.map((stock) => {
            const holding = portfolio[stock.id];
            const hasHolding = Boolean(holding?.quantity);
            const isPositive = stock.percentChange >= 0;
            return (
              <Card key={stock.id} className={`cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md ${selectedStockId === stock.id ? "border-primary shadow-md shadow-primary/10" : ""}`} onClick={() => setSelectedStockId(stock.id)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{stock.name}</CardTitle>
                      <CardDescription>{stock.id}</CardDescription>
                    </div>
                    <Badge variant="outline" className={isPositive ? "text-success" : "text-destructive"}>{isPositive ? "+" : ""}{stock.percentChange.toFixed(2)}%</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-3xl font-extrabold">{formatCurrency(stock.currentPrice)}</p>
                      <p className="text-xs text-muted-foreground">Previous {formatCurrency(stock.previousPrice)}</p>
                    </div>
                    {hasHolding && <p className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Owned: {holding?.quantity}</p>}
                  </div>
                  <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                    <Button className="flex-1" onClick={() => buyStock(stock)}>Buy</Button>
                    <Button className="flex-1" variant="outline" disabled={!hasHolding} onClick={() => sellStock(stock)}>Sell</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Price chart</h2>
          <p className="text-sm text-muted-foreground">Click a stock card to inspect its live timeline.</p>
        </div>
        <Card className="min-h-[420px]">
          <CardHeader>
            <CardTitle>{selectedStock?.name || "Select a stock"}</CardTitle>
            <CardDescription>Price vs simulated time</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `₹${formatNumber(Number(value))}`} width={72} />
                <ChartTooltip formatter={(value) => [formatCurrency(Number(value)), "Price"]} />
                <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#priceFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function PortfolioScreen({ rows }: { rows: Array<PortfolioItem & { stockName: string; currentPrice: number; currentValue: number; investedValue: number; profitLoss: number; profitLossPercent: number }> }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center">
          <Briefcase className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="text-xl font-bold">Your portfolio is empty</h2>
          <p className="mt-2 text-sm text-muted-foreground">Buy stocks from the dashboard to begin tracking holdings and profit/loss.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio</CardTitle>
        <CardDescription>Holdings, average buy price, current price, and total profit/loss.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-3 pr-4">Stock</th>
              <th className="py-3 pr-4">Quantity</th>
              <th className="py-3 pr-4">Avg buy</th>
              <th className="py-3 pr-4">Current price</th>
              <th className="py-3 pr-4">Current value</th>
              <th className="py-3 pr-4">Profit/Loss</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.stockId}>
                <td className="py-4 pr-4 font-semibold">{row.stockName}</td>
                <td className="py-4 pr-4">{row.quantity}</td>
                <td className="py-4 pr-4">{formatCurrency(row.averageBuyPrice)}</td>
                <td className="py-4 pr-4">{formatCurrency(row.currentPrice)}</td>
                <td className="py-4 pr-4">{formatCurrency(row.currentValue)}</td>
                <td className={`py-4 pr-4 font-bold ${row.profitLoss >= 0 ? "text-success" : "text-destructive"}`}>
                  {row.profitLoss >= 0 ? "+" : ""}{formatCurrency(row.profitLoss)} ({row.profitLossPercent.toFixed(2)}%)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function HistoryScreen({ trades, behaviorLog }: { trades: Trade[]; behaviorLog: BehaviorLog[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
          <CardDescription>Every buy and sell is tracked with price and simulator time.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {trades.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">No trades yet.</div>
          ) : (
            trades.map((trade) => (
              <div key={trade.id} className="flex flex-col justify-between gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <div className={`rounded-full p-2 ${trade.type === "BUY" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
                    {trade.type === "BUY" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="font-bold">{trade.type} {trade.stockName}</p>
                    <p className="text-xs text-muted-foreground">Time T{trade.timeIndex + 1} at {new Date(trade.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-bold">{formatCurrency(trade.price)}</p>
                  {trade.label && <Badge variant={trade.label === "Panic Sell" ? "destructive" : "secondary"}>{trade.label}</Badge>}
                  {typeof trade.profitOrLoss === "number" && (
                    <p className={trade.profitOrLoss >= 0 ? "text-sm font-semibold text-success" : "text-sm font-semibold text-destructive"}>{trade.profitOrLoss >= 0 ? "+" : ""}{formatCurrency(trade.profitOrLoss)}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Behavior Log</CardTitle>
          <CardDescription>Learning notes created after sell decisions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {behaviorLog.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Sell a stock to receive behavior feedback.</div>
          ) : (
            behaviorLog.map((entry) => {
              const stock = findStock(entry.stockId);
              return (
                <div key={entry.id} className="rounded-xl border bg-background p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="font-bold">{stock?.name || entry.stockId}</p>
                    <Badge variant={entry.behavior === "Panic Sell" ? "destructive" : "secondary"}>{entry.behavior}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{entry.message}</p>
                  <p className={`mt-2 text-sm font-bold ${entry.profitOrLoss >= 0 ? "text-success" : "text-destructive"}`}>{entry.profitOrLoss >= 0 ? "+" : ""}{formatCurrency(entry.profitOrLoss)}</p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
