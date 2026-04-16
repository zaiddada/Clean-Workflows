import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowUpRight, ArrowDownRight, IndianRupee, TrendingUp, AlertTriangle, Info, Clock, Briefcase, Activity } from "lucide-react";

// Types
type Stock = {
  id: string;
  name: string;
  currentPrice: number;
  previousPrice: number;
  history: number[];
};

type PortfolioItem = {
  stockId: string;
  quantity: number;
  averageBuyPrice: number;
};

type SellEvent = {
  action: "SELL";
  stock: string;
  buy_price: number;
  sell_price: number;
  profit_or_loss: number;
  timestamp: number;
};

const INITIAL_BALANCE = 100000;
const INITIAL_STOCKS: Stock[] = [
  { id: "RELIANCE", name: "Reliance", currentPrice: 2500, previousPrice: 2500, history: [2500] },
  { id: "TCS", name: "TCS", currentPrice: 3500, previousPrice: 3500, history: [3500] },
  { id: "HDFCBANK", name: "HDFC Bank", currentPrice: 1500, previousPrice: 1500, history: [1500] },
];

export default function Home() {
  const { toast } = useToast();
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [stocks, setStocks] = useState<Stock[]>(INITIAL_STOCKS);
  const [portfolio, setPortfolio] = useState<Record<string, PortfolioItem>>({});
  const [sellEvents, setSellEvents] = useState<SellEvent[]>([]);
  const [marketStatus, setMarketStatus] = useState<"normal" | "crashing" | "rallying">("normal");

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  // Market Simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setStocks((currentStocks) => {
        // Randomly decide if there's a market event
        const rand = Math.random();
        let currentStatus: "normal" | "crashing" | "rallying" = "normal";
        let isDip = false;
        let isRally = false;

        if (rand < 0.05) {
          isDip = true; // 5% chance of a significant dip
          currentStatus = "crashing";
        } else if (rand > 0.95) {
          isRally = true; // 5% chance of a significant rally
          currentStatus = "rallying";
        }

        setMarketStatus(currentStatus);

        return currentStocks.map((stock) => {
          let changePercent = (Math.random() * 10 - 5) / 100; // -5% to +5%

          if (isDip) {
            changePercent = -0.08 - (Math.random() * 0.07); // -8% to -15%
          } else if (isRally) {
            changePercent = 0.05 + (Math.random() * 0.05); // +5% to +10%
          }

          const newPrice = Math.max(1, Math.round(stock.currentPrice * (1 + changePercent)));
          
          return {
            ...stock,
            previousPrice: stock.currentPrice,
            currentPrice: newPrice,
            history: [...stock.history.slice(-19), newPrice], // Keep last 20 prices
          };
        });
      });
    }, 4000); // Update every 4 seconds

    return () => clearInterval(interval);
  }, []);

  const handleBuy = (stock: Stock) => {
    if (balance < stock.currentPrice) {
      toast({
        title: "Not enough balance",
        description: `You need ${formatCurrency(stock.currentPrice)} to buy 1 share of ${stock.name}.`,
        variant: "destructive"
      });
      return;
    }

    setBalance((prev) => prev - stock.currentPrice);
    setPortfolio((prev) => {
      const existing = prev[stock.id] || { stockId: stock.id, quantity: 0, averageBuyPrice: 0 };
      const totalCost = (existing.quantity * existing.averageBuyPrice) + stock.currentPrice;
      const newQuantity = existing.quantity + 1;
      
      return {
        ...prev,
        [stock.id]: {
          ...existing,
          quantity: newQuantity,
          averageBuyPrice: Math.round(totalCost / newQuantity)
        }
      };
    });

    toast({
      title: "Stock Purchased",
      description: `Bought 1 share of ${stock.name} at ${formatCurrency(stock.currentPrice)}.`,
    });
  };

  const handleSell = (stock: Stock) => {
    const holding = portfolio[stock.id];
    if (!holding || holding.quantity <= 0) {
      toast({
        title: "No shares to sell",
        description: `You don't own any shares of ${stock.name}.`,
        variant: "destructive"
      });
      return;
    }

    const profitOrLoss = stock.currentPrice - holding.averageBuyPrice;
    
    // Add to balance
    setBalance((prev) => prev + stock.currentPrice);
    
    // Update portfolio
    setPortfolio((prev) => ({
      ...prev,
      [stock.id]: {
        ...holding,
        quantity: holding.quantity - 1
      }
    }));

    // Record event
    const event: SellEvent = {
      action: "SELL",
      stock: stock.id,
      buy_price: holding.averageBuyPrice,
      sell_price: stock.currentPrice,
      profit_or_loss: profitOrLoss,
      timestamp: Date.now()
    };
    setSellEvents((prev) => [event, ...prev]);

    // Provide educational feedback
    if (profitOrLoss < 0) {
      toast({
        title: "Learning Moment: Panic Selling",
        description: "You sold at a loss. This is called panic selling. Many beginners do this during market dips.",
        variant: "destructive",
        duration: 8000,
      });
    } else {
      toast({
        title: "Profit Secured",
        description: "You made a profit. But timing the market consistently is very difficult. Good job though!",
        variant: "default",
        duration: 8000,
      });
    }
  };

  // Calculate totals
  const portfolioValue = Object.values(portfolio).reduce((total, item) => {
    const stock = stocks.find(s => s.id === item.stockId);
    return total + (stock ? stock.currentPrice * item.quantity : 0);
  }, 0);

  const totalInvested = Object.values(portfolio).reduce((total, item) => {
    return total + (item.averageBuyPrice * item.quantity);
  }, 0);

  const totalProfitLoss = portfolioValue - totalInvested;
  const totalNetWorth = balance + portfolioValue;

  return (
    <div className="min-h-[100dvh] bg-background pb-20">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
              <Activity className="h-6 w-6" />
              Investment Simulator
            </h1>
            <p className="text-sm text-muted-foreground">Practice investing without the risk</p>
          </div>
          
          <div className="flex items-center gap-6 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available Cash</p>
              <p className="text-xl font-bold">{formatCurrency(balance)}</p>
            </div>
            <div className="h-10 w-px bg-border" />
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net Worth</p>
              <p className="text-xl font-bold">{formatCurrency(totalNetWorth)}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        
        {/* Educational Banner */}
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-primary-foreground/90 text-primary">Welcome to the simulator!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Buy and sell stocks to see how the market moves. Prices update every few seconds. Try to observe your emotions when the market suddenly drops.
            </p>
          </div>
        </div>

        {/* Market Status */}
        {marketStatus !== "normal" && (
          <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${
            marketStatus === "crashing" 
              ? "bg-destructive/10 border-destructive/30 text-destructive" 
              : "bg-success/10 border-success/30 text-success"
          }`}>
            <AlertTriangle className="h-5 w-5" />
            <div>
              <p className="font-semibold">
                {marketStatus === "crashing" ? "Market Dip Detected!" : "Market Rally!"}
              </p>
              <p className="text-sm opacity-90">
                {marketStatus === "crashing" 
                  ? "Prices are dropping fast. Many beginners panic sell here. What will you do?" 
                  : "Prices are surging. It feels good, but can reverse quickly."}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Market */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Live Market</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stocks.map((stock) => {
                const percentChange = ((stock.currentPrice - stock.previousPrice) / stock.previousPrice) * 100;
                const isPositive = percentChange >= 0;
                const holding = portfolio[stock.id];
                const hasHolding = holding && holding.quantity > 0;

                return (
                  <Card key={stock.id} className="overflow-hidden transition-all hover:shadow-md">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex justify-between items-center text-lg">
                        {stock.name}
                        <span className="text-xs font-normal px-2 py-1 bg-secondary rounded-full text-secondary-foreground">
                          {stock.id}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-end mb-4">
                        <div>
                          <p className="text-3xl font-bold tracking-tight">
                            {formatCurrency(stock.currentPrice)}
                          </p>
                          <div className={`flex items-center gap-1 text-sm font-medium mt-1 ${isPositive ? 'text-success' : 'text-destructive'}`}>
                            {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                            {Math.abs(percentChange).toFixed(2)}%
                          </div>
                        </div>
                        
                        {hasHolding && (
                          <div className="text-right text-sm">
                            <p className="text-muted-foreground">You own</p>
                            <p className="font-semibold">{holding.quantity} shares</p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 w-full mt-6">
                        <Button 
                          className="flex-1 font-semibold" 
                          onClick={() => handleBuy(stock)}
                          disabled={balance < stock.currentPrice}
                        >
                          Buy 1
                        </Button>
                        <Button 
                          variant="outline" 
                          className="flex-1 font-semibold"
                          onClick={() => handleSell(stock)}
                          disabled={!hasHolding}
                        >
                          Sell 1
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Right Column - Portfolio */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Your Portfolio</h2>
            </div>
            
            <Card className="bg-slate-50 dark:bg-slate-900 border-none shadow-sm">
              <CardHeader>
                <CardDescription>Total Portfolio Value</CardDescription>
                <CardTitle className="text-3xl">{formatCurrency(portfolioValue)}</CardTitle>
                {portfolioValue > 0 && (
                  <div className={`flex items-center gap-1 text-sm font-medium mt-2 ${totalProfitLoss >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {totalProfitLoss >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    {formatCurrency(Math.abs(totalProfitLoss))} ({((totalProfitLoss / totalInvested) * 100).toFixed(2)}%)
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.values(portfolio).filter(p => p.quantity > 0).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-background rounded-xl border border-dashed">
                    <p>Your portfolio is empty.</p>
                    <p className="text-sm mt-1">Buy some stocks to get started.</p>
                  </div>
                ) : (
                  Object.values(portfolio)
                    .filter(item => item.quantity > 0)
                    .map(item => {
                      const stock = stocks.find(s => s.id === item.stockId)!;
                      const currentValue = stock.currentPrice * item.quantity;
                      const investedValue = item.averageBuyPrice * item.quantity;
                      const profitLoss = currentValue - investedValue;
                      const isProfit = profitLoss >= 0;

                      return (
                        <div key={item.stockId} className="bg-background p-3 rounded-lg border flex justify-between items-center">
                          <div>
                            <p className="font-semibold">{stock.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} shares @ {formatCurrency(item.averageBuyPrice)} avg
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrency(currentValue)}</p>
                            <p className={`text-xs font-medium flex items-center justify-end gap-0.5 ${isProfit ? 'text-success' : 'text-destructive'}`}>
                              {isProfit ? '+' : '-'}{formatCurrency(Math.abs(profitLoss))}
                            </p>
                          </div>
                        </div>
                      );
                    })
                )}
              </CardContent>
            </Card>

            {/* Sell History (For debugging/learning) */}
            {sellEvents.length > 0 && (
              <Card className="border-none shadow-sm bg-slate-50 dark:bg-slate-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                    <Clock className="h-4 w-4" /> Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sellEvents.slice(0, 5).map((event, idx) => (
                    <div key={idx} className="text-sm bg-background p-2 rounded border flex justify-between">
                      <div>
                        <span className="font-medium">Sold {event.stock}</span>
                        <div className="text-xs text-muted-foreground">
                          Bought at {formatCurrency(event.buy_price)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={event.profit_or_loss >= 0 ? "text-success font-medium" : "text-destructive font-medium"}>
                          {event.profit_or_loss >= 0 ? "+" : ""}{formatCurrency(event.profit_or_loss)}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          Sold at {formatCurrency(event.sell_price)}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
