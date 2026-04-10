import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Phone, Loader2, AlertTriangle, CheckCircle2, Copy,
  Wallet, X, Clock, ShieldCheck, ChevronDown, Check,
  RotateCcw, ChevronsUpDown, Search, LogOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchSMSCountries, fetchSMSServices, fetchSMSPrice,
  purchaseSMSNumber, checkSMSStatus, cancelSMSOrder,
  fetchWallet, fetchOrders, type SMSCountry, type SMSService, type Order, ApiError,
} from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type PageState = "browse" | "waiting" | "completed" | "failed";

const STORAGE_KEY = "priveboost_sms_active_order";

interface ActiveOrderData {
  orderId: number;
  phoneNumber: string;
  countryId: string;
  serviceId: string;
  purchasedAt: number; // timestamp ms
  dialCode?: string;
  countryName?: string;
  serviceName?: string;
}

function saveActiveOrder(data: ActiveOrderData) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadActiveOrder(): ActiveOrderData | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearActiveOrder() {
  sessionStorage.removeItem(STORAGE_KEY);
}

interface SearchableDropdownProps<T extends { id: string; name: string }> {
  items: T[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  loading?: boolean;
  loadingText?: string;
}

function SearchableDropdown<T extends { id: string; name: string }>({
  items, value, onChange, placeholder, searchPlaceholder, loading, loadingText,
}: SearchableDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = items.find((item) => item.id === value);

  const filtered = useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, query]);

  // Focus search input when popover opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (loading) {
    return (
      <div className="h-11 rounded-lg border border-border/30 flex items-center px-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">{loadingText || "Loading..."}</span>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="w-full h-11 px-3 rounded-lg border border-border/30 bg-background flex items-center justify-between text-sm transition-colors hover:bg-muted/30"
        >
          <span className={selected ? "truncate text-foreground" : "truncate text-muted-foreground"}>
            {selected ? selected.name : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start" side="bottom">
        <div className="flex items-center border-b border-border/30 px-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent py-3 px-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No results found.</p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted/50 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(item.id);
                  setOpen(false);
                }}
              >
                <Check className={cn("h-4 w-4 shrink-0", value === item.id ? "opacity-100 text-primary" : "opacity-0")} />
                <span className="truncate">{item.name}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Within 72 hours from created_at
function isWithin72Hours(dateStr: string): boolean {
  const created = new Date(dateStr).getTime();
  return Date.now() - created < 72 * 60 * 60 * 1000;
}

const SMS_EXPIRY_SECONDS = 20 * 60; // 20 minutes
const CANCEL_COOLDOWN_SECONDS = 30;

const numberStatusColors: Record<string, string> = {
  completed:  "bg-success/10 text-success border-success/20",
  processing: "bg-primary/10 text-primary border-primary/20",
  pending:    "bg-warning/10 text-warning border-warning/20",
  failed:     "bg-destructive/10 text-destructive border-destructive/20",
  cancelled:  "bg-destructive/10 text-destructive border-destructive/20",
  refunded:   "bg-muted text-muted-foreground border-border",
};

const numberStatusLabels: Record<string, string> = {
  completed: "Received", processing: "Waiting", pending: "Pending",
  failed: "Failed", cancelled: "Cancelled", refunded: "Refunded",
};

