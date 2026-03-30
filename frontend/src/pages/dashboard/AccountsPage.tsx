import { useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "react-router-dom";
import {
  UserCheck, Wallet, Loader2, AlertTriangle,
  ShoppingCart, ChevronDown, ChevronRight, Package, Copy, Check,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAccounts, placeAccountOrder, fetchOrders, fetchWallet,
  type SocialMediaAccountListing, type Order, ApiError,
} from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// All platforms always shown in the grid (even if 0 services)
const ALL_PLATFORMS = [
  "Instagram", "Facebook", "Twitter", "TikTok",
  "Telegram", "YouTube", "Snapchat", "LinkedIn",
];

// transparent: true = icon has transparent bg → white bg + scale-125 crop
// transparent: false = solid-bg jpg → object-cover
const platformConfig: Record<string, {
  image?: string; emoji: string; solid: string;
  color: string; bg: string; transparent?: boolean;
}> = {
  Instagram: { image: "/icons/instagram.avif", emoji: "📸", solid: "bg-pink-500",   color: "text-pink-500",   bg: "bg-pink-500/10",   transparent: true  },
  Facebook:  { image: "/icons/facebook.png",   emoji: "👤", solid: "bg-blue-600",   color: "text-blue-500",   bg: "bg-blue-600/10",   transparent: true  },
  Twitter:   { image: "/icons/twitter.avif",   emoji: "🐦", solid: "bg-blue-400",   color: "text-blue-400",   bg: "bg-blue-400/10",   transparent: true  },
  TikTok:    { image: "/icons/tiktok.png",     emoji: "🎵", solid: "bg-slate-900",  color: "text-slate-300",  bg: "bg-slate-500/10",  transparent: true  },
  Telegram:  { image: "/icons/telegram.jpg",   emoji: "✈️", solid: "bg-sky-500",    color: "text-sky-400",    bg: "bg-sky-500/10",    transparent: false },
  YouTube:   { image: "/icons/youtube.jpg",    emoji: "▶️", solid: "bg-red-500",    color: "text-red-500",    bg: "bg-red-500/10",    transparent: false },
  Snapchat:  { image: "/icons/snapchat.jpg",   emoji: "👻", solid: "bg-yellow-400", color: "text-yellow-500", bg: "bg-yellow-400/10", transparent: false },
  LinkedIn:  { image: "/icons/linkedin.png",   emoji: "💼", solid: "bg-blue-700",   color: "text-blue-600",   bg: "bg-blue-700/10",   transparent: true  },
};

const PlatformIcon = ({
  platform, size = "lg",
}: { platform: string; size?: "sm" | "lg" }) => {
  const cfg = platformConfig[platform];
  const dims = size === "lg" ? "h-14 w-14 rounded-2xl" : "h-8 w-8 rounded-lg";
  const textSize = size === "lg" ? "text-2xl" : "text-base";

  if (cfg?.image) {
    return (
      <img src={cfg.image} alt={platform} className={`${dims} flex-shrink-0 object-contain`} />
    );
  }
  return (
    <div className={`${dims} ${cfg?.solid ?? "bg-muted"} flex items-center justify-center flex-shrink-0`}>
      <span className={textSize}>{cfg?.emoji ?? "📱"}</span>
    </div>
  );
};

const statusColors: Record<string, string> = {
  completed:  "bg-success/10 text-success border-success/20",
  processing: "bg-primary/10 text-primary border-primary/20",
  pending:    "bg-warning/10 text-warning border-warning/20",
  failed:     "bg-destructive/10 text-destructive border-destructive/20",
  cancelled:  "bg-destructive/10 text-destructive border-destructive/20",
  refunded:   "bg-muted text-muted-foreground border-border",
};

const statusLabels: Record<string, string> = {
  completed: "Completed", processing: "Processing", pending: "Pending",
  failed: "Failed", cancelled: "Cancelled", refunded: "Refunded",
};

const AccountsPage = () => {
  const { formatAmount } = useCurrency();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Row-expansion state (same pattern as BoostingPage)
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set());
  const [copiedResultId, setCopiedResultId] = useState<number | null>(null);

  const handleCopyResult = (orderId: number, result: string) => {
    navigator.clipboard.writeText(result);
    setCopiedResultId(orderId);
    toast.success("Account details copied!");
    setTimeout(() => setCopiedResultId(null), 2000);
  };

  // Purchase modal state
  const [selectedAccount, setSelectedAccount] = useState<SocialMediaAccountListing | null>(null);
  const [details, setDetails] = useState<Record<string, string>>({});
  const [placing, setPlacing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const { data: accounts = [], isLoading, error } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["orders", "social_account"],
    queryFn: () => fetchOrders("social_account"),
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: fetchWallet,
  });

  const balance = wallet ? parseFloat(wallet.balance) : 0;

  // Group accounts by platform
  const byPlatform = useMemo(() => {
    const map: Record<string, SocialMediaAccountListing[]> = {};
    for (const item of accounts) {
      if (!map[item.platform]) map[item.platform] = [];
      map[item.platform].push(item);
    }
    return map;
  }, [accounts]);

  const getRowIndex = (idx: number) => Math.floor(idx / 3);

  const togglePlatform = (platform: string, idx: number) => {
    if (isMobile) {
      setExpandedPlatforms((prev) => {
        const next = new Set(prev);
        if (next.has(platform)) next.delete(platform);
        else next.add(platform);
        return next;
      });
      return;
    }
    const row = getRowIndex(idx);
    if (expandedRow === row && activePlatform === platform) {
      setExpandedRow(null);
      setActivePlatform(null);
    } else {
      setExpandedRow(row);
      setActivePlatform(platform);
    }
  };

  const openPurchase = (account: SocialMediaAccountListing) => {
    setSelectedAccount(account);
    setDetails({});
    setPlacing(false);
    setOrderSuccess(false);
  };

  const handlePlaceOrder = async () => {
    if (!selectedAccount) return;
    setPlacing(true);
    try {
      await placeAccountOrder({ account_id: selectedAccount.id, user_details: details });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["orders", "social_account"] });
      setOrderSuccess(true);
      toast.success("Order placed! We'll deliver your account shortly.");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to place order.";
      toast.error(msg);
    }
    setPlacing(false);
  };

  const price = selectedAccount ? parseFloat(selectedAccount.price) : 0;
  const canAfford = balance >= price;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-blue-600/10" />
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 header-diamond-pattern pointer-events-none" />
        <div className="p-6 md:p-8 relative z-20 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Social Media Accounts</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {accounts.length} accounts across {Object.keys(byPlatform).length} platforms &middot; Wallet: {wallet ? formatAmount(wallet.balance) : "..."}
              </p>
            </div>
          </div>
          <Link to="/dashboard/deposit">
            <Button variant="outline" className="gap-2">
              <Wallet className="h-4 w-4" /> Add Funds
            </Button>
          </Link>
        </div>
      </div>

      {/* Platform Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
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
          <h3 className="text-lg font-semibold text-foreground mb-1">Failed to load accounts</h3>
          <p className="text-sm text-muted-foreground mb-5">Please try again later.</p>
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["accounts"] })}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ALL_PLATFORMS.map((platform, idx) => {
            const cfg = platformConfig[platform] || { emoji: "📱", solid: "bg-muted", color: "text-muted-foreground", bg: "bg-muted/10" };
            const items = byPlatform[platform] || [];
            const rowIdx = getRowIndex(idx);
            const isExpanded = isMobile
              ? expandedPlatforms.has(platform)
              : expandedRow === rowIdx && activePlatform === platform;

            return (
              <div
                key={platform}
                className={cn(
                  "glass-card overflow-hidden transition-all duration-300",
                  isExpanded ? "ring-1 ring-primary/20 shadow-md" : "hover:border-primary/20 hover:shadow-md"
                )}
              >
                <button
                  onClick={() => togglePlatform(platform, idx)}
                  className="w-full p-5 text-left transition-colors hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-4">
                    <PlatformIcon platform={platform} size="lg" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-foreground">{platform}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {items.length} {items.length === 1 ? "account" : "accounts"} available
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 text-muted-foreground transition-transform duration-200 flex-shrink-0",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border/30 max-h-[400px] overflow-y-auto">
                    {items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <Package className="h-8 w-8 text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground">No accounts available yet</p>
                        <p className="text-xs text-muted-foreground/60">Check back soon</p>
                      </div>
                    ) : (
                      items.map((account) => {
                        const itemPrice = parseFloat(account.price);
                        const affordable = balance >= itemPrice;
                        return (
                          <div
                            key={account.id}
                            onClick={() => openPurchase(account)}
                            className="flex items-center gap-3 px-5 py-4 hover:bg-primary/5 cursor-pointer transition-colors border-b border-border/10 last:border-b-0 group"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                {account.service_name}
                              </p>
                              {account.description && (
                                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{account.description}</p>
                              )}
                              {account.required_fields.length > 0 && (
                                <p className={`text-xs font-semibold mt-1 ${cfg.color}`}>
                                  Requires: {account.required_fields.join(", ")}
                                </p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-base font-extrabold text-foreground">{formatAmount(account.price)}</p>
                              {!affordable && (
                                <p className="text-xs text-destructive font-semibold">Low balance</p>
                              )}
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors flex-shrink-0" />
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Orders Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border/30">
          <h2 className="text-base font-bold text-foreground">My Account Orders</h2>
        </div>

        {/* Mobile + tablet cards */}
        <div className="lg:hidden divide-y divide-border/30">
          {ordersLoading ? (
            <>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start justify-between gap-3 p-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <div className="space-y-2 text-right">
                    <Skeleton className="h-4 w-16 ml-auto" />
                    <Skeleton className="h-5 w-14 rounded-full ml-auto" />
                  </div>
                </div>
              ))}
            </>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No account orders yet.</div>
          ) : (
            (orders as Order[]).map((order) => {
              const extData = order.external_data as Record<string, string | Record<string, string>>;
              const platform = (extData?.platform as string) || "";
              return (
                <div key={order.id} className="p-4 sm:p-5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {platform && <PlatformIcon platform={platform} size="sm" />}
                        <p className="text-sm font-semibold text-foreground truncate">{order.service_name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">#{order.id} · {platform || "—"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(order.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1.5">
                      <p className="text-sm font-bold text-foreground">{formatAmount(order.amount)}</p>
                      <Badge variant="outline" className={cn("text-[10px] font-semibold", statusColors[order.status] || "")}>
                        {statusLabels[order.status] || order.status}
                      </Badge>
                    </div>
                  </div>
                  {order.result && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-muted/30 border border-border/30 p-2">
                      <p className="text-xs text-foreground font-mono break-all flex-1">{order.result}</p>
                      <button
                        onClick={() => handleCopyResult(order.id, order.result!)}
                        className="flex-shrink-0 p-1 rounded hover:bg-muted/50 transition-colors"
                      >
                        {copiedResultId === order.id
                          ? <Check className="h-3.5 w-3.5 text-success" />
                          : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    </div>
                  )}
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
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Account</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Platform</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Price</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Status</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Details Provided</th>
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
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-8 w-8 rounded-lg" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      </td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                    </tr>
                  ))}
                </>
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No account orders yet.</td></tr>
              ) : (
                (orders as Order[]).map((order, index) => {
                  const extData = order.external_data as Record<string, string | Record<string, string>>;
                  const platform = (extData?.platform as string) || "";
                  const userDetails = extData?.user_details as Record<string, string> | undefined;
                  return (
                    <tr
                      key={order.id}
                      className={cn(
                        "border-b border-border/30 transition-colors hover:bg-muted/40",
                        index % 2 === 1 && "bg-muted/25"
                      )}
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-foreground">#{order.id}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-foreground">{order.service_name}</p>
                        {order.result && (
                          <div className="mt-1.5 flex items-start gap-2 rounded-lg bg-muted/30 border border-border/30 p-2">
                            <p className="text-xs text-foreground font-mono break-all flex-1">{order.result}</p>
                            <button
                              onClick={() => handleCopyResult(order.id, order.result!)}
                              className="flex-shrink-0 p-1 rounded hover:bg-muted/50 transition-colors"
                            >
                              {copiedResultId === order.id
                                ? <Check className="h-3.5 w-3.5 text-success" />
                                : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <PlatformIcon platform={platform} size="sm" />
                          <span className="text-sm text-muted-foreground">{platform || "—"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-foreground">{formatAmount(order.amount)}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={`text-xs font-semibold ${statusColors[order.status] || ""}`}>
                          {statusLabels[order.status] || order.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {userDetails && Object.keys(userDetails).length > 0
                          ? Object.entries(userDetails).map(([k, v]) => (
                              <div key={k}><span className="font-medium text-foreground">{k}:</span> {v}</div>
                            ))
                          : <span className="opacity-40">—</span>
                        }
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

      {/* Purchase Dialog */}
      <Dialog open={!!selectedAccount && !orderSuccess} onOpenChange={() => setSelectedAccount(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAccount && (
                <>
                  <PlatformIcon platform={selectedAccount.platform} size="sm" />
                  <span className="truncate text-sm">{selectedAccount.service_name}</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedAccount && (
            <div className="space-y-4 py-2">
              {selectedAccount.description && (
                <p className="text-sm text-muted-foreground">{selectedAccount.description}</p>
              )}

              {/* Price info */}
              <div className="rounded-xl border border-border/30 bg-muted/20 p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Price</span>
                  <span className="text-xl font-extrabold text-foreground">{formatAmount(selectedAccount.price)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Your Balance</span>
                  <span className={cn("font-bold", canAfford ? "text-primary" : "text-destructive")}>
                    {formatAmount(balance.toString())}
                  </span>
                </div>
              </div>

              {/* Required fields */}
              {selectedAccount.required_fields.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Required Details</p>
                  {selectedAccount.required_fields.map((field) => (
                    <div key={field} className="space-y-1">
                      <Label className="text-sm font-medium">{field}</Label>
                      <Input
                        value={details[field] || ""}
                        onChange={(e) => setDetails((prev) => ({ ...prev, [field]: e.target.value }))}
                        placeholder={`Enter ${field.toLowerCase()}`}
                        required
                      />
                    </div>
                  ))}
                </div>
              )}

              {selectedAccount.notes && (
                <div className="rounded-lg bg-muted/30 border border-border/30 p-3 text-xs text-muted-foreground">
                  {selectedAccount.notes}
                </div>
              )}

              {!canAfford && (
                <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-500">Insufficient Balance</p>
                    <Link to="/dashboard/deposit" className="text-xs font-semibold text-primary hover:underline mt-1 inline-block">
                      Add Funds &rarr;
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAccount(null)}>Cancel</Button>
            <Button
              onClick={handlePlaceOrder}
              disabled={placing || !canAfford}
              className="shadow-lg text-white bg-primary"
            >
              {placing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
              Place Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={orderSuccess} onOpenChange={() => { setOrderSuccess(false); setSelectedAccount(null); }}>
        <DialogContent className="sm:max-w-sm text-center">
          <div className="py-6">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <UserCheck className="h-8 w-8 text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Order Placed!</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Your order for <span className="font-semibold text-foreground">{selectedAccount?.service_name}</span> is being processed. We'll deliver your account shortly.
            </p>
            <Button
              className="mt-6 w-full"
              onClick={() => { setOrderSuccess(false); setSelectedAccount(null); }}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountsPage;
