import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { fetchOrders } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { Package, Search, X, AlertCircle } from "lucide-react";

const statusColors: Record<string, string> = {
  completed:  "bg-success/10 text-success border-success/20",
  processing: "bg-primary/10 text-primary border-primary/20",
  in_transit: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  pending:    "bg-warning/10 text-warning border-warning/20",
  cancelled:  "bg-destructive/10 text-destructive border-destructive/20",
  failed:     "bg-destructive/10 text-destructive border-destructive/20",
  refunded:   "bg-muted text-muted-foreground border-border",
};

const statusLabels: Record<string, string> = {
  in_transit: "In Transit",
  completed:  "Completed",
  processing: "Processing",
  pending:    "Pending",
  cancelled:  "Cancelled",
  failed:     "Failed",
  refunded:   "Refunded",
};

const serviceTypeLabels: Record<string, string> = {
  boosting:       "Boosting",
  phone_number:   "Phone Number",
  social_account: "Social Account",
  gift:           "Gift",
  web_dev:        "Web Dev",
};

const ALL_STATUSES = ["All", "pending", "processing", "in_transit", "completed", "failed", "cancelled", "refunded"];

const OrdersPage = () => {
  const { formatAmount } = useCurrency();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  const { data: orders, isLoading, isError, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: () => fetchOrders(),
    refetchInterval: (query) => {
      const hasActive = query.state.data?.some(
        (o) => o.status === "pending" || o.status === "processing" || o.status === "in_transit"
      );
      return hasActive ? 30000 : false;
    },
  });

  // Derive available service types from actual data
  const serviceTypes = useMemo(() => {
    if (!orders) return ["All"];
    const types = Array.from(new Set(orders.map((o) => o.service_type)));
    return ["All", ...types];
  }, [orders]);

  const filtered = useMemo(() => {
    if (!orders) return [];
    return orders.filter((order) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        order.service_name.toLowerCase().includes(q) ||
        String(order.id).includes(q);
      const matchesStatus = statusFilter === "All" || order.status === statusFilter;
      const matchesType = typeFilter === "All" || order.service_type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [orders, search, statusFilter, typeFilter]);

  const hasFilters = search || statusFilter !== "All" || typeFilter !== "All";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setTypeFilter("All");
  };

  const empty = !orders || orders.length === 0;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl sm:rounded-t-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-blue-600/10" />
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 header-diamond-pattern pointer-events-none" />
        <div className="p-6 md:p-8 relative z-20 flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Orders</h1>
            <p className="text-muted-foreground text-sm">Track and manage all your service orders</p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      {!empty && (
        <div className="glass-card p-4 space-y-3">
          <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by service name or order ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filters row */}
            <div className="flex gap-3">
              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 h-10 rounded-lg border border-border/50 bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "All" ? "All Statuses" : statusLabels[s] || s}
                  </option>
                ))}
              </select>

              {/* Type filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="flex-1 h-10 rounded-lg border border-border/50 bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                {serviceTypes.map((t) => (
                  <option key={t} value={t}>
                    {t === "All" ? "All Types" : serviceTypeLabels[t] || t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active filter summary */}
          {hasFilters && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{" "}
                <span className="font-semibold text-foreground">{orders?.length}</span> orders
              </p>
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" /> Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {isError ? (
          <div className="px-6 py-16 flex flex-col items-center gap-3">
            <AlertCircle className="h-8 w-8 text-destructive/40" />
            <p className="text-sm font-medium text-foreground">Failed to load orders</p>
            <p className="text-xs text-muted-foreground">Something went wrong. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : isLoading ? (
          <>
            {/* Mobile skeletons */}
            <div className="lg:hidden divide-y divide-border/30">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start justify-between gap-3 p-4">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <div className="space-y-2 text-right">
                    <Skeleton className="h-4 w-16 ml-auto" />
                    <Skeleton className="h-5 w-14 rounded-full ml-auto" />
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop skeletons */}
            <div className="hidden lg:block">
              <div className="bg-muted/50 border-b border-border px-6 py-3.5 flex gap-6">
                {["w-16", "w-32", "w-24", "w-16", "w-20", "w-20"].map((w, i) => (
                  <Skeleton key={i} className={`h-3 ${w}`} />
                ))}
              </div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-6 px-6 py-4 border-b border-border/30">
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-18 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </>
        ) : empty ? (
          <div className="px-6 py-16 text-center">
            <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-foreground font-medium mb-1">No orders yet</p>
            <p className="text-sm text-muted-foreground">Your order history will appear here once you place an order.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-foreground font-medium mb-1">No orders match your filters</p>
            <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <>
            {/* ── Mobile card list (hidden on lg+) ── */}
            <div className="lg:hidden divide-y divide-border/30">
              {filtered.map((order) => (
                <div key={order.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{order.service_name}</p>
                      <p className="text-xs text-muted-foreground capitalize mt-0.5">
                        {(serviceTypeLabels[order.service_type] || order.service_type.replace(/_/g, " "))} · #{order.id}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(order.created_at).toLocaleDateString("en-NG", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1.5">
                      <p className="text-sm font-bold text-foreground">{formatAmount(order.amount)}</p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${statusColors[order.status] || ""}`}
                      >
                        {statusLabels[order.status] || order.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop table (hidden below lg) ── */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Order ID</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Service</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Type</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Price</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Status</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order, index) => (
                    <tr
                      key={order.id}
                      className={`border-b border-border/30 transition-colors hover:bg-muted/40 ${
                        index % 2 === 1 ? "bg-muted/25" : ""
                      }`}
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-foreground">#{order.id}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-foreground">{order.service_name}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground capitalize">
                        {serviceTypeLabels[order.service_type] || order.service_type.replace(/_/g, " ")}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-foreground">
                        {formatAmount(order.amount)}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant="outline"
                          className={`text-xs font-semibold ${statusColors[order.status] || ""}`}
                        >
                          {statusLabels[order.status] || order.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("en-NG", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
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

export default OrdersPage;
