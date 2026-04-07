import { useState } from "react";
import { Wallet, Loader2, Search, CreditCard, Bitcoin, UserCircle, RefreshCw, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAdminDeposits, fetchAdminCryptoDeposits, actionAdminCryptoDeposit, type AdminDeposit, type AdminCryptoDeposit } from "@/lib/api";

const methodIcon = (method: string) => {
  if (method === "Korapay") return <CreditCard className="h-3.5 w-3.5 text-blue-400" />;
  if (method === "Crypto") return <Bitcoin className="h-3.5 w-3.5 text-orange-400" />;
  return <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />;
};

const methodColor = (method: string) => {
  if (method === "Korapay") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  if (method === "Crypto")   return "bg-orange-500/10 text-orange-400 border-orange-500/20";
  return "bg-muted text-muted-foreground border-border";
};

const AdminDepositsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const { data: deposits = [], isLoading, error } = useQuery({
    queryKey: ["admin-deposits"],
    queryFn: fetchAdminDeposits,
  });

  const { data: pendingCrypto = [], isLoading: cryptoLoading } = useQuery({
    queryKey: ["admin-crypto-deposits", "pending"],
    queryFn: () => fetchAdminCryptoDeposits("pending"),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: number) => actionAdminCryptoDeposit(id, "confirm"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-crypto-deposits"] });
      queryClient.invalidateQueries({ queryKey: ["admin-deposits"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      actionAdminCryptoDeposit(id, "reject", note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-crypto-deposits"] });
      setRejectId(null);
      setRejectNote("");
    },
  });

  const filtered = deposits.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.user_email.toLowerCase().includes(q) ||
      d.user_name.toLowerCase().includes(q) ||
      d.method.toLowerCase().includes(q) ||
      d.reference.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q)
    );
  });

  const totalDeposited = deposits
    .filter((d) => d.status === "completed")
    .reduce((sum, d) => sum + parseFloat(d.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 md:p-8 relative bg-primary">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/[0.03] -translate-y-1/3 translate-x-1/4" />
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Deposit Management</h1>
                <p className="text-white/50 text-sm mt-0.5">
                  {deposits.length} deposits &middot; Total credited:{" "}
                  {totalDeposited.toLocaleString("en-NG", { style: "currency", currency: "NGN" })}
                </p>
              </div>
            </div>
            <Button
              className="bg-white/10 hover:bg-white/20 text-white border-0"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-deposits"] })}
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Korapay",
            icon: <CreditCard className="h-5 w-5 text-blue-400" />,
            bg: "bg-blue-500/10",
            count: deposits.filter((d) => d.method === "Korapay").length,
            total: deposits.filter((d) => d.method === "Korapay").reduce((s, d) => s + parseFloat(d.amount), 0),
          },
          {
            label: "Crypto",
            icon: <Bitcoin className="h-5 w-5 text-orange-400" />,
            bg: "bg-orange-500/10",
            count: deposits.filter((d) => d.method === "Crypto").length,
            total: deposits.filter((d) => d.method === "Crypto").reduce((s, d) => s + parseFloat(d.amount), 0),
          },
          {
            label: "Manual / Admin",
            icon: <UserCircle className="h-5 w-5 text-muted-foreground" />,
            bg: "bg-muted/30",
            count: deposits.filter((d) => d.method !== "Korapay" && d.method !== "Crypto").length,
            total: deposits.filter((d) => d.method !== "Korapay" && d.method !== "Crypto").reduce((s, d) => s + parseFloat(d.amount), 0),
          },
        ].map((item) => (
          <div key={item.label} className="glass-card p-5 flex items-center gap-4">
            <div className={`h-11 w-11 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
              {item.icon}
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
              <p className="text-lg font-bold text-foreground">{item.count} deposits</p>
              <p className="text-xs text-muted-foreground">
                ₦{item.total.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Pending Crypto Deposits */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Pending Crypto Deposits</h2>
              <p className="text-xs text-muted-foreground">
                {cryptoLoading ? "Loading…" : `${pendingCrypto.length} awaiting review`}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-muted-foreground"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-crypto-deposits"] })}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        </div>

        {cryptoLoading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : pendingCrypto.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No pending crypto deposits.
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {pendingCrypto.map((dep: AdminCryptoDeposit) => {
              const isRejecting = rejectId === dep.id;
              const date = new Date(dep.created_at);
              return (
                <div key={dep.id} className="p-5 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-foreground">{dep.user_name}</span>
                        <span className="text-xs text-muted-foreground">{dep.user_email}</span>
                        <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-400 border-orange-500/20">
                          <Bitcoin className="h-3 w-3 mr-1" />{dep.crypto_name}
                        </Badge>
                      </div>
                      <div className="flex items-baseline gap-2">
                        {dep.amount_usd && (
                          <span className="text-sm font-semibold text-muted-foreground">${parseFloat(dep.amount_usd).toFixed(2)}</span>
                        )}
                        <span className="text-lg font-bold text-foreground">
                          ≈ ₦{parseFloat(dep.amount_ngn).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-muted-foreground font-medium">TX Hash:</span>
                        <span className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded break-all">
                          {dep.transaction_hash}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Submitted {date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}{" "}
                        at {date.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white text-xs"
                        disabled={confirmMutation.isPending}
                        onClick={() => confirmMutation.mutate(dep.id)}
                      >
                        {confirmMutation.isPending && confirmMutation.variables === dep.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs"
                        disabled={rejectMutation.isPending}
                        onClick={() => {
                          if (isRejecting) {
                            setRejectId(null);
                            setRejectNote("");
                          } else {
                            setRejectId(dep.id);
                            setRejectNote("");
                          }
                        }}
                      >
                        {isRejecting ? (
                          <><ChevronUp className="h-3.5 w-3.5 mr-1.5" /> Cancel</>
                        ) : (
                          <><XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject</>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Reject form */}
                  {isRejecting && (
                    <div className="mt-4 flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Reason for rejection (optional)"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        className="flex-1 text-sm bg-muted/50 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-destructive/50"
                      />
                      <Button
                        size="sm"
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs flex-shrink-0"
                        disabled={rejectMutation.isPending}
                        onClick={() => rejectMutation.mutate({ id: dep.id, note: rejectNote })}
                      >
                        {rejectMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : "Confirm Reject"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="glass-card p-1.5">
        <div className="flex items-center gap-3 px-4 py-2">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by user, method, reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-xs text-muted-foreground hover:text-foreground">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">#</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">User</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Amount</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Method</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Reference</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3.5">Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-destructive text-sm">
                    Failed to load deposits.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground text-sm">
                    {search ? "No deposits match your search." : "No deposits yet."}
                  </td>
                </tr>
              ) : (
                filtered.map((deposit: AdminDeposit, index: number) => {
                  const date = new Date(deposit.created_at);
                  return (
                    <tr
                      key={deposit.id}
                      className={`border-b border-border/30 transition-colors hover:bg-muted/40 ${index % 2 === 1 ? "bg-muted/25" : ""}`}
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-foreground">#{deposit.id}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-foreground">{deposit.user_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{deposit.user_email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-foreground">
                          ₦{parseFloat(deposit.amount).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant="outline"
                          className={`text-xs font-semibold flex items-center gap-1.5 w-fit ${methodColor(deposit.method)}`}
                        >
                          {methodIcon(deposit.method)}
                          {deposit.method}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {deposit.reference ? (
                          <span className="text-xs font-mono text-muted-foreground">{deposit.reference}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-foreground">
                          {date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {date.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                        </p>
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

export default AdminDepositsPage;
