import { useState, useEffect, useRef } from "react";
import {
  Settings, Percent, Loader2, Save, TrendingUp, Phone,
  DollarSign, Bitcoin, Plus, Trash2, QrCode, Copy, CheckCircle,
  CreditCard, AlertTriangle, Key, Eye, EyeOff, Database, FileText,
  Lock, ShieldCheck, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchPlatformSettings, updatePlatformSettings,
  requestApiKeyCode, verifyApiKeyCode,
  type CryptoMethod, type ApiKeyInfo, ApiError,
} from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import QRCode from "qrcode";

// Live QR code rendered on canvas from any string
function QRCanvas({ value, size = 180 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current || !value.trim()) return;
    QRCode.toCanvas(ref.current, value.trim(), {
      width: size,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(() => {});
  }, [value, size]);

  if (!value.trim()) {
    return (
      <div
        className="rounded-xl bg-muted/30 border border-border/30 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <QrCode className="h-8 w-8 text-muted-foreground/30" />
      </div>
    );
  }
  return <canvas ref={ref} className="rounded-xl" />;
}

// Mimics how the method looks on the user deposit page
function MethodPreview({ method }: { method: CryptoMethod }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(method.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-border/40 bg-background/60 p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">User Preview</span>
      </div>

      {/* QR */}
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-2xl bg-white p-3 shadow-lg">
          <QRCanvas value={method.address} size={160} />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-foreground">{method.name || "—"}</p>
          {method.network && (
            <p className="text-xs text-muted-foreground">Network: {method.network}</p>
          )}
        </div>
      </div>

      {/* Address */}
      <div className="space-y-1.5">
        <Label className="text-xs">Wallet Address</Label>
        <div className="flex items-center gap-2">
          <Input value={method.address} readOnly className="font-mono text-xs" />
          <Button variant="outline" size="icon" onClick={handleCopy} type="button">
            {copied
              ? <CheckCircle className="h-4 w-4 text-success" />
              : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <div className="rounded-xl bg-primary/5 border border-primary/10 p-3">
        <h4 className="font-semibold text-foreground text-xs mb-2">How to deposit</h4>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>Scan the QR code or copy the wallet address</li>
          <li>Send only <strong>{method.name || "this currency"}</strong>{method.network ? ` via ${method.network}` : ""}</li>
          <li>Contact support with your transaction hash for crediting</li>
        </ul>
      </div>

      <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Credited manually by admin after verification — up to 30 minutes.
        </p>
      </div>
    </div>
  );
}

const AdminSettingsPage = () => {
  const queryClient = useQueryClient();
  const [boostingMarkup, setBoostingMarkup] = useState("");
  const [numbersMarkup, setNumbersMarkup] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [cryptoRate, setCryptoRate] = useState("");
  const [cryptoMethods, setCryptoMethods] = useState<CryptoMethod[]>([]);
  const [savingBoosting, setSavingBoosting] = useState(false);
  const [savingNumbers, setSavingNumbers] = useState(false);
  const [savingRate, setSavingRate] = useState(false);
  const [savingCryptoRate, setSavingCryptoRate] = useState(false);
  const [savingCrypto, setSavingCrypto] = useState(false);

  // API key management
  type ApiKeySlot = 'korapay_secret' | 'korapay_public' | 'korapay_encryption' | 'rss_api_key' | 'smspool_api_key';
  const [apiKeyInfo, setApiKeyInfo] = useState<Record<ApiKeySlot, ApiKeyInfo>>({
    korapay_secret:     { masked: null, source: 'not_set' },
    korapay_public:     { masked: null, source: 'not_set' },
    korapay_encryption: { masked: null, source: 'not_set' },
    rss_api_key:        { masked: null, source: 'not_set' },
    smspool_api_key:    { masked: null, source: 'not_set' },
  });
  const [editingKey, setEditingKey] = useState<ApiKeySlot | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  // API key verification gate
  const [apiKeysVerified, setApiKeysVerified] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [requires2fa, setRequires2fa] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: fetchPlatformSettings,
  });

  useEffect(() => {
    if (data) {
      setBoostingMarkup(data.boosting_markup_percent);
      setNumbersMarkup(data.numbers_markup_percent);
      setExchangeRate(data.usd_to_ngn_rate);
      setCryptoRate(data.crypto_usd_rate ?? "1600");
      setCryptoMethods(data.crypto_methods || []);
      setApiKeysVerified(!!data.api_keys_verified);
      if (data.api_keys) setApiKeyInfo(data.api_keys as typeof apiKeyInfo);
    }
  }, [data]);

  const handleSaveBoosting = async () => {
    const val = parseFloat(boostingMarkup);
    if (isNaN(val) || val < 0 || val > 500) { toast.error("Markup must be between 0% and 500%."); return; }
    setSavingBoosting(true);
    try {
      await updatePlatformSettings({ boosting_markup_percent: val.toString() });
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["boosting-services"] });
      toast.success("Boosting markup updated.");
    } catch { toast.error("Failed to update settings."); }
    setSavingBoosting(false);
  };

  const handleSaveNumbers = async () => {
    const val = parseFloat(numbersMarkup);
    if (isNaN(val) || val < 0 || val > 500) { toast.error("Markup must be between 0% and 500%."); return; }
    setSavingNumbers(true);
    try {
      await updatePlatformSettings({ numbers_markup_percent: val.toString() });
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      toast.success("Numbers markup updated.");
    } catch { toast.error("Failed to update settings."); }
    setSavingNumbers(false);
  };

  const handleSaveRate = async () => {
    const val = parseFloat(exchangeRate);
    if (isNaN(val) || val < 1) { toast.error("Exchange rate must be at least 1."); return; }
    setSavingRate(true);
    try {
      await updatePlatformSettings({ usd_to_ngn_rate: val.toString() });
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      toast.success("Exchange rate updated.");
    } catch { toast.error("Failed to update exchange rate."); }
    setSavingRate(false);
  };

  const handleSaveCryptoRate = async () => {
    const val = parseFloat(cryptoRate);
    if (isNaN(val) || val < 1) { toast.error("Crypto rate must be at least 1."); return; }
    setSavingCryptoRate(true);
    try {
      await updatePlatformSettings({ crypto_usd_rate: val.toString() });
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["crypto-methods"] });
      toast.success("Crypto exchange rate updated.");
    } catch { toast.error("Failed to update crypto rate."); }
    setSavingCryptoRate(false);
  };

  const addCryptoMethod = () => {
    setCryptoMethods((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", network: "", address: "" },
    ]);
  };

  const updateCryptoField = (id: string, field: keyof CryptoMethod, value: string) => {
    setCryptoMethods((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const removeCryptoMethod = (id: string) => {
    setCryptoMethods((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSaveCrypto = async () => {
    const invalid = cryptoMethods.find((m) => !m.name.trim() || !m.address.trim());
    if (invalid) { toast.error("Each method must have a name and wallet address."); return; }
    setSavingCrypto(true);
    try {
      await updatePlatformSettings({ crypto_methods: cryptoMethods });
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["crypto-methods"] });
      toast.success("Crypto payment methods saved.");
    } catch { toast.error("Failed to save crypto methods."); }
    setSavingCrypto(false);
  };

  const handleSaveApiKey = async (slot: ApiKeySlot) => {
    if (!keyInput.trim()) { toast.error("Key cannot be empty."); return; }
    setSavingKey(true);
    try {
      await updatePlatformSettings({ api_keys: { [slot]: keyInput.trim() } });
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      setEditingKey(null);
      setKeyInput("");
      setShowKey(false);
      toast.success("API key updated.");
    } catch { toast.error("Failed to update API key."); }
    setSavingKey(false);
  };

  const handleRequestCode = async () => {
    setSendingCode(true);
    try {
      const res = await requestApiKeyCode();
      setCodeSent(true);
      setRequires2fa(res.requires_2fa);
      toast.success("Verification code sent to your email.");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to send code.";
      toast.error(msg);
    }
    setSendingCode(false);
  };

  const handleVerifyCode = async () => {
    if (!emailCode.trim()) { toast.error("Enter the email code."); return; }
    if (requires2fa && !totpCode.trim()) { toast.error("Enter your 2FA code."); return; }
    setVerifying(true);
    try {
      await verifyApiKeyCode(emailCode.trim(), totpCode.trim());
      setApiKeysVerified(true);
      setCodeSent(false);
      setEmailCode("");
      setTotpCode("");
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      toast.success("Identity verified. API keys unlocked.");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Verification failed.";
      toast.error(msg);
    }
    setVerifying(false);
  };

  const KEY_META: Record<ApiKeySlot, { label: string; hint: string; color: string }> = {
    korapay_secret:     { label: "Korapay Secret Key",     hint: "sk_live_... or sk_test_...",    color: "text-blue-500 bg-blue-500/10" },
    korapay_public:     { label: "Korapay Public Key",     hint: "pk_live_... or pk_test_...",    color: "text-indigo-500 bg-indigo-500/10" },
    korapay_encryption: { label: "Korapay Encryption Key", hint: "From Korapay API dashboard",   color: "text-violet-500 bg-violet-500/10" },
    rss_api_key:        { label: "RSS SMM Panel API Key",  hint: "From reallysimplesocial.com",  color: "text-emerald-500 bg-emerald-500/10" },
    smspool_api_key:    { label: "SMSPool API Key",        hint: "From smspool.net",             color: "text-orange-500 bg-orange-500/10" },
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 md:p-8 relative bg-primary">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/[0.03] -translate-y-1/3 translate-x-1/4" />
          <div className="relative flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
              <Settings className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Platform Settings</h1>
              <p className="text-white/50 text-sm mt-0.5">Configure pricing, markups, and payment channels</p>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-card p-16 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground">Loading settings...</span>
        </div>
      ) : (
        <>
          {/* ── FEATURE TOGGLES ─────────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 px-1">
              <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Settings className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Feature Toggles</h2>
                <p className="text-xs text-muted-foreground">Enable or disable pages for users — disabled pages show "Coming Soon"</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { key: 'gifts_enabled', label: 'Gifts Page', desc: 'Send Gift Abroad service' },
                { key: 'webdev_enabled', label: 'Web Development Page', desc: 'Web development portfolio' },
              ] as const).map(({ key, label, desc }) => (
                <div key={key} className="glass-card p-5 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{label}</h3>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <button
                    onClick={async () => {
                      const newVal = !(data as any)?.[key];
                      try {
                        await updatePlatformSettings({ [key]: newVal });
                        queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
                        queryClient.invalidateQueries({ queryKey: ["public-settings"] });
                        toast.success(`${label} ${newVal ? 'enabled' : 'disabled'}.`);
                      } catch { toast.error("Failed to update toggle."); }
                    }}
                    className={cn(
                      "relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0",
                      (data as any)?.[key] ? "bg-primary" : "bg-muted-foreground/20"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                      (data as any)?.[key] ? "translate-x-6" : "translate-x-1"
                    )} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* ── PROFIT SETTINGS ─────────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 px-1">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Profit Settings</h2>
                <p className="text-xs text-muted-foreground">Markup percentages applied on top of external API costs</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Boosting Markup */}
              <div className="glass-card p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Percent className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Boosting Markup</h3>
                    <p className="text-xs text-muted-foreground">RSS panel margin</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input type="number" value={boostingMarkup} onChange={(e) => setBoostingMarkup(e.target.value)} min="0" max="500" step="0.5" className="h-11 text-lg font-bold pr-8" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">%</span>
                    </div>
                    <Button onClick={handleSaveBoosting} disabled={savingBoosting} className="h-11 px-4">
                      {savingBoosting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="rounded-lg border border-border/30 bg-muted/20 p-3 space-y-1.5 text-xs">
                    {(() => {
                      const pct = parseFloat(boostingMarkup) || 0;
                      const cost = 800; const selling = cost * (1 + pct / 100);
                      return (<>
                        <div className="flex justify-between"><span className="text-muted-foreground">API Cost</span><span className="font-semibold">₦{cost} / 1K</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">+{pct}%</span><span className="text-emerald-500 font-semibold">+₦{(selling - cost).toFixed(2)}</span></div>
                        <div className="border-t border-border/30 pt-1.5 flex justify-between font-bold"><span>User Pays</span><span>₦{selling.toFixed(2)} / 1K</span></div>
                      </>);
                    })()}
                  </div>
                </div>
              </div>

              {/* Numbers Markup */}
              <div className="glass-card p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-9 w-9 rounded-lg bg-sky-500/10 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-sky-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Numbers Markup</h3>
                    <p className="text-xs text-muted-foreground">SMSPool margin</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input type="number" value={numbersMarkup} onChange={(e) => setNumbersMarkup(e.target.value)} min="0" max="500" step="0.5" className="h-11 text-lg font-bold pr-8" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">%</span>
                    </div>
                    <Button onClick={handleSaveNumbers} disabled={savingNumbers} className="h-11 px-4">
                      {savingNumbers ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="rounded-lg border border-border/30 bg-muted/20 p-3 space-y-1.5 text-xs">
                    {(() => {
                      const pct = parseFloat(numbersMarkup) || 0;
                      const costNgn = 0.5 * 1600; const selling = costNgn * (1 + pct / 100);
                      return (<>
                        <div className="flex justify-between"><span className="text-muted-foreground">API Cost</span><span className="font-semibold">₦{costNgn.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">+{pct}%</span><span className="text-sky-500 font-semibold">+₦{(selling - costNgn).toFixed(2)}</span></div>
                        <div className="border-t border-border/30 pt-1.5 flex justify-between font-bold"><span>User Pays</span><span>₦{selling.toFixed(2)}</span></div>
                      </>);
                    })()}
                  </div>
                </div>
              </div>

              {/* Exchange Rate */}
              <div className="glass-card p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-9 w-9 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-yellow-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">USD → NGN Rate</h3>
                    <p className="text-xs text-muted-foreground">API cost conversion</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₦</span>
                      <Input type="number" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} min="1" step="0.01" className="h-11 text-lg font-bold pl-7" />
                    </div>
                    <Button onClick={handleSaveRate} disabled={savingRate} className="h-11 px-4">
                      {savingRate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="rounded-lg border border-border/30 bg-muted/20 p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">$1 USD</span><span className="font-semibold">= ₦{parseFloat(exchangeRate || "0").toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">$10 USD</span><span className="font-semibold">= ₦{(parseFloat(exchangeRate || "0") * 10).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">$100 USD</span><span className="font-semibold">= ₦{(parseFloat(exchangeRate || "0") * 100).toLocaleString()}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── PAYMENT SETTINGS ────────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 px-1">
              <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Payment Settings</h2>
                <p className="text-xs text-muted-foreground">Configure payment channels available to users</p>
              </div>
            </div>

            {/* Crypto exchange rate */}
            <div className="glass-card p-5 flex items-center gap-4 flex-wrap">
              <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                <DollarSign className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-foreground">Crypto Deposit Rate</h3>
                <p className="text-xs text-muted-foreground">USD → NGN rate applied when users deposit via crypto (separate from service pricing rate)</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₦</span>
                  <Input
                    type="number"
                    value={cryptoRate}
                    onChange={(e) => setCryptoRate(e.target.value)}
                    min="1"
                    step="0.01"
                    className="h-10 text-sm font-bold pl-7 w-36"
                    placeholder="e.g. 1580"
                  />
                </div>
                <Button onClick={handleSaveCryptoRate} disabled={savingCryptoRate} size="sm" className="h-10 px-4">
                  {savingCryptoRate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
              </div>
              {cryptoRate && (
                <p className="w-full text-xs text-muted-foreground">
                  $1 USD = ₦{parseFloat(cryptoRate || "0").toLocaleString()} &nbsp;·&nbsp;
                  $10 = ₦{(parseFloat(cryptoRate || "0") * 10).toLocaleString()} &nbsp;·&nbsp;
                  $100 = ₦{(parseFloat(cryptoRate || "0") * 100).toLocaleString()}
                </p>
              )}
            </div>

            <div className="glass-card p-6">
              {/* Crypto header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <Bitcoin className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Crypto Payment Methods</h3>
                    <p className="text-xs text-muted-foreground">
                      {cryptoMethods.length > 0
                        ? `${cryptoMethods.length} method${cryptoMethods.length > 1 ? "s" : ""} configured`
                        : "No methods configured yet"}
                    </p>
                  </div>
                </div>
                <Button variant="outline" onClick={addCryptoMethod} className="gap-2">
                  <Plus className="h-4 w-4" /> Add Method
                </Button>
              </div>

              {cryptoMethods.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-border/40 p-10 text-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mx-auto">
                    <Bitcoin className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground">No crypto methods yet.</p>
                  <p className="text-xs text-muted-foreground/70">Click <strong>Add Method</strong> to create your first one.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {cryptoMethods.map((method, idx) => (
                    <div key={method.id} className="rounded-2xl border border-border/40 overflow-hidden">
                      {/* Method editor */}
                      <div className="p-5 space-y-4 bg-muted/10">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Method {idx + 1}
                          </span>
                          <Button
                            size="sm" variant="ghost"
                            className="text-destructive hover:text-destructive h-7 px-2 gap-1 text-xs"
                            onClick={() => removeCryptoMethod(method.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Currency Name</Label>
                            <Input
                              placeholder="e.g. USDT, Bitcoin, BNB"
                              value={method.name}
                              onChange={(e) => updateCryptoField(method.id, "name", e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Network <span className="text-muted-foreground font-normal">(optional)</span></Label>
                            <Input
                              placeholder="e.g. TRC20, ERC20, BEP20"
                              value={method.network}
                              onChange={(e) => updateCryptoField(method.id, "network", e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Wallet Address</Label>
                          <Input
                            placeholder="Paste wallet address — QR code generates automatically"
                            value={method.address}
                            onChange={(e) => updateCryptoField(method.id, "address", e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>

                      {/* User-facing preview */}
                      <div className="border-t border-border/40 p-5 bg-background/40">
                        <MethodPreview method={method} />
                      </div>
                    </div>
                  ))}

                  <Button
                    onClick={handleSaveCrypto}
                    disabled={savingCrypto}
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-white shadow-lg"
                  >
                    {savingCrypto
                      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                      : <><Save className="h-4 w-4 mr-2" /> Save Payment Methods</>}
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* ── API KEY MANAGEMENT ──────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 px-1">
              <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Key className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">API Keys</h2>
                <p className="text-xs text-muted-foreground">Override .env API keys with database values — takes effect immediately</p>
              </div>
            </div>

            {!apiKeysVerified ? (
              /* ── Verification Gate ── */
              <div className="glass-card p-8 text-center space-y-6">
                <div className="h-16 w-16 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto">
                  <Lock className="h-8 w-8 text-violet-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Identity Verification Required</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    API keys are sensitive. Verify your identity to view or modify them.
                    A 6-digit code will be sent to your email.
                  </p>
                </div>

                {!codeSent ? (
                  <Button
                    onClick={handleRequestCode}
                    disabled={sendingCode}
                    className="gap-2"
                  >
                    {sendingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    Send Verification Code
                  </Button>
                ) : (
                  <div className="max-w-sm mx-auto space-y-4">
                    <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3">
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 justify-center">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Code sent to your email. It expires in 5 minutes.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email-code" className="text-xs font-semibold flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        Email Code
                      </Label>
                      <Input
                        id="email-code"
                        placeholder="Enter 6-digit code"
                        value={emailCode}
                        onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="h-11 text-center font-mono text-lg tracking-[0.3em]"
                        maxLength={6}
                        autoFocus
                      />
                    </div>

                    {requires2fa && (
                      <div className="space-y-2">
                        <Label htmlFor="totp-code" className="text-xs font-semibold flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                          2FA Code
                        </Label>
                        <Input
                          id="totp-code"
                          placeholder="Enter authenticator code"
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="h-11 text-center font-mono text-lg tracking-[0.3em]"
                          maxLength={6}
                        />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        className="flex-1 h-10"
                        onClick={handleVerifyCode}
                        disabled={verifying || emailCode.length < 6}
                      >
                        {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                        Verify
                      </Button>
                      <Button
                        variant="outline"
                        className="h-10"
                        onClick={handleRequestCode}
                        disabled={sendingCode}
                      >
                        {sendingCode ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Resend"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ── Unlocked API Keys ── */
              <>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center gap-3">
                  <ShieldCheck className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    Identity verified. API key access unlocked for 10 minutes.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {(Object.keys(KEY_META) as ApiKeySlot[]).map((slot) => {
                    const meta = KEY_META[slot];
                    const info = apiKeyInfo[slot];
                    const isEditing = editingKey === slot;

                    const sourceBadge = info.source === 'database'
                      ? <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full"><Database className="h-2.5 w-2.5" /> DB override</span>
                      : info.source === 'env'
                      ? <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sky-600 bg-sky-500/10 px-2 py-0.5 rounded-full"><FileText className="h-2.5 w-2.5" /> .env</span>
                      : <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full"><AlertTriangle className="h-2.5 w-2.5" /> not set</span>;

                    return (
                      <div key={slot} className="glass-card p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0", meta.color)}>
                              <Key className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-foreground">{meta.label}</h3>
                              <p className="text-xs text-muted-foreground">{meta.hint}</p>
                            </div>
                          </div>
                          {sourceBadge}
                        </div>

                        {/* Current value */}
                        <div className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2 flex items-center gap-2">
                          <code className="text-xs font-mono flex-1 text-muted-foreground truncate">
                            {info.masked ?? <span className="italic">not configured</span>}
                          </code>
                        </div>

                        {/* Edit area */}
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="relative">
                              <Input
                                type={showKey ? "text" : "password"}
                                placeholder={`Paste new ${meta.label}…`}
                                value={keyInput}
                                onChange={(e) => setKeyInput(e.target.value)}
                                className="h-10 font-mono text-xs pr-10"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => setShowKey((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 h-9"
                                disabled={savingKey}
                                onClick={() => handleSaveApiKey(slot)}
                              >
                                {savingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9"
                                onClick={() => { setEditingKey(null); setKeyInput(""); setShowKey(false); }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-9 gap-2"
                            onClick={() => { setEditingKey(slot); setKeyInput(""); setShowKey(false); }}
                          >
                            <Key className="h-3.5 w-3.5" />
                            {info.source === 'database' ? 'Update Key' : 'Set Key'}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-border/30 bg-muted/10 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    DB keys override <code className="bg-muted px-1 py-0.5 rounded text-[11px]">.env</code> values and take effect immediately without a server restart.
                    If a DB key is set, it is used even if the <code className="bg-muted px-1 py-0.5 rounded text-[11px]">.env</code> key differs.
                    Remove a key from the DB to fall back to <code className="bg-muted px-1 py-0.5 rounded text-[11px]">.env</code>.
                  </p>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default AdminSettingsPage;
