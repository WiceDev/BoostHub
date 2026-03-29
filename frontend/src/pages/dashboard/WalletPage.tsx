import { useState, useMemo } from "react";
import {
  Wallet, ArrowUpRight, ArrowDownRight, Eye, EyeOff, TrendingUp,
  TrendingDown, RotateCcw, HelpCircle,
  MessageCircle, Mail, ChevronDown, ChevronUp, Activity, AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchWallet, fetchTransactions, fetchDashboardStats, type Transaction } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";

const statusColors: Record<string, string> = {
  completed: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
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

// ── Chart data types ──

type TimeRange = "daily" | "weekly" | "monthly";
type Metric = "transactions" | "deposits" | "spending";

interface ChartPoint {
  key: string;
  label: string;
  value: number;
}

const metricConfig: Record<Metric, { label: string; color: string; colorVar: string }> = {
  transactions: { label: "Transactions", color: "hsl(217 91% 60%)", colorVar: "primary" },
  deposits: { label: "Total Deposits", color: "hsl(142 71% 45%)", colorVar: "success" },
  spending: { label: "Total Spending", color: "hsl(0 84% 60%)", colorVar: "destructive" },
};

// ── Grouping helpers ──

function getDayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}
function getDayLabel(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function getWeekKey(d: Date) {
  const start = new Date(d);
  start.setDate(start.getDate() - start.getDay());
  return start.toISOString().slice(0, 10);
}
function getWeekLabel(d: Date) {
  const start = new Date(d);
  start.setDate(start.getDate() - start.getDay());
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
function getMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
}
function getMonthLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function buildChartData(
  transactions: Transaction[],
  range: TimeRange,
  metric: Metric
): ChartPoint[] {
  const completed = transactions.filter((tx) => tx.status === "completed");
  if (completed.length === 0) return [];

  const keyFn = range === "daily" ? getDayKey : range === "weekly" ? getWeekKey : getMonthKey;
  const labelFn = range === "daily" ? getDayLabel : range === "weekly" ? getWeekLabel : getMonthLabel;
  const maxBuckets = range === "daily" ? 14 : range === "weekly" ? 8 : 8;

  const grouped = new Map<string, { label: string; count: number; deposits: number; spending: number }>();

  for (const tx of completed) {
    const date = new Date(tx.created_at);
    const key = keyFn(date);
    const label = labelFn(date);
    const amount = parseFloat(tx.amount);
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      if (tx.transaction_type === "credit") existing.deposits += amount;
      if (tx.transaction_type === "debit") existing.spending += amount;
    } else {
      grouped.set(key, {
        label,
        count: 1,
        deposits: tx.transaction_type === "credit" ? amount : 0,
        spending: tx.transaction_type === "debit" ? amount : 0,
      });
    }
  }

  const sorted = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-maxBuckets);

  return sorted.map(([key, data]) => ({
    key,
    label: data.label,
    value: metric === "transactions" ? data.count : metric === "deposits" ? data.deposits : data.spending,
  }));
}

// ── SVG Line Chart ──

