import { useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "react-router-dom";
import {
  TrendingUp, Search, Loader2, Zap, AlertTriangle,
  CheckCircle2, RefreshCw, Wallet, Info, ChevronRight,
  RotateCcw, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBoostingServices, placeBoostingOrder, fetchWallet, fetchOrders,
  type BoostingService, type Order, ApiError,
} from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// transparent: true = icon has transparent bg, use brand color as container bg
// transparent: false / absent = icon has its own solid bg (jpg), crop as-is
const platformConfig: Record<string, { icon: string; image?: string; solid: string; color: string; bg: string; bgColor?: string; transparent?: boolean }> = {
  Instagram: { icon: "📸", image: "/icons/instagram.avif", solid: "bg-pink-500",   color: "text-pink-500",   bg: "bg-pink-500/10",   bgColor: "#E1306C", transparent: true  },
  TikTok:    { icon: "🎵", image: "/icons/tiktok.png",     solid: "bg-slate-900",  color: "text-slate-400",  bg: "bg-slate-500/10",  bgColor: "#010101", transparent: true  },
  Twitter:   { icon: "🐦", image: "/icons/twitter.avif",   solid: "bg-blue-400",   color: "text-blue-400",   bg: "bg-blue-400/10",   bgColor: "#1DA1F2", transparent: true  },
  YouTube:   { icon: "▶️", image: "/icons/youtube.jpg",    solid: "bg-red-500",    color: "text-red-500",    bg: "bg-red-500/10",    transparent: false },
  Facebook:  { icon: "👤", image: "/icons/facebook.png",   solid: "bg-blue-600",   color: "text-blue-600",   bg: "bg-blue-600/10",   bgColor: "#1877F2", transparent: true  },
  Telegram:  { icon: "✈️", image: "/icons/telegram.jpg",   solid: "bg-sky-500",    color: "text-sky-500",    bg: "bg-sky-500/10",    transparent: false },
  Spotify:   { icon: "🎧", image: "/icons/spotify.jpg",    solid: "bg-green-500",  color: "text-green-500",  bg: "bg-green-500/10",  transparent: false },
  LinkedIn:  { icon: "💼", image: "/icons/linkedin.png",   solid: "bg-blue-700",   color: "text-blue-700",   bg: "bg-blue-700/10",   bgColor: "#0A66C2", transparent: true  },
  Snapchat:  { icon: "👻", image: "/icons/snapchat.jpg",   solid: "bg-yellow-400", color: "text-yellow-500", bg: "bg-yellow-400/10", transparent: false },
  Threads:   { icon: "🧵", solid: "bg-gray-800",   color: "text-gray-400",   bg: "bg-gray-500/10"   },
  Discord:   { icon: "🎮", solid: "bg-indigo-500", color: "text-indigo-500", bg: "bg-indigo-500/10" },
  Twitch:    { icon: "🎬", solid: "bg-purple-500", color: "text-purple-500", bg: "bg-purple-500/10" },
  SoundCloud:{ icon: "🔊", solid: "bg-orange-500", color: "text-orange-500", bg: "bg-orange-500/10" },
  Pinterest: { icon: "📌", solid: "bg-red-500",    color: "text-red-400",    bg: "bg-red-400/10"    },
  Reddit:    { icon: "🤖", solid: "bg-orange-500", color: "text-orange-500", bg: "bg-orange-500/10" },
  Other:     { icon: "⚡", solid: "bg-gray-600",   color: "text-gray-400",   bg: "bg-gray-500/10"   },
};

const PlatformIcon = ({ config, size = "lg" }: { config: { icon: string; image?: string; solid: string; bgColor?: string; transparent?: boolean }; size?: "sm" | "lg" }) => {
  const dims = size === "lg" ? "h-14 w-14 rounded-2xl" : "h-8 w-8 rounded-lg";
  const textSize = size === "lg" ? "text-2xl" : "text-base";

  if (config.image) {
    return (
      <img src={config.image} alt="" className={`${dims} flex-shrink-0 object-contain`} />
    );
  }
  return (
    <div className={`${dims} ${config.solid} flex items-center justify-center flex-shrink-0`}>
      <span className={textSize}>{config.icon}</span>
    </div>
  );
};

const BoostingPage = () => {
  const { formatAmount } = useCurrency();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Order dialog state
  const [selectedService, setSelectedService] = useState<BoostingService | null>(null);
  const [link, setLink] = useState("");
  const [quantity, setQuantity] = useState("");
  const [ordering, setOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const { data: services = [], isLoading, error } = useQuery({
    queryKey: ["boosting-services"],
    queryFn: fetchBoostingServices,
    staleTime: 5 * 60 * 1000,
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: fetchWallet,
  });

  const { data: boostOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["orders", "smm_boost"],
    queryFn: () => fetchOrders("smm_boost"),
  });

  // Group services: platform → category → services[]
  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = search
      ? services.filter((s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.platform.toLowerCase().includes(q))
      : services;

    const map: Record<string, Record<string, BoostingService[]>> = {};
    for (const svc of filtered) {
      if (!map[svc.platform]) map[svc.platform] = {};
      if (!map[svc.platform][svc.category]) map[svc.platform][svc.category] = [];
      map[svc.platform][svc.category].push(svc);
    }
    // Sort services within each category by price (lowest first)
    for (const platform of Object.keys(map)) {
      for (const category of Object.keys(map[platform])) {
        map[platform][category].sort(
          (a, b) => parseFloat(a.rate_per_k_ngn) - parseFloat(b.rate_per_k_ngn)
        );
      }
    }
    return map;
  }, [services, search]);

  const sortedPlatforms = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => {
      const countA = Object.values(grouped[a]).reduce((sum, arr) => sum + arr.length, 0);
      const countB = Object.values(grouped[b]).reduce((sum, arr) => sum + arr.length, 0);
      return countB - countA;
    });
  }, [grouped]);

  // Price calculation
  const qty = parseInt(quantity) || 0;
  const costNgn = selectedService ? (qty / 1000) * parseFloat(selectedService.rate_per_k_ngn) : 0;
  const balance = wallet ? parseFloat(wallet.balance) : 0;
  const canAfford = balance >= costNgn;
  const qtyValid = selectedService ? qty >= selectedService.min && qty <= selectedService.max : false;

  const openOrder = (svc: BoostingService) => {
    setSelectedService(svc);
    setLink("");
    setQuantity(String(svc.min));
    setOrdering(false);
    setOrderSuccess(false);
  };

  const handlePlaceOrder = async () => {
    if (!selectedService || !link.trim() || !qtyValid) return;
    if (!canAfford) {
      toast.error("Insufficient balance. Please add funds first.");
      return;
    }
    setOrdering(true);
    try {
      await placeBoostingOrder({
        service_id: selectedService.id,
        link: link.trim(),
        quantity: qty,
      });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setOrderSuccess(true);
      toast.success("Order placed successfully!");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to place order.";
      toast.error(msg);
    }
    setOrdering(false);
  };

  // Figure out which row index a platform is in (3 per row on lg, 2 on sm, 1 on xs)
  const getRowIndex = (platformIndex: number) => Math.floor(platformIndex / 3);

  const togglePlatform = (platform: string, platformIndex: number) => {
    if (isMobile) {
      setExpandedPlatforms((prev) => {
        const next = new Set(prev);
        if (next.has(platform)) next.delete(platform);
        else next.add(platform);
        return next;
      });
      setExpandedCategories(new Set());
      return;
    }
    const row = getRowIndex(platformIndex);
    if (expandedRow === row && activePlatform === platform) {
      setExpandedRow(null);
      setActivePlatform(null);
      setExpandedCategories(new Set());
    } else {
      setExpandedRow(row);
      setActivePlatform(platform);
      setExpandedCategories(new Set());
    }
  };

  const toggleCategory = (catKey: string) => {
    setExpandedCategories((prev) => {
      if (prev.has(catKey)) return new Set();
      return new Set([catKey]);
    });
  };

  const cfg = (platform: string) => platformConfig[platform] || platformConfig.Other;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-t-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-blue-600/10" />
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 header-diamond-pattern pointer-events-none" />
        <div className="p-6 md:p-8 relative z-20 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Social Media Boosting</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {services.length} services across {Object.keys(grouped).length} platforms &middot; Wallet: {wallet ? formatAmount(wallet.balance) : "..."}
              </p>
            </div>
          </div>
          <Link to="/dashboard/deposit">
            <Button variant="outline" className="gap-2">
              <Wallet className="h-4 w-4" /> Add Funds
            </Button>
          </Link>
        </div>
        <div className="hidden sm:block absolute bottom-0 inset-x-0 h-20 bg-gradient-to-b from-transparent to-background pointer-events-none" />
      </div>

      {/* Search */}
      <div className="glass-card p-1.5">
        <div className="flex items-center gap-3 px-4 py-2">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Search platforms, categories, or services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
          )}
        </div>
      </div>

      {/* Platform Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card p-5">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-2xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="glass-card p-16 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-amber-500/30" />
          <h3 className="text-lg font-semibold text-foreground mb-1">Failed to load services</h3>
          <p className="text-sm text-muted-foreground mb-5">Please try again later.</p>
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["boosting-services"] })}>
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </div>
      ) : sortedPlatforms.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Zap className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No services found</h3>
          <p className="text-sm text-muted-foreground">Try adjusting your search.</p>
        </div>
      ) : (
        <>
          {/* Platform cards in 3-col grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedPlatforms.map((platform, idx) => {
              const c = cfg(platform);
              const categories = grouped[platform];
              const totalServices = Object.values(categories).reduce((sum, arr) => sum + arr.length, 0);
              const rowIdx = getRowIndex(idx);
              const isExpanded = isMobile ? expandedPlatforms.has(platform) : activePlatform === platform;
              return (
                <div
                  key={platform}
                  className={`glass-card overflow-hidden transition-all duration-300 ${isExpanded ? "ring-1 ring-primary/20 shadow-md" : "hover:border-primary/20 hover:shadow-md"}`}
                >
                  {/* Platform card header */}
                  <button
                    onClick={() => togglePlatform(platform, idx)}
                    className="w-full p-5 text-left transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-4">
                      <PlatformIcon config={c} size="lg" />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-foreground">{platform}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {totalServices} services &middot; {Object.keys(categories).length} categories
                        </p>
                      </div>
                      <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border/30 max-h-[400px] overflow-y-auto">
                      {Object.keys(categories).sort().map((category) => {
                        const catServices = categories[category];
                        const catKey = `${platform}-${category}`;
                        const isCatOpen = expandedCategories.has(catKey);

                        return (
                          <div key={catKey}>
                            <button
                              onClick={() => toggleCategory(catKey)}
                              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors border-b border-border/20"
                            >
                              <ChevronRight className={`h-4 w-4 ${c.color} transition-transform duration-200 ${isCatOpen ? "rotate-90" : ""}`} />
                              <span className={`text-sm font-bold ${c.color}`}>{category}</span>
                              <span className="text-xs text-muted-foreground font-medium">({catServices.length} services)</span>
                            </button>

                            {isCatOpen && (
                              <div className="bg-muted/10">
                                {catServices.map((svc) => (
                                  <div
                                    key={svc.id}
                                    onClick={() => openOrder(svc)}
                                    className="flex items-center gap-3 px-6 py-3 hover:bg-primary/5 cursor-pointer transition-colors border-b border-border/10 last:border-b-0 group"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                        {svc.name}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] text-muted-foreground">
                                          {svc.min.toLocaleString()} - {svc.max.toLocaleString()}
                                        </span>
                                        {svc.refill && (
                                          <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                            <RotateCcw className="h-2.5 w-2.5" /> Refill
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <p className="text-base font-extrabold text-foreground">{formatAmount(svc.rate_per_k_ngn)}</p>
                                      <p className="text-[10px] text-muted-foreground font-medium">per 1,000</p>
                                    </div>
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors flex-shrink-0" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Boosting Orders Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border/30">
          <h2 className="text-base font-bold text-foreground">My Boosting Orders</h2>
        </div>

        {/* Mobile + tablet cards */}
        <div className="lg:hidden divide-y divide-border/30">
          {ordersLoading ? (
            <>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start justify-between gap-3 p-4">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <div className="space-y-2 text-right">
                    <Skeleton className="h-4 w-16 ml-auto" />
                    <Skeleton className="h-5 w-14 rounded-full ml-auto" />
                  </div>
                </div>
              ))}
            </>
          ) : boostOrders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No boosting orders yet.</div>
          ) : (
            (boostOrders as Order[]).map((order) => {
              const extData = order.external_data as Record<string, string | number>;
              const orderLink = (extData?.link as string) || "—";
              const qty = extData?.quantity;
              const boostStatusColors: Record<string, string> = {
                completed:  "bg-success/10 text-success border-success/20",
                processing: "bg-primary/10 text-primary border-primary/20",
                in_transit: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
                pending:    "bg-warning/10 text-warning border-warning/20",
                cancelled:  "bg-destructive/10 text-destructive border-destructive/20",
                failed:     "bg-destructive/10 text-destructive border-destructive/20",
                refunded:   "bg-muted text-muted-foreground border-border",
              };
              const boostStatusLabels: Record<string, string> = {
                completed: "Completed", processing: "Processing", in_transit: "In Transit",
                pending: "Pending", cancelled: "Cancelled", failed: "Failed", refunded: "Refunded",
              };
              return (
                <div key={order.id} className="p-4 sm:p-5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{order.service_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">#{order.id} · {qty ? Number(qty).toLocaleString() : "—"} units</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{orderLink}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(order.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1.5">
                      <p className="text-sm font-bold text-foreground">{formatAmount(order.amount)}</p>
                      <Badge variant="outline" className={`text-[10px] font-semibold ${boostStatusColors[order.status] || ""}`}>
                        {boostStatusLabels[order.status] || order.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Order ID</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Service</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Link</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Qty</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Price</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Status</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Date</th>
              </tr>
            </thead>
            <tbody>
              {ordersLoading ? (
                <>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td className="px-6 py-4"><Skeleton className="h-4 w-10" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-40" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                    </tr>
                  ))}
                </>
              ) : boostOrders.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No boosting orders yet.</td></tr>
              ) : (
                (boostOrders as Order[]).map((order, index) => {
                  const extData = order.external_data as Record<string, string | number>;
                  const orderLink = (extData?.link as string) || "—";
                  const quantity = extData?.quantity;
                  const boostStatusColors: Record<string, string> = {
                    completed:  "bg-success/10 text-success border-success/20",
                    processing: "bg-primary/10 text-primary border-primary/20",
                    in_transit: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
                    pending:    "bg-warning/10 text-warning border-warning/20",
                    cancelled:  "bg-destructive/10 text-destructive border-destructive/20",
                    failed:     "bg-destructive/10 text-destructive border-destructive/20",
                    refunded:   "bg-muted text-muted-foreground border-border",
                  };
                  const boostStatusLabels: Record<string, string> = {
                    completed: "Completed", processing: "Processing", in_transit: "In Transit",
                    pending: "Pending", cancelled: "Cancelled", failed: "Failed", refunded: "Refunded",
                  };
                  return (
                    <tr
                      key={order.id}
                      className={`border-b border-border/30 transition-colors hover:bg-muted/40 ${index % 2 === 1 ? "bg-muted/25" : ""}`}
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-foreground">#{order.id}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-foreground max-w-[200px] truncate">{order.service_name}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground max-w-[160px]">
                        <p className="truncate">{orderLink}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {quantity ? Number(quantity).toLocaleString() : "—"}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-foreground">{formatAmount(order.amount)}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={`text-xs font-semibold ${boostStatusColors[order.status] || ""}`}>
                          {boostStatusLabels[order.status] || order.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Dialog */}
      <Dialog open={!!selectedService && !orderSuccess} onOpenChange={() => setSelectedService(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedService && (
                <>
                  <PlatformIcon config={cfg(selectedService.platform)} size="sm" />
                  <span className="truncate text-sm">{selectedService.name}</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedService && (
            <div className="space-y-4 py-2">
              {/* Service info */}
              <div className="rounded-xl border border-border/30 bg-muted/20 p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="font-bold text-foreground">{formatAmount(selectedService.rate_per_k_ngn)} / 1,000</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Min — Max</span>
                  <span className="font-semibold text-foreground">{selectedService.min.toLocaleString()} — {selectedService.max.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Your Balance</span>
                  <span className="font-bold text-primary">{wallet ? formatAmount(wallet.balance) : "..."}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Link *</Label>
                <Input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://instagram.com/username"
                  className="h-11"
                />
                <p className="text-[10px] text-muted-foreground">Enter the URL of the profile or post you want to boost</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Quantity *</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min={selectedService.min}
                  max={selectedService.max}
                  placeholder={`Min: ${selectedService.min.toLocaleString()}, Max: ${selectedService.max.toLocaleString()}`}
                  className="h-11"
                />
                {qty > 0 && !qtyValid && (
                  <p className="text-[10px] text-red-500">
                    Must be between {selectedService.min.toLocaleString()} and {selectedService.max.toLocaleString()}
                  </p>
                )}
              </div>

              {/* Price breakdown */}
              {qty > 0 && qtyValid && (
                <div className="rounded-xl border border-border/30 bg-primary/5 p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-muted-foreground">Total Cost</span>
                    <span className="text-xl font-bold text-foreground">{formatAmount(costNgn.toFixed(2))}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {qty.toLocaleString()} x {formatAmount(selectedService.rate_per_k_ngn)} / 1,000
                  </p>
                </div>
              )}

              {/* Insufficient balance warning */}
              {qty > 0 && qtyValid && !canAfford && (
                <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-500">Insufficient Balance</p>
                    <p className="text-xs text-amber-400/80 mt-0.5">
                      You need {formatAmount(costNgn.toFixed(2))} but only have {formatAmount(wallet?.balance || "0")}.
                    </p>
                    <Link to="/dashboard/deposit" className="text-xs font-semibold text-primary hover:underline mt-1 inline-block">
                      Add Funds &rarr;
                    </Link>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <p>Orders are processed automatically. Delivery time varies by service. Amount will be deducted from your wallet.</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedService(null)}>Cancel</Button>
            <Button
              onClick={handlePlaceOrder}
              disabled={ordering || !link.trim() || !qtyValid || !canAfford}
              className="shadow-lg text-white bg-primary"
            >
              {ordering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              Place Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={orderSuccess} onOpenChange={() => { setOrderSuccess(false); setSelectedService(null); }}>
        <DialogContent className="sm:max-w-sm text-center">
          <div className="py-6">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Order Placed!</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Your order for {selectedService?.name} is being processed. You can track it in your orders page.
            </p>
            <div className="rounded-xl bg-muted/30 p-3 mt-4 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Service</span>
                <span className="font-semibold text-foreground truncate ml-2">{selectedService?.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Quantity</span>
                <span className="font-semibold text-foreground">{qty.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-foreground">{formatAmount(costNgn.toFixed(2))}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-6 justify-center">
              <Button variant="outline" onClick={() => { setOrderSuccess(false); setSelectedService(null); }}>
                Continue Browsing
              </Button>
              <Link to="/dashboard/orders">
                <Button>View Orders</Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BoostingPage;
