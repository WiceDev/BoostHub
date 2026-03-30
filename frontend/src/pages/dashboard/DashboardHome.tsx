import { useState, useMemo } from "react";
import {
  Wallet, ShoppingBag, Clock, ArrowUpRight, ArrowDownRight,
  TrendingUp, TrendingDown, RotateCcw, Eye, EyeOff, PlusCircle,
  Activity, Phone, UserCheck, Gift, Globe, ChevronRight,
  ArrowRight, AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardStats, fetchOrders, fetchWallet, fetchTransactions, type Transaction } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";

const statusColors: Record<string, string> = {
  completed: "bg-success/10 text-success border-success/20",
  processing: "bg-primary/10 text-primary border-primary/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  refunded: "bg-muted text-muted-foreground border-border",
};

const typeLabels: Record<string, string> = {
  credit: "Deposit",
  debit: "Purchase",
  refund: "Refund",
};

const typeIcons: Record<string, typeof ArrowUpRight> = {
  credit: ArrowUpRight,
  debit: ArrowDownRight,
  refund: RotateCcw,
};

// Quick service cards
const quickServices = [
  { label: "Social Boosting", desc: "Boost your social media", icon: TrendingUp, path: "/dashboard/boosting", color: "bg-primary" },
  { label: "Verification Numbers", desc: "OTP & phone verification", icon: Phone, path: "/dashboard/numbers", color: "bg-blue-600" },
  { label: "Social Accounts", desc: "Buy verified accounts", icon: UserCheck, path: "/dashboard/accounts", color: "bg-blue-500" },
  { label: "Send Gifts", desc: "Gift cards & transfers", icon: Gift, path: "/dashboard/gifts", color: "bg-blue-700" },
  { label: "Web Development", desc: "Custom websites & apps", icon: Globe, path: "/dashboard/webdev", color: "bg-blue-800" },
];

// ── Chart helpers ──
type TimeRange = "daily" | "weekly" | "monthly";
interface ChartPoint { key: string; label: string; value: number; }

