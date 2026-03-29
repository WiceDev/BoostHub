import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Search, Gift, ChevronRight, Home, Star, ShoppingCart,
  Clock, CheckCircle2, XCircle, Truck, Info, Package,
  ExternalLink, Copy, Check, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchOrders, fetchGifts, type Order, type GiftItem } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { getGiftCart } from "@/lib/giftCart";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  pending: { label: "Pending", icon: Clock, className: "bg-amber-500/10 text-amber-500" },
  processing: { label: "Processing", icon: Clock, className: "bg-blue-500/10 text-blue-500" },
  completed: { label: "Delivered", icon: CheckCircle2, className: "bg-success/10 text-success" },
  in_transit: { label: "In Transit", icon: Truck, className: "bg-indigo-500/10 text-indigo-500" },
  failed: { label: "Failed", icon: XCircle, className: "bg-destructive/10 text-destructive" },
  refunded: { label: "Refunded", icon: CheckCircle2, className: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled", icon: XCircle, className: "bg-muted text-muted-foreground" },
};

const GiftsPage = () => {
  const { formatAmount } = useCurrency();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeTab, setActiveTab] = useState<"browse" | "cart" | "history">("browse");

  const [copiedId, setCopiedId] = useState<number | null>(null);

  const cart = getGiftCart();

  // Fetch gifts from API
  const { data: gifts = [], isLoading: giftsLoading } = useQuery({
    queryKey: ["gifts"],
    queryFn: fetchGifts,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch real gift orders from API
  const { data: apiOrders = [] } = useQuery({
    queryKey: ["orders", "gift"],
    queryFn: () => fetchOrders("gift"),
    refetchInterval: 30000,
  });

  // Derive category list dynamically from API data
  const giftCategories = ["All", ...Array.from(new Set(gifts.map((g) => g.category_display)))];

  const filtered = gifts.filter((g) => {
    const matchesSearch = g.name.toLowerCase().includes(search.toLowerCase()) || g.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "All" || g.category_display === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Build a lookup map for cart items
  const giftMap = new Map<number, GiftItem>(gifts.map((g) => [g.id, g]));

  const cartGifts = cart
    .map((c) => ({ cartItem: c, gift: giftMap.get(c.giftId) }))
    .filter((c) => c.gift);

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground transition-colors flex items-center gap-1">
          <Home className="h-3.5 w-3.5" /> Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Send Gift Abroad</span>
      </div>

      {/* Header */}
      <div className="relative overflow-hidden rounded-t-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-blue-600/10" />
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 header-diamond-pattern pointer-events-none" />
        <div className="p-6 md:p-8 relative z-20">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
              <Gift className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Send Gift Abroad</h1>
              <p className="text-muted-foreground text-sm">Choose a gift to send to your loved ones anywhere in the world</p>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-b from-transparent to-background pointer-events-none" />
      </div>

      {/* Delivery Info Banner */}
      <div className="glass-card p-5 flex items-start gap-4">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Info className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Delivery Information</p>
          <p className="text-sm font-medium text-foreground/80 mt-1">
            Gift delivery typically takes 7-10 business days. You can track the status of your sent gifts in the History tab below.
          </p>
        </div>
      </div>

      {/* Tabs: Browse / Cart / History */}
      <div className="flex gap-1.5 bg-card border border-border/50 rounded-xl p-1.5">
        <button
          onClick={() => setActiveTab("browse")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "browse"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Gift className="h-4 w-4" />
          Browse Gifts
        </button>
        <button
          onClick={() => setActiveTab("cart")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
            activeTab === "cart"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingCart className="h-4 w-4" />
          Cart
          {cart.length > 0 && (
            <span className={`h-5 min-w-[20px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 ${
              activeTab === "cart" ? "bg-white text-primary" : "bg-primary text-white"
            }`}>
              {cart.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "history"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="h-4 w-4" />
          History
          {apiOrders.length > 0 && (
            <span className={`h-5 min-w-[20px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 ${
              activeTab === "history" ? "bg-white text-primary" : "bg-primary text-white"
            }`}>
              {apiOrders.length}
            </span>
          )}
        </button>
      </div>

      {/* Browse Tab */}
      {activeTab === "browse" && (
        <>
          {/* Search + Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-2 bg-card border border-border/50 rounded-xl px-4 py-2.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search gifts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {giftCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                    activeCategory === cat
                      ? "bg-primary text-white shadow-md shadow-primary/20"
                      : "bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Gift Grid */}
          {giftsLoading ? (
            <div className="glass-card p-12 text-center">
              <Loader2 className="h-8 w-8 mx-auto mb-3 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Loading gifts...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Gift className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">
                {gifts.length === 0 ? "No gifts available at the moment." : "No gifts found matching your search."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((gift) => (
                <div key={gift.id} className="glass-card group hover:border-primary/30 hover:shadow-lg transition-all duration-300 overflow-hidden">
                  <div className="h-40 bg-primary/80 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    {gift.image_url ? (
                      <img src={gift.image_url} alt={gift.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-5xl group-hover:scale-110 transition-transform duration-300">{gift.emoji || "🎁"}</span>
                    )}
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/30 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {parseFloat(gift.rating).toFixed(1)}
                    </div>
                  </div>
                  <div className="p-4">
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {gift.category_display}
                    </span>
                    <h3 className="text-sm font-semibold text-foreground mt-2 line-clamp-1">{gift.name}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{gift.description}</p>
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-base font-bold text-foreground">{formatAmount(parseFloat(gift.price))}</p>
                      <Link
                        to={`/dashboard/gifts/checkout/${gift.id}`}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Purchase
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Cart Tab */}
      {activeTab === "cart" && (
        <div className="space-y-4">
          {cartGifts.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-foreground font-medium mb-1">Your cart is empty</p>
              <p className="text-sm text-muted-foreground mb-4">
                Items are added to your cart when you don't have enough balance to purchase a gift.
              </p>
              <button
                onClick={() => setActiveTab("browse")}
                className="text-primary text-sm font-medium hover:underline"
              >
                Browse gifts
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-3">
                <Info className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-500/90">
                  These gifts were saved because you didn't have enough wallet balance. Add funds to your wallet and come back to complete checkout.
                </p>
              </div>
              {cartGifts.map(({ cartItem, gift: g }) => g && (
                <div key={cartItem.giftId} className="glass-card overflow-hidden">
                  <div className="flex items-center gap-4 p-5">
                    <div className="h-16 w-16 rounded-xl bg-primary/80 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {g.image_url ? (
                        <img src={g.image_url} alt={g.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">{g.emoji || "🎁"}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground">{g.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">To: {cartItem.recipientName}</p>
                      <p className="text-xs text-muted-foreground">
                        Added {new Date(cartItem.addedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-2">
                      <p className="text-base font-bold text-foreground">{formatAmount(parseFloat(g.price))}</p>
                      <Link
                        to={`/dashboard/gifts/checkout/${g.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
                      >
                        Checkout
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {apiOrders.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-foreground font-medium mb-1">No gift orders yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Your sent gift history will appear here once you place an order.
              </p>
              <button
                onClick={() => setActiveTab("browse")}
                className="text-primary text-sm font-medium hover:underline"
              >
                Send your first gift
              </button>
            </div>
          ) : (
            apiOrders.map((order) => {
              const cfg = statusConfig[order.status] || statusConfig.pending;
              const StatusIcon = cfg.icon;
              return (
                <div key={order.id} className="glass-card overflow-hidden">
                  <div className="flex items-center gap-4 p-5">
                    <div className="h-14 w-14 rounded-xl bg-primary/80 flex items-center justify-center flex-shrink-0">
                      <Gift className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground">{order.service_name}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.className}`}>
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Order #{order.id}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-bold text-foreground">{formatAmount(parseFloat(order.amount))}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(order.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>

                  {/* Tracking info — shown when in_transit with tracking data */}
                  {order.status === "in_transit" && (order.tracking_code || order.tracking_url) && (
                    <div className="border-t border-border/30 px-5 py-4">
                      <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/20 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Truck className="h-4 w-4 text-indigo-500" />
                          <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Shipment Tracking</p>
                        </div>
                        {order.tracking_code && (
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div>
                              <p className="text-[10px] text-muted-foreground font-medium uppercase">Tracking Code</p>
                              <p className="text-sm font-mono font-semibold text-foreground mt-0.5">{order.tracking_code}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs gap-1.5 flex-shrink-0"
                              onClick={() => {
                                navigator.clipboard.writeText(order.tracking_code);
                                setCopiedId(order.id);
                                toast.success("Tracking code copied!");
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                            >
                              {copiedId === order.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              {copiedId === order.id ? "Copied" : "Copy"}
                            </Button>
                          </div>
                        )}
                        {order.tracking_url && (
                          <a href={order.tracking_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" className="w-full h-9 text-xs gap-2">
                              <ExternalLink className="h-3.5 w-3.5" />
                              Track Your Order
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* In transit without tracking */}
                  {order.status === "in_transit" && !order.tracking_code && !order.tracking_url && (
                    <div className="border-t border-border/30 px-5 py-4">
                      <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/20 p-3 flex items-center gap-2.5">
                        <Truck className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                        <p className="text-xs text-indigo-500">Your gift is on its way! Tracking details will be updated soon.</p>
                      </div>
                    </div>
                  )}

                  {/* Failure reason + refund info */}
                  {(order.status === "failed" || order.status === "refunded") && (
                    <div className="border-t border-border/30 px-5 py-4 space-y-3">
                      {order.result && (
                        <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 flex items-start gap-2.5">
                          <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-destructive">Reason</p>
                            <p className="text-xs text-destructive/80 mt-0.5">{order.result}</p>
                          </div>
                        </div>
                      )}
                      {order.status === "refunded" && (
                        <div className="rounded-lg p-3 flex items-start gap-2.5 bg-success/5 border border-success/20">
                          <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-success">Refund processed</p>
                            <p className="text-xs text-success/80 mt-0.5">
                              {formatAmount(parseFloat(order.amount))} has been returned to your wallet.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Completed */}
                  {order.status === "completed" && (
                    <div className="border-t border-border/30 px-5 py-4">
                      <div className="rounded-lg p-3 flex items-start gap-2.5 bg-success/5 border border-success/20">
                        <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-success">Gift Delivered</p>
                          <p className="text-xs text-success/80 mt-0.5">
                            {order.result || "Your gift has been successfully delivered!"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default GiftsPage;
