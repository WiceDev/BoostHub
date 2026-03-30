import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CreditCard, Bitcoin, Copy, CheckCircle, Loader2,
  CheckCircle2, XCircle, AlertTriangle, Clock, Send,
  ArrowUpRight, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  depositPaystack, verifyDeposit, fetchCryptoMethods,
  submitCryptoDeposit, fetchMyCryptoDeposits, fetchTransactions,
  ApiError, type CryptoMethod, type CryptoDeposit,
  type CryptoMethodsResponse, type Transaction,
} from "@/lib/api";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import QRCode from "qrcode";

function QRCanvas({ address }: { address: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current || !address.trim()) return;
    QRCode.toCanvas(ref.current, address.trim(), {
      width: 180, margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(() => {});
  }, [address]);
  return <canvas ref={ref} className="rounded-xl shadow" />;
}

const QUICK_AMOUNTS = [1000, 2500, 5000, 10000, 25000, 50000];

const cryptoStatusConfig: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pending",   color: "bg-warning/10 text-warning border-warning/20" },
  completed: { label: "Completed", color: "bg-success/10 text-success border-success/20" },
  rejected:  { label: "Rejected",  color: "bg-destructive/10 text-destructive border-destructive/20" },
};

const DepositPage = () => {
  const [amount, setAmount] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<CryptoMethod | null>(null);

  const [hashInput, setHashInput] = useState("");
  const [usdAmount, setUsdAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const { data: cryptoData, isLoading: cryptoLoading } = useQuery<CryptoMethodsResponse>({
    queryKey: ["crypto-methods"],
    queryFn: fetchCryptoMethods,
    staleTime: 5 * 60 * 1000,
  });

  const cryptoMethods: CryptoMethod[] = cryptoData?.methods ?? [];
  const cryptoRate = parseFloat(cryptoData?.crypto_usd_rate ?? "1600");

  const { data: myDeposits = [], isLoading: depositsLoading } = useQuery({
    queryKey: ["my-crypto-deposits"],
    queryFn: fetchMyCryptoDeposits,
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: fetchTransactions,
  });

  // Credit transactions = Paystack / admin deposits
  const creditTx = useMemo(
    () => (transactions as Transaction[]).filter((tx) => tx.transaction_type === "credit"),
    [transactions]
  );

  useEffect(() => {
    if (cryptoMethods.length > 0 && !selectedMethod) {
      setSelectedMethod(cryptoMethods[0]);
    }
  }, [cryptoMethods]);

  useEffect(() => {
    const verify = searchParams.get("verify");
    const reference = searchParams.get("reference") || searchParams.get("trxref");
    if (verify && reference) {
      setVerifying(true);
      verifyDeposit(reference)
        .then((result) => {
          setVerifyResult({ success: true, message: result.detail });
          toast.success(result.detail);
          queryClient.invalidateQueries({ queryKey: ["wallet"] });
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
        })
        .catch((err) => {
          const message = err instanceof ApiError ? err.message : "Payment verification failed.";
          setVerifyResult({ success: false, message });
          toast.error(message);
        })
        .finally(() => {
          setVerifying(false);
          setSearchParams({}, { replace: true });
        });
    }
  }, []);

  const handleCopy = (method: CryptoMethod) => {
    navigator.clipboard.writeText(method.address);
    setCopiedId(method.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePaystack = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 100) { toast.error("Minimum deposit is ₦100."); return; }
    setLoading(true);
    try {
      const callbackUrl = `${window.location.origin}/dashboard/deposit?verify=true`;
      const result = await depositPaystack(numAmount, callbackUrl);
      window.location.href = result.authorization_url;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to initiate payment.");
      setLoading(false);
    }
  };

  const handleSubmitCrypto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMethod) { toast.error("Select a payment method first."); return; }
    const usd = parseFloat(usdAmount);
    if (!usd || usd <= 0) { toast.error("Enter the amount you deposited."); return; }
    if (!hashInput.trim() || hashInput.trim().length < 10) {
      toast.error("Enter a valid transaction hash."); return;
    }
    const ngnEquivalent = parseFloat((usd * cryptoRate).toFixed(2));
    setSubmitting(true);
    try {
      const label = selectedMethod.network
        ? `${selectedMethod.name} (${selectedMethod.network})`
        : selectedMethod.name;
      await submitCryptoDeposit({
        amount_usd: usd,
        amount_ngn: ngnEquivalent,
        transaction_hash: hashInput.trim(),
        crypto_name: label,
      });
      toast.success("Payment submitted! Admin will verify and credit your wallet.");
      setHashInput("");
      setUsdAmount("");
      queryClient.invalidateQueries({ queryKey: ["my-crypto-deposits"] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Submission failed. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl sm:rounded-t-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-blue-600/10" />
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 header-diamond-pattern pointer-events-none" />
        <div className="p-6 md:p-8 relative z-20 flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Add Funds</h1>
            <p className="text-muted-foreground text-sm">Top up your wallet securely via Paystack</p>
          </div>
        </div>
      </div>

      {verifying && (
        <div className="glass-card p-6 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-foreground font-medium">Verifying your payment...</p>
        </div>
      )}

      {verifyResult && (
        <div className={cn("glass-card p-6 flex items-center gap-3", verifyResult.success ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5")}>
          {verifyResult.success
            ? <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
            : <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />}
          <p className={cn("font-medium", verifyResult.success ? "text-success" : "text-destructive")}>
            {verifyResult.message}
          </p>
        </div>
      )}

      {/* Payment section — 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div>
        <Tabs defaultValue="paystack">
          <TabsList className="w-full grid grid-cols-2 mb-6">
            <TabsTrigger value="paystack" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Paystack
            </TabsTrigger>
            <TabsTrigger value="crypto" className="flex items-center gap-2">
              <Bitcoin className="h-4 w-4" /> Crypto
            </TabsTrigger>
          </TabsList>

          {/* ── Paystack tab ── */}
          <TabsContent value="paystack">
            <div className="glass-card p-6 sm:p-8 space-y-6">
              {/* Quick amounts */}
              <div>
                <p className="text-sm font-medium text-foreground mb-3">Quick amounts</p>
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_AMOUNTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setAmount(String(q))}
                      className={cn(
                        "px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors border",
                        amount === String(q)
                          ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                          : "bg-card border-border/50 text-foreground hover:border-primary/40 hover:bg-primary/5"
                      )}
                    >
                      ₦{q.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handlePaystack} className="space-y-5">
                <div className="space-y-2">
                  <Label>Amount (NGN)</Label>
                  <Input
                    type="number"
                    placeholder="Or enter custom amount (min ₦100)"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="100"
                    required
                    className="h-12"
                  />
                  {amount && parseFloat(amount) > 0 && (
                    <p className="text-sm text-muted-foreground">
                      ≈ <span className="font-medium text-foreground">${(parseFloat(amount) / 1600).toFixed(2)} USD</span>
                    </p>
                  )}
                </div>
                <Button className="w-full h-12 shadow-blue text-sm font-semibold" type="submit" disabled={loading}>
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Redirecting...</>
                    : <><CreditCard className="h-4 w-4 mr-2" />Pay with Paystack</>}
                </Button>
              </form>

              <div className="rounded-xl bg-muted/50 p-3 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Secured by Paystack. Supports cards, bank transfers, and USSD. Funds reflect instantly.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* ── Crypto tab ── */}
          <TabsContent value="crypto">
            <div className="space-y-4">
              {cryptoLoading ? (
                <div className="glass-card p-16 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : cryptoMethods.length === 0 ? (
                <div className="glass-card p-10 flex flex-col items-center gap-3">
                  <AlertTriangle className="h-10 w-10 text-amber-500/40" />
                  <p className="text-sm text-muted-foreground text-center">
                    Crypto deposits are not configured yet.<br />Please use Paystack or check back later.
                  </p>
                </div>
              ) : (
                <>
                  {/* Step 1 */}
                  <div className="glass-card p-6 space-y-5">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                      Send crypto to this address
                    </h3>

                    {cryptoMethods.length > 1 && (
                      <div className="flex flex-wrap gap-2">
                        {cryptoMethods.map((m) => (
                          <Button key={m.id} type="button" size="sm"
                            variant={selectedMethod?.id === m.id ? "default" : "outline"}
                            onClick={() => setSelectedMethod(m)}
                          >
                            {m.name}{m.network ? ` (${m.network})` : ""}
                          </Button>
                        ))}
                      </div>
                    )}

                    {selectedMethod && (
                      <>
                        <div className="flex flex-col items-center gap-3">
                          <div className="rounded-2xl bg-white p-3 shadow-lg">
                            <QRCanvas address={selectedMethod.address} />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-foreground">{selectedMethod.name}</p>
                            {selectedMethod.network && (
                              <p className="text-xs text-muted-foreground">Network: {selectedMethod.network}</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label>Wallet Address</Label>
                          <div className="flex items-center gap-2">
                            <Input value={selectedMethod.address} readOnly className="font-mono text-xs" />
                            <Button variant="outline" size="icon" onClick={() => handleCopy(selectedMethod)} type="button">
                              {copiedId === selectedMethod.id
                                ? <CheckCircle className="h-4 w-4 text-success" />
                                : <Copy className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            Send only <strong>{selectedMethod.name}</strong>{selectedMethod.network ? ` via ${selectedMethod.network}` : ""} to this address.
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Step 2 */}
                  <div className="glass-card p-6 space-y-5">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                      Confirm your payment
                    </h3>
                    <p className="text-xs text-muted-foreground">After sending, paste the transaction hash and the amount you sent.</p>

                    <form onSubmit={handleSubmitCrypto} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label>Transaction Hash (TXID)</Label>
                        <Input placeholder="Paste the transaction hash from your wallet" value={hashInput} onChange={(e) => setHashInput(e.target.value)} className="font-mono text-xs" required />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Deposit Amount (USD)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">$</span>
                          <Input type="number" placeholder="How much did you send?" value={usdAmount} onChange={(e) => setUsdAmount(e.target.value)} min="0.01" step="0.01" className="pl-7" required />
                        </div>
                        {usdAmount && parseFloat(usdAmount) > 0 && (
                          <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">≈ NGN value</span>
                            <span className="text-sm font-bold text-foreground">
                              ₦{(parseFloat(usdAmount) * cryptoRate).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </div>

                      <Button type="submit" disabled={submitting} className="w-full h-11 shadow-blue">
                        {submitting
                          ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</>
                          : <><Send className="h-4 w-4 mr-2" />I Have Made Payment</>}
                      </Button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
        </div>

        {/* ── Right Info Panel ── */}
        <div className="space-y-4">
          {/* Why deposit card */}
          <div className="glass-card overflow-hidden">
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-blue-600/10" />
              <div className="absolute -top-8 -left-8 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
              <div className="p-5 relative">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <ArrowUpRight className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Fund Your Wallet</h3>
                    <p className="text-xs text-muted-foreground">Instant top-up, instant access</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {[
                { icon: CheckCircle2, text: "Paystack deposits reflect instantly", color: "text-success" },
                { icon: CreditCard, text: "Cards, bank transfer & USSD supported", color: "text-primary" },
                { icon: Bitcoin, text: "Crypto deposits verified within 30 mins", color: "text-amber-500" },
                { icon: CheckCircle2, text: "256-bit SSL encrypted transactions", color: "text-success" },
              ].map(({ icon: Icon, text, color }, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <Icon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${color}`} />
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Minimum deposit */}
          <div className="glass-card p-5 space-y-3">
            <p className="text-sm font-semibold text-foreground">Deposit Limits</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Minimum (Paystack)</span>
                <span className="text-sm font-bold text-foreground">₦100</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Minimum (Crypto)</span>
                <span className="text-sm font-bold text-foreground">$1 USD</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">USD / NGN rate</span>
                <span className="text-sm font-bold text-foreground">₦{cryptoRate.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── All Deposits History ── (full width, below tabs) */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-border/30 flex items-center gap-3">
          <History className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Deposit History</h2>
          {!txLoading && !depositsLoading && (
            <span className="ml-auto text-xs text-muted-foreground">
              {creditTx.length + (myDeposits as CryptoDeposit[]).length} deposits
            </span>
          )}
        </div>

        {txLoading || depositsLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : creditTx.length === 0 && (myDeposits as CryptoDeposit[]).length === 0 ? (
          <div className="px-6 py-12 text-center">
            <ArrowUpRight className="h-8 w-8 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">No deposits yet. Make your first deposit above.</p>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="lg:hidden divide-y divide-border/30">
              {/* Paystack / wallet credit transactions */}
              {creditTx.map((tx) => (
                <div key={`tx-${tx.id}`} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{tx.description || "Deposit"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(tx.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      <p className="text-sm font-bold text-success">+₦{parseFloat(tx.amount).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</p>
                      <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">Completed</Badge>
                    </div>
                  </div>
                </div>
              ))}
              {/* Crypto deposits */}
              {(myDeposits as CryptoDeposit[]).map((dep) => {
                const cfg = cryptoStatusConfig[dep.status] || cryptoStatusConfig.pending;
                return (
                  <div key={`crypto-${dep.id}`} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{dep.crypto_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(dep.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        <p className="text-sm font-bold text-foreground">₦{parseFloat(dep.amount_ngn).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</p>
                        <Badge variant="outline" className={cn("text-[10px]", cfg.color)}>{cfg.label}</Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">Method</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">Description</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">Amount</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Paystack / wallet credits */}
                  {creditTx.map((tx, idx) => (
                    <tr key={`tx-${tx.id}`} className={cn("border-b border-border/30 hover:bg-muted/40 transition-colors", idx % 2 === 1 && "bg-muted/25")}>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                          <CreditCard className="h-3 w-3" /> Paystack
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">{tx.description || "Deposit"}</td>
                      <td className="px-6 py-4 text-sm font-bold text-success">
                        +₦{parseFloat(tx.amount).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />Completed
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                  {/* Crypto deposits */}
                  {(myDeposits as CryptoDeposit[]).map((dep, idx) => {
                    const cfg = cryptoStatusConfig[dep.status] || cryptoStatusConfig.pending;
                    return (
                      <tr key={`crypto-${dep.id}`} className={cn("border-b border-border/30 hover:bg-muted/40 transition-colors", (creditTx.length + idx) % 2 === 1 && "bg-muted/25")}>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                            <Bitcoin className="h-3 w-3" /> Crypto
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-foreground">{dep.crypto_name}</p>
                          {dep.amount_usd && (
                            <p className="text-xs text-muted-foreground">${parseFloat(dep.amount_usd).toFixed(2)} sent</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-foreground">
                          ₦{parseFloat(dep.amount_ngn).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <Badge variant="outline" className={cn("text-xs font-semibold gap-1", cfg.color)}>
                              {dep.status === "pending"   && <Clock className="h-3 w-3" />}
                              {dep.status === "completed" && <CheckCircle2 className="h-3 w-3" />}
                              {dep.status === "rejected"  && <XCircle className="h-3 w-3" />}
                              {cfg.label}
                            </Badge>
                            {dep.admin_note && dep.status === "rejected" && (
                              <p className="text-xs text-muted-foreground mt-1">{dep.admin_note}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {new Date(dep.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DepositPage;