function getDayKey(d: Date) { return d.toISOString().slice(0, 10); }
function getDayLabel(d: Date) { return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }); }
function getWeekKey(d: Date) { const s = new Date(d); s.setDate(s.getDate() - s.getDay()); return s.toISOString().slice(0, 10); }
function getWeekLabel(d: Date) { const s = new Date(d); s.setDate(s.getDate() - s.getDay()); return s.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
function getMonthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`; }
function getMonthLabel(d: Date) { return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }); }

function buildDepositChartData(transactions: Transaction[], range: TimeRange): ChartPoint[] {
  const completed = transactions.filter((tx) => tx.status === "completed" && tx.transaction_type === "credit");
  if (completed.length === 0) return [];
  const keyFn = range === "daily" ? getDayKey : range === "weekly" ? getWeekKey : getMonthKey;
  const labelFn = range === "daily" ? getDayLabel : range === "weekly" ? getWeekLabel : getMonthLabel;
  const maxBuckets = range === "daily" ? 14 : 8;
  const grouped = new Map<string, { label: string; total: number }>();
  for (const tx of completed) {
    const date = new Date(tx.created_at);
    const key = keyFn(date);
    const label = labelFn(date);
    const amount = parseFloat(tx.amount);
    const existing = grouped.get(key);
    if (existing) existing.total += amount;
    else grouped.set(key, { label, total: amount });
  }
  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-maxBuckets)
    .map(([key, data]) => ({ key, label: data.label, value: data.total }));
}

// ── SVG Area Chart ──
function AreaChart({ data, formatAmount }: { data: ChartPoint[]; formatAmount: (v: number | string) => string }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const niceMax = Math.ceil(maxVal / 1000) * 1000 || 1000;

  const W = 700;
  const H = 220;
  const padLeft = 50;
  const padRight = 24;
  const padTop = 20;
  const padBot = 40;
  const graphW = W - padLeft - padRight;
  const graphH = H - padTop - padBot;

  const points = data.map((d, i) => ({
    x: padLeft + (data.length === 1 ? graphW / 2 : (i / (data.length - 1)) * graphW),
    y: padTop + graphH - (d.value / niceMax) * graphH,
    ...d,
  }));

  function buildSmoothPath(pts: typeof points): string {
    if (pts.length < 2) return `M ${pts[0].x} ${pts[0].y}`;
    if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  }

  const smoothLine = buildSmoothPath(points);
  const areaPath = `${smoothLine} L ${points[points.length - 1].x} ${padTop + graphH} L ${points[0].x} ${padTop + graphH} Z`;

  const gridLines = 4;
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => {
    const val = (niceMax / gridLines) * i;
    const y = padTop + graphH - (val / niceMax) * graphH;
    return { val, y };
  });

  const formatYLabel = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val.toFixed(0);
  };

  return (
    <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(215 90% 50%)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="hsl(215 90% 50%)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, i) => (
          <g key={i}>
            <line x1={padLeft} y1={tick.y} x2={W - padRight} y2={tick.y}
              stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray={i === 0 ? "0" : "4 3"} opacity="0.4" />
            <text x={padLeft - 10} y={tick.y + 3.5} textAnchor="end" className="fill-muted-foreground"
              style={{ fontSize: "10px", fontFamily: "Inter, sans-serif" }}>{formatYLabel(tick.val)}</text>
          </g>
        ))}

        <path d={areaPath} fill="url(#area-grad)" />
        <path d={smoothLine} fill="none" stroke="hsl(215 90% 50%)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <g key={p.key}>
            <rect x={p.x - 24} y={padTop} width={48} height={graphH} fill="transparent" className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)} />
            {hoveredIdx === i && (
              <line x1={p.x} y1={padTop} x2={p.x} y2={padTop + graphH}
                stroke="hsl(215 90% 50%)" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
            )}
            <circle cx={p.x} cy={p.y} r={hoveredIdx === i ? 6 : 3.5}
              fill={hoveredIdx === i ? "hsl(215 90% 50%)" : "hsl(var(--card))"}
              stroke="hsl(215 90% 50%)" strokeWidth="2.5" className="transition-all duration-150" />
            <text x={p.x} y={H - 8} textAnchor="middle" className="fill-muted-foreground"
              style={{ fontSize: "10px", fontFamily: "Inter, sans-serif" }}>{p.label}</text>
          </g>
        ))}
      </svg>

      {hoveredIdx !== null && points[hoveredIdx] && (
        <div className="absolute bg-foreground text-background text-[11px] px-3 py-2 rounded-xl shadow-lg pointer-events-none z-20 whitespace-nowrap"
          style={{
            left: `${(points[hoveredIdx].x / W) * 100}%`,
            top: `${Math.max((points[hoveredIdx].y / H) * 100 - 18, 2)}%`,
            transform: "translateX(-50%)",
          }}>
          <p className="font-semibold">{formatAmount(points[hoveredIdx].value)}</p>
          <p className="opacity-60 text-[10px]">{points[hoveredIdx].label}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ──
const DashboardHome = () => {
  const { user } = useAuth();
  const { formatAmount, toggleCurrency, currency } = useCurrency();
  const [showBalance, setShowBalance] = useState(true);
  const [chartRange, setChartRange] = useState<TimeRange>("daily");

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery({ queryKey: ['dashboard-stats'], queryFn: fetchDashboardStats });
  const { data: orders, isLoading: ordersLoading, isError: ordersError, refetch: refetchOrders } = useQuery({ queryKey: ['orders-recent'], queryFn: () => fetchOrders() });
  const { data: wallet, isLoading: walletLoading } = useQuery({ queryKey: ['wallet'], queryFn: fetchWallet });
  const { data: transactions, isLoading: txLoading } = useQuery({ queryKey: ['transactions'], queryFn: fetchTransactions });

  const isLoading = statsLoading || walletLoading || txLoading || ordersLoading;
  const isError = statsError || ordersError;

  const recentOrders = (orders || []).slice(0, 5);
  const recentTransactions = (transactions || []).slice(0, 5);

  const totalDeposits = useMemo(() => {
    if (!transactions) return 0;
    return transactions
      .filter((tx) => tx.transaction_type === "credit" && tx.status === "completed")
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
  }, [transactions]);

  const totalSpent = stats ? parseFloat(stats.total_spent) : 0;

  const chartData = useMemo(
    () => buildDepositChartData(transactions || [], chartRange),
    [transactions, chartRange]
  );

  const balanceStr = wallet
    ? showBalance ? formatAmount(wallet.balance) : "••••••••"
    : "...";

  if (isLoading) return (
    <div className="space-y-6 max-w-[1400px]">
      <Skeleton className="h-44 rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card p-4 sm:p-5 space-y-3">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 glass-card p-5 space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-[220px] rounded-xl" />
        </div>
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50"><Skeleton className="h-4 w-32" /></div>
          <div className="divide-y divide-border/30">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50"><Skeleton className="h-4 w-28" /></div>
        <div className="divide-y divide-border/20">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (isError) return (
    <div className="flex flex-col items-center justify-center py-24 space-y-3">
      <AlertCircle className="h-10 w-10 text-destructive/40" />
      <p className="text-base font-semibold text-foreground">Failed to load dashboard</p>
      <p className="text-sm text-muted-foreground">Something went wrong fetching your data.</p>
      <Button variant="outline" onClick={() => { refetchStats(); refetchOrders(); }}>Try again</Button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Welcome + Balance Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-t-2xl">
        {/* Gradient background — fades from primary into the page */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-blue-600/10" />
        {/* Soft glow blob */}
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 header-diamond-pattern pointer-events-none" />

        <div className="p-4 sm:p-6 lg:p-8 relative z-20">

          <div className="relative flex flex-row items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">Welcome back,</p>
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-foreground mt-0.5 truncate">
                {user?.first_name || "there"} {user?.last_name?.[0] ? user.last_name[0] + "." : ""}
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 hidden sm:block">Here's your account overview</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <div className="text-right">
                <p className="text-muted-foreground text-xs font-medium mb-1">Available Balance</p>
                <p className="text-xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight">{balanceStr}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <button onClick={() => setShowBalance(!showBalance)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground">
                  {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button onClick={toggleCurrency}
                  className="px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground text-[11px] font-bold">
                  {currency === "NGN" ? "$" : "₦"}
                </button>
              </div>
            </div>
          </div>

          <div className="relative flex gap-3 mt-6 sm:inline-flex">
            <Link to="/dashboard/deposit" className="flex-1 sm:flex-none">
              <Button className="w-full sm:w-auto font-semibold gap-2 rounded-xl shadow-lg">
                <PlusCircle className="h-4 w-4" />
                Add Funds
              </Button>
            </Link>
            <Link to="/dashboard/orders" className="flex-1 sm:flex-none">
              <Button variant="outline" className="w-full sm:w-auto rounded-xl gap-2">
                <ShoppingBag className="h-4 w-4" />
                View Orders
              </Button>
            </Link>
          </div>
        </div>
        <div className="hidden sm:block absolute bottom-0 inset-x-0 h-20 bg-gradient-to-b from-transparent to-background pointer-events-none" />
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Deposits", value: formatAmount(totalDeposits), icon: TrendingUp, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-500", change: "+12%" },
          { label: "Total Spent", value: formatAmount(totalSpent), icon: TrendingDown, iconBg: "bg-rose-500/10", iconColor: "text-rose-500", change: "-3%" },
          { label: "Total Orders", value: stats?.total_orders?.toString() || "0", icon: ShoppingBag, iconBg: "bg-primary/10", iconColor: "text-primary", change: "+5" },
          { label: "Pending", value: stats?.pending_orders?.toString() || "0", icon: Clock, iconBg: "bg-amber-500/10", iconColor: "text-amber-500", change: "" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4 sm:p-5 group hover:border-primary/20 transition-colors">
            <div className="flex items-start justify-between">
              <div className={`h-11 w-11 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
              {stat.change && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  stat.change.startsWith("+") ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                }`}>{stat.change}</span>
              )}
            </div>
            <p className="text-2xl font-bold text-foreground mt-3">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Services */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Quick Services</h2>
          <Link to="/dashboard/boosting" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickServices.map((service) => (
            <Link key={service.path} to={service.path}
              className="glass-card p-4 group hover:border-primary/20 hover:shadow-md transition-all cursor-pointer">
              <div className={`h-10 w-10 rounded-xl ${service.color} flex items-center justify-center mb-3 shadow-lg group-hover:scale-105 transition-transform`}>
                <service.icon className="h-5 w-5 text-white" />
              </div>
              <p className="text-sm font-semibold text-foreground">{service.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{service.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Chart + Transactions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Chart */}
        <div className="lg:col-span-3 glass-card">
          <div className="px-5 py-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Deposit Overview</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Track your deposit activity</p>
            </div>
            <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 self-start sm:self-auto">
              {(["daily", "weekly", "monthly"] as TimeRange[]).map((r) => (
                <button key={r} onClick={() => setChartRange(r)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors capitalize ${
                    chartRange === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}>{r}</button>
              ))}
            </div>
          </div>
          <div className="p-5">
            {chartData.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground">
                <Activity className="h-10 w-10 mx-auto mb-3 opacity-15" />
                <p className="text-sm font-medium">No deposit data yet</p>
                <p className="text-xs mt-1 opacity-60">Make deposits to see trends here</p>
              </div>
            ) : (
              <AreaChart data={chartData} formatAmount={formatAmount} />
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-2 glass-card">
          <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Recent Transactions</h2>
            <span className="text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-full">
              {transactions?.length || 0} total
            </span>
          </div>
          <div className="divide-y divide-border/30">
            {recentTransactions.length === 0 ? (
              <div className="px-5 py-12 text-center text-muted-foreground">
                <Wallet className="h-8 w-8 mx-auto mb-2 opacity-15" />
                <p className="text-sm">No transactions yet</p>
              </div>
            ) : (
              recentTransactions.map((tx) => {
                const isCredit = tx.transaction_type === "credit" || tx.transaction_type === "refund";
                const Icon = typeIcons[tx.transaction_type] || ArrowDownRight;
                const amountStr = `${isCredit ? "+" : "-"}${formatAmount(tx.amount)}`;
                const date = new Date(tx.created_at);
                return (
                  <div key={tx.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isCredit ? "bg-emerald-500/10" : "bg-rose-500/10"
                    }`}>
                      <Icon className={`h-4 w-4 ${isCredit ? "text-emerald-500" : "text-rose-500"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">
                        {tx.description || typeLabels[tx.transaction_type] || tx.transaction_type}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <p className={`text-[13px] font-semibold ${isCredit ? "text-emerald-500" : "text-foreground"}`}>
                      {amountStr}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="glass-card">
        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Recent Orders</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Your latest service orders</p>
          </div>
          {recentOrders.length > 0 && (
            <Link to="/dashboard/orders" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
        {recentOrders.length === 0 ? (
          <div className="px-5 py-10 text-center text-muted-foreground text-sm">
            <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-15" />
            No orders yet
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-border/20">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground truncate">{order.service_name}</p>
                    <p className="text-[11px] text-muted-foreground">#{order.id} · {new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-1">
                    <p className="text-[13px] font-semibold text-foreground">{formatAmount(order.amount)}</p>
                    <Badge variant="outline" className={`text-[10px] capitalize rounded-full px-2.5 ${statusColors[order.status] || ""}`}>
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Order ID</th>
                    <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Service</th>
                    <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Amount</th>
                    <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Status</th>
                    <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5 text-[13px] font-medium text-foreground">#{order.id}</td>
                      <td className="px-5 py-3.5 text-[13px] text-foreground">{order.service_name}</td>
                      <td className="px-5 py-3.5 text-[13px] font-semibold text-foreground">{formatAmount(order.amount)}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant="outline" className={`text-[10px] capitalize rounded-full px-2.5 ${statusColors[order.status] || ""}`}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardHome;
