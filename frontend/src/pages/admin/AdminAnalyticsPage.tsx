import { useMemo } from "react";
import {
  BarChart2, TrendingUp, Users, ShoppingBag, DollarSign, Loader2,
  ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminAnalytics, type ServiceBreakdown, type StatusBreakdown } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ── Colours ──────────────────────────────────────────────────────────────────
const SERVICE_COLORS: Record<string, string> = {
  smm_boost:        "#6366f1",
  phone_number:     "#0ea5e9",
  social_account:   "#10b981",
  gift:             "#f59e0b",
  website_template: "#ec4899",
};

const STATUS_COLORS: Record<string, string> = {
  completed:  "#10b981",
  processing: "#6366f1",
  pending:    "#f59e0b",
  in_transit: "#0ea5e9",
  failed:     "#ef4444",
  refunded:   "#8b5cf6",
  cancelled:  "#6b7280",
};

const SERVICE_LABELS: Record<string, string> = {
  smm_boost:        "SMM Boosting",
  phone_number:     "Phone Numbers",
  social_account:   "Social Accounts",
  gift:             "Gifts",
  website_template: "Website Template",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function Trend({ current, previous, prefix = "" }: { current: number; previous: number; prefix?: string }) {
  const pct = pctChange(current, previous);
  const up = pct > 0;
  const neutral = pct === 0;
  return (
    <div className={`flex items-center gap-1 text-xs font-semibold ${neutral ? "text-muted-foreground" : up ? "text-emerald-500" : "text-red-500"}`}>
      {neutral
        ? <Minus className="h-3 w-3" />
        : up
        ? <ArrowUpRight className="h-3 w-3" />
        : <ArrowDownRight className="h-3 w-3" />}
      {prefix}{Math.abs(pct).toFixed(1)}% vs last month
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({
  active, payload, label, valuePrefix = "", valueSuffix = "",
}: {
  active?: boolean; payload?: { name: string; value: number; color: string }[];
  label?: string; valuePrefix?: string; valueSuffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/40 bg-background/95 backdrop-blur shadow-xl p-3 text-xs space-y-1">
      <p className="font-bold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-semibold text-foreground">{valuePrefix}{p.value.toLocaleString()}{valueSuffix}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const AdminAnalyticsPage = () => {
  const { formatAmount } = useCurrency();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: fetchAdminAnalytics,
    staleTime: 5 * 60 * 1000,
  });

  const serviceData = useMemo(
    () => (data?.service_breakdown ?? []).map((s: ServiceBreakdown) => ({
      name: SERVICE_LABELS[s.service_type] ?? s.service_type,
      value: s.count,
      revenue: s.revenue,
      color: SERVICE_COLORS[s.service_type] ?? "#94a3b8",
    })),
    [data]
  );

  const statusData = useMemo(
    () => (data?.status_breakdown ?? []).map((s: StatusBreakdown) => ({
      name: s.status.charAt(0).toUpperCase() + s.status.slice(1),
      value: s.count,
      color: STATUS_COLORS[s.status] ?? "#94a3b8",
    })),
    [data]
  );

  const totalOrders = statusData.reduce((acc, s) => acc + s.value, 0) || 1;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-3" />
        <span className="text-sm text-muted-foreground">Loading analytics…</span>
      </div>
    );
  }

  const tm = data!.this_month;
  const lm = data!.last_month;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 md:p-8 relative bg-primary">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/[0.03] -translate-y-1/3 translate-x-1/4" />
          <div className="relative flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
              <BarChart2 className="h-6 w-6 text-violet-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Analytics</h1>
              <p className="text-white/50 text-sm mt-0.5">Platform performance over the last 30 days</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Month Comparison Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium leading-tight">Revenue This Month</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatAmount(tm.revenue)}</p>
          <Trend current={tm.revenue} previous={lm.revenue} />
          <p className="text-xs text-muted-foreground">Last month: {formatAmount(lm.revenue)}</p>
        </div>

        {/* Net Profit */}
        <div className="glass-card p-5 space-y-3 border-violet-500/20">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-4 w-4 text-violet-500" />
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium leading-tight">Net Profit This Month</p>
          </div>
          <p className="text-2xl font-bold text-violet-500">{formatAmount(tm.profit)}</p>
          <Trend current={tm.profit} previous={lm.profit} />
          <p className="text-xs text-muted-foreground">
            Margin: {tm.revenue > 0 ? ((tm.profit / tm.revenue) * 100).toFixed(1) : "0"}%
          </p>
        </div>

        {/* Orders */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium leading-tight">Orders This Month</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{tm.orders.toLocaleString()}</p>
          <Trend current={tm.orders} previous={lm.orders} />
          <p className="text-xs text-muted-foreground">Last month: {lm.orders.toLocaleString()}</p>
        </div>

        {/* New Users */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-sky-500/10 flex items-center justify-center flex-shrink-0">
              <Users className="h-4 w-4 text-sky-500" />
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium leading-tight">New Users This Month</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{tm.users.toLocaleString()}</p>
          <Trend current={tm.users} previous={lm.users} />
          <p className="text-xs text-muted-foreground">Last month: {lm.users.toLocaleString()}</p>
        </div>
      </div>

      {/* ── Revenue vs Profit Chart ── */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Revenue vs Net Profit (Last 30 Days)</h2>
              <p className="text-xs text-muted-foreground">Completed + processing orders — profit = revenue minus API cost</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Revenue</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" />Net Profit</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data!.revenue_chart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} interval={4} />
            <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false}
              tickFormatter={(v) => v >= 1000 ? `₦${(v / 1000).toFixed(0)}k` : `₦${v}`} width={52} />
            <Tooltip content={<ChartTooltip valuePrefix="₦" />} />
            <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" dot={false} name="Revenue" />
            <Area type="monotone" dataKey="profit" stroke="#8b5cf6" strokeWidth={2} fill="url(#profGrad)" dot={false} name="Profit" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Orders + Users side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders chart */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Daily Orders</h2>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data!.orders_chart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="orders" stroke="#6366f1" strokeWidth={2} fill="url(#ordGrad)" dot={false} name="Orders" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Users chart */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-sky-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">New Signups</h2>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data!.users_chart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="usrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="users" stroke="#0ea5e9" strokeWidth={2} fill="url(#usrGrad)" dot={false} name="Users" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Service Breakdown + Status Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service breakdown — donut */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <BarChart2 className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Orders by Service</h2>
              <p className="text-xs text-muted-foreground">All-time distribution</p>
            </div>
          </div>

          {serviceData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No orders yet</div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={serviceData} dataKey="value" cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3}>
                    {serviceData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-border/40 bg-background/95 shadow-xl p-3 text-xs space-y-1">
                          <p className="font-bold">{d.name}</p>
                          <p className="text-muted-foreground">{d.value} orders &nbsp;·&nbsp; {formatAmount(d.revenue)}</p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                {serviceData.map((s) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-xs text-foreground flex-1 truncate">{s.name}</span>
                    <span className="text-xs font-bold text-foreground">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Status breakdown — horizontal bar */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Order Status Breakdown</h2>
              <p className="text-xs text-muted-foreground">All-time, across all services</p>
            </div>
          </div>

          {statusData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No orders yet</div>
          ) : (
            <div className="space-y-3">
              {statusData.map((s) => (
                <div key={s.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                      <span className="text-foreground font-medium">{s.name}</span>
                    </div>
                    <span className="text-muted-foreground font-semibold">
                      {s.value} <span className="text-muted-foreground/60">({((s.value / totalOrders) * 100).toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(s.value / totalOrders) * 100}%`, background: s.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Revenue by Service bar chart ── */}
      {serviceData.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Revenue by Service</h2>
              <p className="text-xs text-muted-foreground">All-time, completed + processing</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={serviceData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false}
                tickFormatter={(v) => v >= 1000 ? `₦${(v / 1000).toFixed(0)}k` : `₦${v}`} width={52} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-xl border border-border/40 bg-background/95 shadow-xl p-3 text-xs space-y-1">
                    <p className="font-bold">{label}</p>
                    <p className="text-muted-foreground">{formatAmount(payload[0].value as number)}</p>
                  </div>
                );
              }} />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]} name="Revenue">
                {serviceData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default AdminAnalyticsPage;