function LineChart({
  data,
  metric,
  formatAmount,
}: {
  data: ChartPoint[];
  metric: Metric;
  formatAmount: (v: number | string) => string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const config = metricConfig[metric];
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  // Round up to nice number
  const niceMax = metric === "transactions"
    ? Math.ceil(maxVal / 5) * 5 || 5
    : Math.ceil(maxVal / 1000) * 1000 || 1000;

  const W = 640;
  const H = 240;
  const padLeft = 55;
  const padRight = 24;
  const padTop = 20;
  const padBot = 50;
  const graphW = W - padLeft - padRight;
  const graphH = H - padTop - padBot;

  const points = data.map((d, i) => ({
    x: padLeft + (data.length === 1 ? graphW / 2 : (i / (data.length - 1)) * graphW),
    y: padTop + graphH - (d.value / niceMax) * graphH,
    ...d,
  }));

  // Smooth curve using catmull-rom-ish approach
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

  const gridLines = 5;
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => {
    const val = (niceMax / gridLines) * i;
    const y = padTop + graphH - (val / niceMax) * graphH;
    return { val, y };
  });

  const formatYLabel = (val: number) => {
    if (metric === "transactions") return val.toFixed(0);
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val.toFixed(0);
  };

  const formatTooltipValue = (val: number) => {
    if (metric === "transactions") return `${val} transaction${val !== 1 ? "s" : ""}`;
    return formatAmount(val);
  };

  const gradientId = `grad-${metric}`;

  return (
    <div>
      <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={config.color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={config.color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y-axis grid + labels */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padLeft}
                y1={tick.y}
                x2={W - padRight}
                y2={tick.y}
                stroke="hsl(var(--border))"
                strokeWidth="0.5"
                strokeDasharray={i === 0 ? "0" : "4 3"}
                opacity="0.7"
              />
              <text
                x={padLeft - 10}
                y={tick.y + 3.5}
                textAnchor="end"
                className="fill-muted-foreground"
                style={{ fontSize: "10px", fontFamily: "Inter, sans-serif" }}
              >
                {formatYLabel(tick.val)}
              </text>
            </g>
          ))}

          {/* Area fill */}
          <path d={areaPath} fill={`url(#${gradientId})`} />

          {/* Line */}
          <path
            d={smoothLine}
            fill="none"
            stroke={config.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points + hover */}
          {points.map((p, i) => (
            <g key={p.key}>
              <rect
                x={p.x - 20}
                y={padTop}
                width={40}
                height={graphH}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />

              {/* Hover column highlight */}
              {hoveredIdx === i && (
                <line
                  x1={p.x}
                  y1={padTop}
                  x2={p.x}
                  y2={padTop + graphH}
                  stroke={config.color}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.3"
                />
              )}

              {/* Dot */}
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredIdx === i ? 6 : 3.5}
                fill={hoveredIdx === i ? config.color : "hsl(var(--background))"}
                stroke={config.color}
                strokeWidth="2"
                className="transition-all duration-150"
              />

              {/* X label */}
              <text
                x={p.x}
                y={H - 10}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: "9px", fontFamily: "Inter, sans-serif" }}
              >
                {p.label}
              </text>
            </g>
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <div
            className="absolute bg-foreground text-background text-[11px] px-3 py-2 rounded-lg shadow-lg pointer-events-none z-20 whitespace-nowrap"
            style={{
              left: `${(points[hoveredIdx].x / W) * 100}%`,
              top: `${Math.max((points[hoveredIdx].y / H) * 100 - 16, 2)}%`,
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-semibold">{formatTooltipValue(points[hoveredIdx].value)}</p>
            <p className="opacity-60 text-[10px]">{points[hoveredIdx].label}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──

const WalletPage = () => {
  const [showBalance, setShowBalance] = useState(true);
  const [chartRange, setChartRange] = useState<TimeRange>("daily");
  const [chartMetric, setChartMetric] = useState<Metric>("transactions");
  const [supportOpen, setSupportOpen] = useState(false);

  const { formatAmount, symbol, currency, toggleCurrency } = useCurrency();

  const { data: wallet, isLoading: walletLoading, isError: walletError, refetch: refetchWallet } = useQuery({ queryKey: ["wallet"], queryFn: fetchWallet });
  const { data: transactions, isLoading: txLoading, isError: txError, refetch: refetchTx } = useQuery({ queryKey: ["transactions"], queryFn: fetchTransactions });
  const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ["dashboard-stats"], queryFn: fetchDashboardStats });

  const isLoading = walletLoading || txLoading || statsLoading;
  const isError = walletError || txError;

  const balanceStr = wallet
    ? showBalance
      ? formatAmount(wallet.balance)
      : "••••••••"
    : "...";

  const totalDeposits = useMemo(() => {
    if (!transactions) return 0;
    return transactions
      .filter((tx) => tx.transaction_type === "credit" && tx.status === "completed")
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
  }, [transactions]);

  const totalSpent = stats ? parseFloat(stats.total_spent) : 0;

  const totalRefunds = useMemo(() => {
    if (!transactions) return 0;
    return transactions
      .filter((tx) => tx.transaction_type === "refund" && tx.status === "completed")
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
  }, [transactions]);

  const chartData = useMemo(
    () => buildChartData(transactions || [], chartRange, chartMetric),
    [transactions, chartRange, chartMetric]
  );

  const activeMetricConfig = metricConfig[chartMetric];

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-44 rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass-card p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
      <div className="glass-card p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-[240px] rounded-xl" />
      </div>
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border"><Skeleton className="h-5 w-40" /></div>
        <div className="divide-y divide-border/50">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <div className="text-right space-y-1.5">
                <Skeleton className="h-4 w-20 ml-auto" />
                <Skeleton className="h-4 w-14 ml-auto rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (isError) return (
    <div className="flex flex-col items-center justify-center py-24 space-y-3">
      <AlertCircle className="h-10 w-10 text-destructive/40" />
      <p className="text-base font-semibold text-foreground">Failed to load wallet</p>
      <p className="text-sm text-muted-foreground">Something went wrong fetching your wallet data.</p>
      <Button variant="outline" onClick={() => { refetchWallet(); refetchTx(); }}>Try again</Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Wallet</h1>

      {/* ── Balance Card ── */}
      <div className="relative overflow-hidden rounded-t-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-blue-600/10" />
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 header-diamond-pattern pointer-events-none" />
        <div className="p-6 sm:p-8 relative z-20">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Available Balance</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
              >
                {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                onClick={toggleCurrency}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                {currency === "NGN" ? "Show USD" : "Show NGN"}
              </button>
            </div>
          </div>
          <p className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mt-3 mb-6 text-foreground">{balanceStr}</p>
          <div className="flex items-center gap-3">
            <Link to="/dashboard/deposit">
              <Button>Deposit Funds</Button>
            </Link>
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-b from-transparent to-background pointer-events-none" />
      </div>

      {/* ── Spending Summary ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-xl bg-success/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
            <span className="text-sm text-muted-foreground">Total Deposits</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatAmount(totalDeposits)}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-xl bg-destructive/10 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
            <span className="text-sm text-muted-foreground">Total Spent</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatAmount(totalSpent)}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <RotateCcw className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Refunds</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatAmount(totalRefunds)}</p>
        </div>
      </div>

      {/* ── Activity Analytics ── */}
      <div className="glass-card">
        <div className="px-4 sm:px-6 py-4 border-b border-border">
          {/* Top row: title + time range */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-foreground">Activity Analytics</h2>
                <p className="text-xs text-muted-foreground">Track transactions, deposits, and spending trends</p>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1 self-start sm:self-auto">
              {(["daily", "weekly", "monthly"] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setChartRange(r)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                    chartRange === r
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Metric tabs */}
          <div className="flex flex-wrap gap-2">
            {(Object.entries(metricConfig) as [Metric, typeof metricConfig.transactions][]).map(
              ([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setChartMetric(key)}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all text-muted-foreground hover:text-foreground hover:bg-muted"
                  style={
                    chartMetric === key
                      ? { backgroundColor: `${cfg.color}15`, color: cfg.color, boxShadow: `inset 0 0 0 1px ${cfg.color}30` }
                      : undefined
                  }
                >
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                  {cfg.label}
                </button>
              )
            )}
          </div>
        </div>

        <div className="p-6">
          {chartData.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No activity data for this period yet.</p>
              <p className="text-xs mt-1">Make transactions to see trends here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <LineChart data={chartData} metric={chartMetric} formatAmount={formatAmount} />
              {/* Insights */}
              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activeMetricConfig.color }} />
                  <span className="text-xs text-muted-foreground">{activeMetricConfig.label}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{chartData.length} {chartRange === "daily" ? "days" : chartRange === "weekly" ? "weeks" : "months"}</span>
                  <span>·</span>
                  <span>
                    Peak:{" "}
                    {chartMetric === "transactions"
                      ? `${Math.max(...chartData.map((d) => d.value))} txns`
                      : formatAmount(Math.max(...chartData.map((d) => d.value)))}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Transaction History ── */}
      <div className="glass-card">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Transaction History</h2>
          {transactions && transactions.length > 0 && (
            <span className="text-xs text-muted-foreground">{transactions.length} transactions</span>
          )}
        </div>
        <div className="divide-y divide-border/50">
          {(!transactions || transactions.length === 0) ? (
            <div className="px-6 py-12 text-center text-muted-foreground text-sm">
              No transactions yet. Deposit funds to get started.
            </div>
          ) : (
            transactions.map((tx) => {
              const isCredit = tx.transaction_type === "credit" || tx.transaction_type === "refund";
              const Icon = typeIcons[tx.transaction_type] || ArrowDownRight;
              const amountStr = `${isCredit ? "+" : "-"}${formatAmount(tx.amount)}`;
              const date = new Date(tx.created_at);
              return (
                <div key={tx.id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 hover:bg-muted/30 transition-colors">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isCredit ? "bg-success/10" : "bg-destructive/10"
                  }`}>
                    <Icon className={`h-4 w-4 ${isCredit ? "text-success" : "text-destructive"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {tx.description || typeLabels[tx.transaction_type] || tx.transaction_type}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {" · "}
                      {date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-semibold ${isCredit ? "text-success" : "text-foreground"}`}>
                      {amountStr}
                    </p>
                    <Badge variant="outline" className={`text-[10px] mt-1 capitalize ${statusColors[tx.status] || ""}`}>
                      {tx.status}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Help & Support ── */}
      <div className="glass-card">
        <button
          onClick={() => setSupportOpen(!supportOpen)}
          className="w-full px-6 py-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <HelpCircle className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-semibold text-foreground">Help & Support</h2>
              <p className="text-xs text-muted-foreground">Having issues with deposits or transactions?</p>
            </div>
          </div>
          {supportOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {supportOpen && (
          <div className="px-6 pb-6 pt-2 border-t border-border space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border p-4 space-y-2">
                <div className="flex items-center gap-2 text-foreground">
                  <MessageCircle className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium">WhatsApp Support</span>
                </div>
                <p className="text-xs text-muted-foreground">Get instant help from our support team via WhatsApp.</p>
                <a href="https://wa.me/2348000000000" target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="w-full mt-1">Chat on WhatsApp</Button>
                </a>
              </div>
              <div className="rounded-xl border border-border p-4 space-y-2">
                <div className="flex items-center gap-2 text-foreground">
                  <Mail className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Email Support</span>
                </div>
                <p className="text-xs text-muted-foreground">Send us an email and we'll respond within 24 hours.</p>
                <a href="mailto:support@boosthub.com">
                  <Button size="sm" variant="outline" className="w-full mt-1">Send Email</Button>
                </a>
              </div>
            </div>
            <div className="rounded-xl bg-warning/5 border border-warning/20 p-4">
              <p className="text-sm font-medium text-warning mb-1">Deposit not reflecting?</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If your deposit has not been credited after 15 minutes, please contact support with your payment reference.
                Do not make a duplicate payment — our team will resolve it promptly.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletPage;
