import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Home, ChevronRight, Gift, AlertTriangle, Loader2, Wallet,
  CheckCircle2, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fetchWallet, fetchGift, fetchPublicSettings, placeGiftOrder, ApiError, type GiftImage } from "@/lib/api";
import { addToGiftCart, getGiftCartItem, removeFromGiftCart, addGiftOrder, type GiftOrder } from "@/lib/giftCart";
import { useCurrency } from "@/context/CurrencyContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Country data with phone codes and flags
const countries = [
  { code: "NG", name: "Nigeria", phone: "+234", flag: "🇳🇬" },
  { code: "US", name: "United States", phone: "+1", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", phone: "+44", flag: "🇬🇧" },
  { code: "CA", name: "Canada", phone: "+1", flag: "🇨🇦" },
  { code: "GH", name: "Ghana", phone: "+233", flag: "🇬🇭" },
  { code: "KE", name: "Kenya", phone: "+254", flag: "🇰🇪" },
  { code: "ZA", name: "South Africa", phone: "+27", flag: "🇿🇦" },
  { code: "IN", name: "India", phone: "+91", flag: "🇮🇳" },
  { code: "DE", name: "Germany", phone: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", phone: "+33", flag: "🇫🇷" },
  { code: "AE", name: "UAE", phone: "+971", flag: "🇦🇪" },
  { code: "AU", name: "Australia", phone: "+61", flag: "🇦🇺" },
  { code: "CN", name: "China", phone: "+86", flag: "🇨🇳" },
  { code: "JP", name: "Japan", phone: "+81", flag: "🇯🇵" },
  { code: "BR", name: "Brazil", phone: "+55", flag: "🇧🇷" },
  { code: "EG", name: "Egypt", phone: "+20", flag: "🇪🇬" },
  { code: "CM", name: "Cameroon", phone: "+237", flag: "🇨🇲" },
  { code: "TZ", name: "Tanzania", phone: "+255", flag: "🇹🇿" },
  { code: "RW", name: "Rwanda", phone: "+250", flag: "🇷🇼" },
  { code: "IT", name: "Italy", phone: "+39", flag: "🇮🇹" },
];

interface FormErrors {
  recipientName?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  senderName?: string;
}

const CheckoutCarousel = ({ images, alt }: { images: GiftImage[]; alt: string }) => {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) return null;
  return (
    <div className="relative w-full h-full">
      <img src={images[idx].url} alt={alt} className="w-full h-full object-cover" />
      {images.length > 1 && (
        <>
          <button
            onClick={() => setIdx(i => (i - 1 + images.length) % images.length)}
            className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setIdx(i => (i + 1) % images.length)}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <div className="absolute bottom-1 inset-x-0 flex justify-center gap-1">
            {images.map((_, i) => (
              <span key={i} className={`h-1 rounded-full transition-all ${i === idx ? "w-3 bg-white" : "w-1 bg-white/50"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const GiftCheckoutPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { formatAmount } = useCurrency();
  const queryClient = useQueryClient();

  // Check feature toggle
  const { data: publicSettings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: fetchPublicSettings,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch gift from API
  const { data: gift, isLoading: giftLoading } = useQuery({
    queryKey: ["gift", id],
    queryFn: () => fetchGift(Number(id)),
    enabled: !!id,
    retry: false,
  });

  // Wallet data
  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: fetchWallet,
    refetchInterval: 30000,
  });

  // Form state
  const [recipientName, setRecipientName] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("NG");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [apartment, setApartment] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");
  const [senderName, setSenderName] = useState("");

  // UI state
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Restore form from cart if available
  useEffect(() => {
    if (!gift) return;
    const cartItem = getGiftCartItem(gift.id);
    if (cartItem) {
      setRecipientName(cartItem.recipientName);
      setPhoneCountry(cartItem.phoneCountry);
      setPhoneNumber(cartItem.phoneNumber);
      setApartment(cartItem.apartment);
      setStreet(cartItem.street);
      setCity(cartItem.city);
      setStateRegion(cartItem.stateRegion);
      setZip(cartItem.zip);
      setCountry(cartItem.country);
      setSenderName(cartItem.senderName);
    }
  }, [gift]);

  const selectedPhoneCountry = countries.find((c) => c.code === phoneCountry);

  // Redirect if gifts are disabled
  if (publicSettings && !publicSettings.gifts_enabled) {
    navigate("/dashboard/gifts", { replace: true });
    return null;
  }

  if (giftLoading) {
    return (
      <div className="space-y-6">
        <div className="glass-card p-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-3 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading gift details...</p>
        </div>
      </div>
    );
  }

  if (!gift) {
    return (
      <div className="space-y-6">
        <div className="glass-card p-12 text-center">
          <Gift className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
          <p className="text-foreground font-medium mb-2">Gift not found</p>
          <Link to="/dashboard/gifts" className="text-primary text-sm hover:underline">
            Back to gifts
          </Link>
        </div>
      </div>
    );
  }

  const giftPrice = parseFloat(gift.price);
  const walletBalance = wallet ? parseFloat(wallet.balance) : 0;
  const canPayFromWallet = walletBalance >= giftPrice;

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!recipientName.trim()) newErrors.recipientName = "Recipient name is required";
    if (!phoneNumber.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^\d{6,15}$/.test(phoneNumber.replace(/\s/g, ""))) {
      newErrors.phone = "Enter a valid phone number (digits only)";
    }
    if (!street.trim()) newErrors.address = "Street address is required";
    if (!city.trim()) newErrors.city = "City is required";
    if (!stateRegion.trim()) newErrors.state = "State / Region is required";
    if (!zip.trim()) newErrors.zip = "Zip / Postal code is required";
    if (!country) newErrors.country = "Country is required";
    if (!senderName.trim()) newErrors.senderName = "Sender name is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function saveToCart() {
    addToGiftCart({
      giftId: gift!.id,
      recipientName,
      phoneCountry,
      phoneNumber,
      apartment,
      street,
      city,
      stateRegion,
      zip,
      country,
      senderName,
      addedAt: new Date().toISOString(),
    });
  }

  async function handlePlaceOrder() {
    if (!validate()) return;

    if (canPayFromWallet) {
      setWalletDialogOpen(true);
    } else {
      // Insufficient balance — save to cart and redirect to deposit
      saveToCart();
      toast.info("Gift saved to cart. Please add funds to complete your purchase.", { duration: 5000 });
      navigate("/dashboard/deposit");
    }
  }

  async function handleWalletPay() {
    setWalletDialogOpen(false);
    setLoading(true);

    const deliveryCountry = countries.find((c) => c.code === country);
    const fullAddress = [apartment, street, city, stateRegion, zip, deliveryCountry?.name].filter(Boolean).join(", ");
    const fullPhone = `${selectedPhoneCountry?.phone} ${phoneNumber}`;

    try {
      // Call backend API — deducts wallet and creates order
      const res = await placeGiftOrder({
        gift_id: gift!.id,
        gift_name: gift!.name,
        amount: giftPrice,
        recipient_name: recipientName,
        recipient_phone: fullPhone,
        delivery_address: fullAddress,
        sender_name: senderName,
      });

      // Also save to local gift order history for the history tab
      const localOrder: GiftOrder = {
        id: `GFT-${res.order.id}`,
        giftId: gift!.id,
        giftName: gift!.name,
        giftEmoji: gift!.emoji,
        giftColor: gift!.color,
        recipientName,
        recipientPhone: fullPhone,
        deliveryAddress: fullAddress,
        senderName,
        amount: giftPrice,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      addGiftOrder(localOrder);

      // Remove from cart if it was there
      removeFromGiftCart(gift!.id);

      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setOrderSuccess(true);
      toast.success("Order placed successfully! Gift is being processed.");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to place order. Please try again.";
      toast.error(message);
    }

    setLoading(false);
  }

  async function handleDepositRedirect() {
    // User chose to add funds — save to cart in case payment takes time
    setWalletDialogOpen(false);
    saveToCart();
    toast.info("Gift saved to cart. Redirecting to deposit...", { duration: 3000 });
    navigate("/dashboard/deposit");
  }

  if (orderSuccess) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="glass-card p-8 text-center">
          <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Order Confirmed!</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Your gift <span className="font-semibold text-foreground">{gift.name}</span> is being
            prepared for delivery to <span className="font-semibold text-foreground">{recipientName}</span>.
          </p>

          {/* Delivery time info */}
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 mb-6 flex items-center gap-2 justify-center">
            <AlertTriangle className="h-4 w-4 text-blue-500" />
            <p className="text-xs text-blue-500 font-medium">Estimated delivery: 7-10 business days</p>
          </div>

          <div className="glass-card p-5 text-left space-y-3 mb-6">
            <h3 className="text-sm font-semibold text-foreground">Order Summary</h3>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Gift</span>
              <span className="text-foreground font-medium">{gift.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="text-foreground font-medium">{formatAmount(giftPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Recipient</span>
              <span className="text-foreground font-medium">{recipientName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Phone</span>
              <span className="text-foreground font-medium">
                {selectedPhoneCountry?.phone} {phoneNumber}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery Address</span>
              <span className="text-foreground font-medium text-right max-w-[200px]">
                {[apartment, street, city, stateRegion, zip].filter(Boolean).join(", ")}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sender</span>
              <span className="text-foreground font-medium">{senderName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment</span>
              <span className="text-success font-medium">Wallet</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => navigate("/dashboard/gifts")}>
              Browse More Gifts
            </Button>
            <Button className="flex-1 shadow-blue" onClick={() => navigate("/dashboard/gifts")}>
              View Gift History
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground transition-colors flex items-center gap-1">
          <Home className="h-3.5 w-3.5" /> Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to="/dashboard/gifts" className="hover:text-foreground transition-colors">
          Send Gift
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Checkout</span>
      </div>

      {/* Gift Summary Card */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center gap-4 p-5">
          <div className="h-20 w-20 rounded-xl bg-primary/80 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {gift.images?.length > 0 ? (
              <CheckoutCarousel images={gift.images} alt={gift.name} />
            ) : gift.image_url ? (
              <img src={gift.image_url} alt={gift.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl">{gift.emoji || "🎁"}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {gift.category_display}
            </span>
            <h2 className="text-lg font-bold text-foreground mt-1">{gift.name}</h2>
            <p className="text-sm text-muted-foreground">{gift.description}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-bold text-foreground">{formatAmount(giftPrice)}</p>
          </div>
        </div>
      </div>

      {/* Recipient Details */}
      <div className="glass-card p-6 space-y-5">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Gift className="h-4 w-4 text-primary" />
          </div>
          Recipient Details
        </h3>

        {/* Full Name */}
        <div className="space-y-1.5">
          <Label className="text-sm">Full Name <span className="text-destructive">*</span></Label>
          <Input
            placeholder="Enter recipient's full name"
            value={recipientName}
            onChange={(e) => { setRecipientName(e.target.value); setErrors((p) => ({ ...p, recipientName: undefined })); }}
            className={errors.recipientName ? "border-destructive" : ""}
          />
          {errors.recipientName && <p className="text-xs text-destructive">{errors.recipientName}</p>}
        </div>

        {/* Phone Number with country code */}
        <div className="space-y-1.5">
          <Label className="text-sm">Phone Number <span className="text-destructive">*</span></Label>
          <div className="flex gap-2">
            <Select value={phoneCountry} onValueChange={setPhoneCountry}>
              <SelectTrigger className="w-[140px] flex-shrink-0">
                <SelectValue>
                  {selectedPhoneCountry && (
                    <span className="flex items-center gap-2">
                      <span>{selectedPhoneCountry.flag}</span>
                      <span className="text-xs">{selectedPhoneCountry.phone}</span>
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-[280px]">
                {countries.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="flex items-center gap-2">
                      <span>{c.flag}</span>
                      <span>{c.name}</span>
                      <span className="text-muted-foreground text-xs">{c.phone}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="tel"
              placeholder="Phone number"
              value={phoneNumber}
              onChange={(e) => {
                const val = e.target.value.replace(/[^\d\s]/g, "");
                setPhoneNumber(val);
                setErrors((p) => ({ ...p, phone: undefined }));
              }}
              className={`flex-1 ${errors.phone ? "border-destructive" : ""}`}
            />
          </div>
          {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
        </div>

        {/* Full Address */}
        <div className="space-y-1.5">
          <Label className="text-sm">Full Address <span className="text-destructive">*</span></Label>
          <div className="space-y-3">
            <Input
              placeholder="House / Apartment number"
              value={apartment}
              onChange={(e) => setApartment(e.target.value)}
            />
            <Input
              placeholder="Street"
              value={street}
              onChange={(e) => { setStreet(e.target.value); setErrors((p) => ({ ...p, address: undefined })); }}
              className={errors.address ? "border-destructive" : ""}
            />
            {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Input
                  placeholder="City / Province"
                  value={city}
                  onChange={(e) => { setCity(e.target.value); setErrors((p) => ({ ...p, city: undefined })); }}
                  className={errors.city ? "border-destructive" : ""}
                />
                {errors.city && <p className="text-xs text-destructive mt-1">{errors.city}</p>}
              </div>
              <div>
                <Input
                  placeholder="State / Region"
                  value={stateRegion}
                  onChange={(e) => { setStateRegion(e.target.value); setErrors((p) => ({ ...p, state: undefined })); }}
                  className={errors.state ? "border-destructive" : ""}
                />
                {errors.state && <p className="text-xs text-destructive mt-1">{errors.state}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Input
                  placeholder="Zip / Postal code"
                  value={zip}
                  onChange={(e) => { setZip(e.target.value); setErrors((p) => ({ ...p, zip: undefined })); }}
                  className={errors.zip ? "border-destructive" : ""}
                />
                {errors.zip && <p className="text-xs text-destructive mt-1">{errors.zip}</p>}
              </div>
              <div>
                <Select value={country} onValueChange={(v) => { setCountry(v); setErrors((p) => ({ ...p, country: undefined })); }}>
                  <SelectTrigger className={errors.country ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[280px]">
                    {countries.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        <span className="flex items-center gap-2">
                          <span>{c.flag}</span>
                          <span>{c.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.country && <p className="text-xs text-destructive mt-1">{errors.country}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="rounded-xl bg-warning/10 border border-warning/20 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-warning">Important Notice</p>
            <p className="text-xs text-warning/80 mt-0.5">
              Please ensure recipient name and address are correct. Incorrect information may cause delivery failure.
            </p>
          </div>
        </div>
      </div>

      {/* Sender Details */}
      <div className="glass-card p-6 space-y-5">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          Sender Details
        </h3>

        <div className="space-y-1.5">
          <Label className="text-sm">Your Name <span className="text-destructive">*</span></Label>
          <Input
            placeholder="Enter your name"
            value={senderName}
            onChange={(e) => { setSenderName(e.target.value); setErrors((p) => ({ ...p, senderName: undefined })); }}
            className={errors.senderName ? "border-destructive" : ""}
          />
          {errors.senderName && <p className="text-xs text-destructive">{errors.senderName}</p>}
        </div>
      </div>

      {/* Payment Section */}
      <div className="glass-card p-6 space-y-5">
        <h3 className="text-base font-semibold text-foreground">Payment</h3>

        <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Gift Price</span>
            <span className="text-foreground font-bold text-lg">{formatAmount(giftPrice)}</span>
          </div>
          <div className="flex items-center justify-between text-sm border-t border-border/30 pt-3">
            <span className="text-muted-foreground">Wallet Balance</span>
            <span className={`font-semibold ${canPayFromWallet ? "text-success" : "text-warning"}`}>
              {wallet ? formatAmount(wallet.balance) : "Loading..."}
            </span>
          </div>
          {!canPayFromWallet && wallet && (
            <div className="rounded-lg bg-warning/10 border border-warning/20 p-3">
              <p className="text-xs text-warning font-medium">
                Insufficient wallet balance. Your order will be saved to cart and you'll be redirected to add funds.
              </p>
            </div>
          )}
        </div>

        <Button
          className="w-full h-12 shadow-blue text-sm font-semibold"
          onClick={handlePlaceOrder}
          disabled={loading}
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</>
          ) : canPayFromWallet ? (
            <>Place Order &middot; {formatAmount(giftPrice)}</>
          ) : (
            <>Save to Cart & Add Funds</>
          )}
        </Button>
      </div>

      {/* Wallet Payment Dialog */}
      <Dialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay from Wallet?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              You have <span className="font-semibold text-foreground">{wallet ? formatAmount(wallet.balance) : "..."}</span> in
              your wallet. Would you like to pay <span className="font-semibold text-foreground">{formatAmount(giftPrice)}</span> from
              your wallet balance?
            </p>
            <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">After payment</span>
              <span className="text-foreground font-bold">
                {wallet ? formatAmount(parseFloat(wallet.balance) - giftPrice) : "..."}
              </span>
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleDepositRedirect} disabled={loading}>
              No, Add Funds Instead
            </Button>
            <Button onClick={handleWalletPay} disabled={loading} className="shadow-blue">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wallet className="h-4 w-4 mr-2" />}
              Yes, Pay from Wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GiftCheckoutPage;