const NumbersPage = () => {
  const { formatAmount } = useCurrency();
  const queryClient = useQueryClient();

  const [country, setCountry] = useState("");
  const [service, setService] = useState("");
  const [purchasing, setPurchasing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelCooldown, setCancelCooldown] = useState(0);

  // Active order state
  const [pageState, setPageState] = useState<PageState>("browse");
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsCode, setSmsCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(SMS_EXPIRY_SECONDS);
  const [purchasedAt, setPurchasedAt] = useState<number | null>(null);
  // Display-only state restored from sessionStorage (fallback when queries haven't loaded)
  const [restoredDialCode, setRestoredDialCode] = useState("");
  const [restoredCountryName, setRestoredCountryName] = useState("");
  const [restoredServiceName, setRestoredServiceName] = useState("");

  const { data: numberOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["orders", "phone_number"],
    queryFn: () => fetchOrders("phone_number"),
  });

  const { data: countries = [], isLoading: countriesLoading, error: countriesError } = useQuery({
    queryKey: ["sms-countries"],
    queryFn: fetchSMSCountries,
    staleTime: 60 * 60 * 1000,
  });

  const { data: services = [], isLoading: servicesLoading, error: servicesError } = useQuery({
    queryKey: ["sms-services"],
    queryFn: fetchSMSServices,
    staleTime: 60 * 60 * 1000,
  });


  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: fetchWallet,
  });

  // Price query — only when both country and service are selected
  const { data: priceData, isFetching: priceFetching } = useQuery({
    queryKey: ["sms-price", country, service],
    queryFn: () => fetchSMSPrice(country, service),
    enabled: !!country && !!service,
    staleTime: 30 * 1000,
  });

  // Poll for SMS status when waiting
  const { data: statusData } = useQuery({
    queryKey: ["sms-status", activeOrderId],
    queryFn: () => checkSMSStatus(activeOrderId!),
    enabled: pageState === "waiting" && !!activeOrderId,
    refetchInterval: 5000,
  });

  // Restore active order from sessionStorage on mount
  useEffect(() => {
    const saved = loadActiveOrder();
    if (!saved) return;

    const elapsed = Math.floor((Date.now() - saved.purchasedAt) / 1000);
    const remaining = SMS_EXPIRY_SECONDS - elapsed;

    if (remaining <= 0) {
      // Order has expired, clear storage
      clearActiveOrder();
      return;
    }

    setActiveOrderId(saved.orderId);
    setPhoneNumber(saved.phoneNumber);
    setCountry(saved.countryId);
    setService(saved.serviceId);
    setPurchasedAt(saved.purchasedAt);
    setRestoredDialCode(saved.dialCode || "");
    setRestoredCountryName(saved.countryName || "");
    setRestoredServiceName(saved.serviceName || "");
    setCountdown(remaining);
    setPageState("waiting");

    // Restore cancel cooldown if still within 30s
    const cancelRemaining = CANCEL_COOLDOWN_SECONDS - elapsed;
    if (cancelRemaining > 0) {
      setCancelCooldown(cancelRemaining);
    }
  }, []);

  // Countdown timer — ticks every second while waiting
  useEffect(() => {
    if (pageState !== "waiting") return;
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [pageState, countdown]);

  // Cancel cooldown — 30s after purchase before cancel is allowed
  useEffect(() => {
    if (cancelCooldown <= 0) return;
    const timer = setInterval(() => setCancelCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [cancelCooldown]);

  // Tick every second when there are processing orders (drives table cooldown countdown)
  const [, setTick] = useState(0);
  const hasProcessingOrders = numberOrders.some((o) => o.status === "processing" || o.status === "pending");
  useEffect(() => {
    if (!hasProcessingOrders || pageState === "waiting") return; // waiting state already re-renders via countdown
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [hasProcessingOrders, pageState]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Handle status updates
  useEffect(() => {
    if (!statusData) return;
    if (statusData.sms_code) {
      setSmsCode(statusData.sms_code);
      setPageState("completed");
      clearActiveOrder();
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["orders", "phone_number"] });
    } else if (statusData.status === "failed" || statusData.status === "cancelled" || statusData.status === "refunded") {
      setPageState("failed");
      clearActiveOrder();
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["orders", "phone_number"] });
    }
  }, [statusData, queryClient]);

  const selectedCountry = countries.find((c) => c.id === country);
  const selectedService = services.find((s) => s.id === service);
  // Display values: prefer live data, fall back to restored sessionStorage values
  const displayDialCode = selectedCountry?.dial_code || restoredDialCode;
  const displayCountryName = selectedCountry?.name || restoredCountryName;
  const displayServiceName = selectedService?.name || restoredServiceName;
  const balance = wallet ? parseFloat(wallet.balance) : 0;
  const price = priceData ? parseFloat(priceData.price_ngn) : 0;
  const canAfford = balance >= price;

  const handleGetNewCode = (order: Order) => {
    const extData = order.external_data as Record<string, string>;
    const countryId = extData?.smspool_country;
    const serviceId = extData?.smspool_service;
    if (countryId) setCountry(countryId);
    if (serviceId) setService(serviceId);
    setPageState("browse");
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.info("Service pre-selected. Review price and click Buy Number.");
  };

  // Resume waiting view for a processing order from the table
  const handleResumeOrder = (order: Order) => {
    const extData = order.external_data as Record<string, string>;
    const orderPhone = extData?.phone_number || "";
    const countryId = extData?.smspool_country || "";
    const serviceId = extData?.smspool_service || "";
    const dialCode = extData?.dial_code || "";
    const countryName = extData?.country_name || "";
    const serviceName = extData?.service_name || "";

    const createdMs = new Date(order.created_at).getTime();
    const elapsed = Math.floor((Date.now() - createdMs) / 1000);
    const remaining = SMS_EXPIRY_SECONDS - elapsed;

    if (remaining <= 0) {
      toast.error("This number has expired.");
      return;
    }

    setActiveOrderId(order.id);
    setPhoneNumber(orderPhone);
    setCountry(countryId);
    setService(serviceId);
    setPurchasedAt(createdMs);
    setRestoredDialCode(dialCode);
    setRestoredCountryName(countryName);
    setRestoredServiceName(serviceName);
    setCountdown(remaining);
    setSmsCode(null);
    setPageState("waiting");

    const cancelRemaining = CANCEL_COOLDOWN_SECONDS - elapsed;
    setCancelCooldown(cancelRemaining > 0 ? cancelRemaining : 0);

    saveActiveOrder({
      orderId: order.id,
      phoneNumber: orderPhone,
      countryId,
      serviceId,
      purchasedAt: createdMs,
      dialCode,
      countryName,
      serviceName,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePurchase = async () => {
    if (!country || !service || !canAfford) return;
    setPurchasing(true);
    try {
      const result = await purchaseSMSNumber({
        country,
        service,
        service_name: selectedService?.name || "",
        country_name: selectedCountry?.name || "",
        country_short_name: selectedCountry?.short_name || "",
        dial_code: selectedCountry?.dial_code || "",
      });
      const now = Date.now();
      setActiveOrderId(result.order.id);
      setPhoneNumber(result.phone_number);
      setSmsCode(null);
      setCountdown(SMS_EXPIRY_SECONDS);
      setCancelCooldown(CANCEL_COOLDOWN_SECONDS);
      setPurchasedAt(now);
      setPageState("waiting");
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["orders", "phone_number"] });
      toast.success("Number purchased! Waiting for SMS code...");

      saveActiveOrder({
        orderId: result.order.id,
        phoneNumber: result.phone_number,
        countryId: country,
        serviceId: service,
        purchasedAt: now,
        dialCode: selectedCountry?.dial_code || "",
        countryName: selectedCountry?.name || "",
        serviceName: selectedService?.name || "",
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to purchase number.";
      toast.error(msg);
    }
    setPurchasing(false);
  };

  const handleCancel = async () => {
    if (!activeOrderId) return;
    setCancelling(true);
    try {
      await cancelSMSOrder(activeOrderId);
      clearActiveOrder();
      setPageState("browse");
      setActiveOrderId(null);
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["orders", "phone_number"] });
      toast.success("Order cancelled and refunded.");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to cancel order.";
      toast.error(msg);
    }
    setCancelling(false);
  };

  // Handle cancelling directly from the orders table
  const handleTableCancel = async (orderId: number) => {
    setCancelling(true);
    try {
      await cancelSMSOrder(orderId);
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["orders", "phone_number"] });
      toast.success("Order cancelled and refunded.");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to cancel order.";
      toast.error(msg);
    }
    setCancelling(false);
  };

  const handleExit = () => {
    clearActiveOrder();
    setPageState("browse");
    setActiveOrderId(null);
    setPhoneNumber("");
    setSmsCode(null);
    queryClient.invalidateQueries({ queryKey: ["orders", "phone_number"] });
  };

  const handleCopyCode = useCallback(() => {
    if (smsCode) {
      navigator.clipboard.writeText(smsCode);
      toast.success("Code copied to clipboard!");
    }
  }, [smsCode]);

  const handleCopyNumber = useCallback(() => {
    if (phoneNumber) {
      const dial = displayDialCode || "";
      const full = dial
        ? `+${dial}${phoneNumber.replace(/^\+/, "")}`
        : `+${phoneNumber.replace(/^\+/, "")}`;
      navigator.clipboard.writeText(full);
      toast.success("Number copied to clipboard!");
    }
  }, [phoneNumber, displayDialCode]);

  const resetToBrowse = () => {
    clearActiveOrder();
    setPageState("browse");
    setActiveOrderId(null);
    setPhoneNumber("");
    setSmsCode(null);
    setCountry("");
    setService("");
  };

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
              <Phone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Verification Numbers</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Get temporary phone numbers for SMS verification &middot; Wallet: {wallet ? formatAmount(wallet.balance) : "..."}
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

      {/* Waiting for SMS */}
      {pageState === "waiting" && (
        <div className="glass-card p-8 text-center space-y-6">
          <div className="h-20 w-20 rounded-full bg-sky-500/10 flex items-center justify-center mx-auto animate-pulse">
            <Phone className="h-10 w-10 text-sky-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Waiting for SMS Code</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Use the number below for verification. The code will appear here automatically.
            </p>
          </div>

          <div className="rounded-xl border border-border/30 bg-muted/20 p-6 max-w-md mx-auto space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Your Number</p>
              <div className="flex items-center justify-center gap-2">
                <div className="text-center">
                  {displayDialCode && (
                    <p className="text-sm font-bold text-muted-foreground font-mono tracking-wider">
                      +{displayDialCode}
                    </p>
                  )}
                  <p className="text-2xl font-extrabold text-foreground tracking-wider font-mono">
                    {phoneNumber.replace(/^\+/, "").replace(displayDialCode || "", "").replace(/^0+/, "") || phoneNumber.replace(/^\+/, "")}
                  </p>
                </div>
                <button onClick={handleCopyNumber} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <Copy className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-center">
                {displayServiceName} &middot; {displayCountryName}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
              <span>Checking for incoming SMS...</span>
            </div>

            {/* Countdown timer */}
            <div className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 ${
              countdown <= 60 ? "bg-destructive/10 border border-destructive/20" : "bg-muted/40"
            }`}>
              <Clock className={`h-4 w-4 flex-shrink-0 ${countdown <= 60 ? "text-destructive" : "text-sky-500"}`} />
              <span className={`text-sm font-bold font-mono ${countdown <= 60 ? "text-destructive" : "text-foreground"}`}>
                {formatCountdown(countdown)}
              </span>
              <span className="text-xs text-muted-foreground">remaining</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              onClick={handleExit}
              className="text-muted-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Exit
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={cancelling || cancelCooldown > 0}
              className="text-destructive border-destructive/30 hover:bg-destructive/5"
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
              {cancelCooldown > 0 ? `Cancel in ${cancelCooldown}s` : "Cancel & Refund"}
            </Button>
          </div>
        </div>
      )}

      {/* Code Received */}
      {pageState === "completed" && (
        <div className="glass-card p-8 text-center space-y-6">
          <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Code Received!</h2>
            <p className="text-sm text-muted-foreground mt-1">Your verification code is ready.</p>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 max-w-md mx-auto space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Verification Code</p>
              <div className="flex items-center justify-center gap-3">
                <p className="text-4xl font-extrabold text-emerald-500 tracking-[0.2em]">{smsCode}</p>
                <button
                  onClick={handleCopyCode}
                  className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                >
                  <Copy className="h-5 w-5 text-emerald-500" />
                </button>
              </div>
            </div>
            <div className="border-t border-border/30 pt-3">
              <p className="text-xs text-muted-foreground mb-1">Number</p>
              {selectedCountry?.dial_code ? (
                <>
                  <p className="text-xs font-bold text-muted-foreground font-mono">+{selectedCountry.dial_code}</p>
                  <p className="text-sm font-semibold text-foreground font-mono">
                    {phoneNumber.replace(/^\+/, "").replace(selectedCountry.dial_code, "").replace(/^0+/, "") || phoneNumber.replace(/^\+/, "")}
                  </p>
                </>
              ) : (
                <p className="text-sm font-semibold text-foreground font-mono">+{phoneNumber.replace(/^\+/, "")}</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={resetToBrowse}>
              Buy Another Number
            </Button>
            <Link to="/dashboard/orders">
              <Button>View Orders</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Failed */}
      {pageState === "failed" && (
        <div className="glass-card p-8 text-center space-y-6">
          <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Order Failed</h2>
            <p className="text-sm text-muted-foreground mt-1">
              The SMS number expired or was cancelled. Your wallet has been refunded.
            </p>
          </div>
          <Button onClick={resetToBrowse}>Try Again</Button>
        </div>
      )}

      {/* Browse / Purchase */}
      {pageState === "browse" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Service Selection */}
            <div className="lg:col-span-2 space-y-4">
              <div className="glass-card p-6 space-y-5">
                <h2 className="text-base font-bold text-foreground">Select Service & Country</h2>

                {(servicesError || countriesError) && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                    {servicesError && <p>Failed to load services. Please try again later.</p>}
                    {countriesError && <p>Failed to load countries. Please try again later.</p>}
                  </div>
                )}

                {/* Service dropdown */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Service</label>
                  <SearchableDropdown
                    items={services}
                    value={service}
                    onChange={setService}
                    placeholder="Choose a service (e.g. WhatsApp, Telegram)"
                    searchPlaceholder="Search services..."
                    loading={servicesLoading}
                    loadingText="Loading services..."
                  />
                </div>

                {/* Country dropdown */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Country</label>
                  <SearchableDropdown
                    items={countries}
                    value={country}
                    onChange={setCountry}
                    placeholder="Choose a country"
                    searchPlaceholder="Search countries..."
                    loading={countriesLoading}
                    loadingText="Loading countries..."
                  />
                </div>

                {/* Price display */}
                {country && service && (
                  <div className="rounded-xl border border-border/30 bg-muted/20 p-5">
                    {priceFetching ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Fetching price...</span>
                      </div>
                    ) : priceData ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Price</span>
                          <span className="text-2xl font-extrabold text-foreground">{formatAmount(priceData.price_ngn)}</span>
                        </div>
                        {priceData.success_rate && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Success Rate</span>
                            <span className="text-sm font-bold text-emerald-500">{priceData.success_rate}%</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Your Balance</span>
                          <span className={`text-sm font-bold ${canAfford ? "text-primary" : "text-destructive"}`}>
                            {formatAmount(wallet?.balance || "0")}
                          </span>
                        </div>

                        {!canAfford && (
                          <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-semibold text-amber-500">Insufficient Balance</p>
                              <Link to="/dashboard/deposit" className="text-xs font-semibold text-primary hover:underline">
                                Add Funds
                              </Link>
                            </div>
                          </div>
                        )}

                        <Button
                          onClick={handlePurchase}
                          disabled={purchasing || !canAfford}
                          className="w-full h-12 bg-primary text-white shadow-lg text-sm font-bold"
                        >
                          {purchasing ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Phone className="h-4 w-4 mr-2" />
                          )}
                          {purchasing ? "Purchasing..." : `Buy Number for ${formatAmount(priceData.price_ngn)}`}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <Phone className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-foreground">Service Unavailable</p>
                          <p className="text-sm text-foreground/80 mt-1">
                            This service is currently unavailable. Check back later or select a different service.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Info sidebar */}
            <div className="space-y-4">
              <div className="glass-card p-5 space-y-4">
                <h3 className="text-sm font-bold text-foreground">How it works</h3>
                <div className="space-y-3">
                  {[
                    { step: "1", text: "Select a service and country" },
                    { step: "2", text: "Purchase the number" },
                    { step: "3", text: "Use the number for verification" },
                    { step: "4", text: "Copy the received code" },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{item.step}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <h3 className="text-sm font-bold text-foreground">Guarantees</h3>
                </div>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-medium text-foreground">Auto-refund if no SMS received</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-medium text-foreground">Cancel anytime before code arrives</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="h-3.5 w-3.5 text-sky-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-medium text-foreground">Numbers expire after ~20 minutes</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Orders History — always visible below the purchase form */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border/30">
          <h2 className="text-base font-bold text-foreground">My Number Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Order ID</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Number</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Code Received</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Country</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Service</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Status</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Date</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Action</th>
              </tr>
            </thead>
            <tbody>
              {ordersLoading ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : numberOrders.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">No number orders yet.</td></tr>
              ) : (
                numberOrders.map((order: Order, index: number) => {
                  const extData = order.external_data as Record<string, string>;
                  const rawNumber = extData?.phone_number || "";
                  const dialCode = extData?.dial_code || "";
                  const displayNumber = rawNumber
                    ? dialCode
                      ? `+${dialCode} ${rawNumber.replace(/^\+/, "")}`
                      : `+${rawNumber.replace(/^\+/, "")}`
                    : "—";
                  const copyableNumber = rawNumber
                    ? dialCode
                      ? `+${dialCode}${rawNumber.replace(/^\+/, "")}`
                      : `+${rawNumber.replace(/^\+/, "")}`
                    : "";
                  const orderSmsCode = extData?.sms_code || order.result || null;
                  const countryName = extData?.country_name || "—";
                  const serviceName = extData?.service_name || "—";
                  const canReorder = order.status === "completed" && isWithin72Hours(order.created_at);
                  const isProcessing = order.status === "processing" || order.status === "pending";
                  const isActiveWaiting = activeOrderId === order.id && pageState === "waiting";
                  const orderAge = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000);
                  const tableCancelCooldown = isProcessing ? Math.max(0, CANCEL_COOLDOWN_SECONDS - orderAge) : 0;
                  return (
                    <tr
                      key={order.id}
                      className={`border-b border-border/30 transition-colors hover:bg-muted/40 ${index % 2 === 1 ? "bg-muted/25" : ""}`}
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-foreground">#{order.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-mono font-semibold text-foreground">{displayNumber}</span>
                          {copyableNumber && (
                            <button
                              onClick={() => { navigator.clipboard.writeText(copyableNumber); toast.success("Number copied!"); }}
                              className="p-1 rounded hover:bg-muted/50 transition-colors"
                            >
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {orderSmsCode ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-mono font-bold text-success">{orderSmsCode}</span>
                            <button
                              onClick={() => { navigator.clipboard.writeText(orderSmsCode); toast.success("Code copied!"); }}
                              className="p-1 rounded hover:bg-muted/50 transition-colors"
                            >
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{countryName}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{serviceName}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={`text-xs font-semibold ${numberStatusColors[order.status] || ""}`}>
                          {numberStatusLabels[order.status] || order.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-6 py-4">
                        {isProcessing && !isActiveWaiting ? (
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleResumeOrder(order)} className="h-8 text-xs gap-1.5">
                              <Phone className="h-3.5 w-3.5" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleTableCancel(order.id)}
                              disabled={cancelling || tableCancelCooldown > 0}
                              className="h-8 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                            >
                              <X className="h-3.5 w-3.5" />
                              {tableCancelCooldown > 0 ? `${tableCancelCooldown}s` : "Cancel"}
                            </Button>
                          </div>
                        ) : canReorder ? (
                          <Button size="sm" variant="outline" onClick={() => handleGetNewCode(order)} className="h-8 text-xs gap-1.5">
                            <RotateCcw className="h-3.5 w-3.5" />
                            New Code
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NumbersPage;
