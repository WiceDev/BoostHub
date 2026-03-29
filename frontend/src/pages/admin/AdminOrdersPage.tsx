import { useState, useEffect, useRef } from "react";
import {
  Search, ShoppingBag, Loader2, Package, AlertTriangle,
  CheckCircle2, Clock, XCircle, RefreshCw, ArrowUpRight, Truck, Link2,
  RotateCcw, Plus, User, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminOrders, updateAdminOrder, fetchAdminUsers, adminCreateOrder,
  type AdminOrder, type AdminUser,
} from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { toast } from "sonner";

const statusConfig: Record<string, { color: string; bg: string; icon: typeof Clock }> = {
  pending: { color: "text-amber-500", bg: "bg-amber-500/10", icon: Clock },
  processing: { color: "text-blue-500", bg: "bg-blue-500/10", icon: RefreshCw },
  in_transit: { color: "text-indigo-500", bg: "bg-indigo-500/10", icon: Truck },
  completed: { color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  failed: { color: "text-red-500", bg: "bg-red-500/10", icon: XCircle },
  refunded: { color: "text-primary", bg: "bg-primary/10", icon: RefreshCw },
  cancelled: { color: "text-muted-foreground", bg: "bg-muted", icon: XCircle },
};

const typeLabels: Record<string, string> = {
  gift: "Gift",
  smm_boost: "Boosting",
  phone_number: "Phone",
  social_account: "Social",
  website_template: "Website",
};

const AdminOrdersPage = () => {
  const { formatAmount } = useCurrency();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editingOrder, setEditingOrder] = useState<AdminOrder | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [refundingOrder, setRefundingOrder] = useState<AdminOrder | null>(null);
  const [refundNote, setRefundNote] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);

  // Create order dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<AdminUser[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [coServiceType, setCoServiceType] = useState("social_account");
  const [coServiceName, setCoServiceName] = useState("");
  const [coAmount, setCoAmount] = useState("");
  const [coDeduct, setCoDeduct] = useState(true);
  const [coStatus, setCoStatus] = useState("pending");
  const [coNotes, setCoNotes] = useState("");
  const [coResult, setCoResult] = useState("");
  const [creating, setCreating] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (typeFilter !== "all") params.set("type", typeFilter);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders", search, statusFilter, typeFilter],
    queryFn: () => fetchAdminOrders(params.toString()),
  });

  const openEdit = (order: AdminOrder) => {
    setEditingOrder(order);
    setNewStatus(order.status);
    setNotes(order.notes);
    setResult(order.result);
    setTrackingCode(order.tracking_code || "");
    setTrackingUrl(order.tracking_url || "");
  };

  const handleRefund = async () => {
    if (!refundingOrder) return;
    setRefundLoading(true);
    try {
      await updateAdminOrder(refundingOrder.id, { status: "refunded", notes: refundNote });
      toast.success(`₦${parseFloat(refundingOrder.amount).toLocaleString()} refunded to ${refundingOrder.user_email}.`);
      setRefundingOrder(null);
      setRefundNote("");
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (err: any) {
      toast.error(err?.message || "Refund failed.");
    }
    setRefundLoading(false);
  };

  // Debounced user search
  useEffect(() => {
    if (!userSearch.trim() || selectedUser) {
      setUserResults([]);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setUserSearching(true);
      try {
        const results = await fetchAdminUsers(userSearch.trim());
        setUserResults(results.slice(0, 6));
      } catch { /* silent */ }
      setUserSearching(false);
    }, 350);
  }, [userSearch, selectedUser]);

  const resetCreateDialog = () => {
    setUserSearch(""); setUserResults([]); setSelectedUser(null);
    setCoServiceType("social_account"); setCoServiceName("");
    setCoAmount(""); setCoDeduct(true); setCoStatus("pending");
    setCoNotes(""); setCoResult("");
  };

  const handleCreate = async () => {
    if (!selectedUser) { toast.error("Select a user first."); return; }
    if (!coServiceName.trim()) { toast.error("Service name is required."); return; }
    const amt = parseFloat(coAmount);
    if (isNaN(amt) || amt < 0) { toast.error("Enter a valid amount."); return; }
    setCreating(true);
    try {
      const res = await adminCreateOrder({
        user_id: selectedUser.id,
        service_type: coServiceType,
        service_name: coServiceName.trim(),
        amount: amt,
        deduct_wallet: coDeduct,
        notes: coNotes,
        status: coStatus,
        result: coResult,
      });
      toast.success(res.detail);
      setCreateOpen(false);
      resetCreateDialog();
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to create order.");
    }
    setCreating(false);
  };

  const handleUpdate = async () => {
    if (!editingOrder) return;
    setLoading(true);
    try {
      await updateAdminOrder(editingOrder.id, {
        status: newStatus, notes, result,
        tracking_code: trackingCode, tracking_url: trackingUrl,
      });
      toast.success(`Order #${editingOrder.id} updated.`);
      setEditingOrder(null);
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch { toast.error("Failed to update order."); }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 md:p-8 relative bg-primary">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/[0.03] -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-1/3 w-32 h-32 rounded-full bg-white/[0.03] translate-y-1/2" />
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Manage Orders</h1>
                <p className="text-white/50 text-sm mt-0.5">{orders.length} orders found</p>
              </div>
            </div>
            <Button
              className="bg-white/10 hover:bg-white/20 text-white border-0"
              onClick={() => { resetCreateDialog(); setCreateOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-2" /> New Order
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 glass-card p-1.5">
          <div className="flex items-center gap-3 px-4 py-2">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by email, service, or order ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                <span className="text-xs">Clear</span>
              </button>
            )}
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40 h-11"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40 h-11"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="gift">Gift</SelectItem>
            <SelectItem value="smm_boost">Boosting</SelectItem>
            <SelectItem value="phone_number">Phone Number</SelectItem>
            <SelectItem value="social_account">Social Account</SelectItem>
            <SelectItem value="website_template">Website</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="glass-card p-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : orders.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <ShoppingBag className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No orders found</h3>
          <p className="text-sm text-muted-foreground">Try adjusting your filters or search query.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Order</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">User</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Service</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Type</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Amount</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Date</th>
                  <th className="text-right py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, index) => {
                  const sc = statusConfig[order.status];
                  const StatusIcon = sc?.icon || Clock;
                  return (
                    <tr key={order.id} className={`border-b border-border/20 last:border-0 hover:bg-muted/40 transition-colors ${index % 2 === 1 ? "bg-muted/25" : ""}`}>
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs font-bold text-primary">#{order.id}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-xs text-foreground">{order.user_email}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-foreground text-sm">{order.service_name}</span>
                      </td>
                      <td className="py-3.5 px-4 hidden md:table-cell">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                          {typeLabels[order.service_type] || order.service_type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-foreground">{formatAmount(order.amount)}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${sc?.bg || "bg-muted"} ${sc?.color || "text-muted-foreground"}`}>
                          <StatusIcon className="h-3 w-3" />
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground text-xs hidden lg:table-cell">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!["refunded", "cancelled"].includes(order.status) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-8 gap-1 text-amber-500 hover:text-amber-500 hover:bg-amber-500/10"
                              onClick={() => { setRefundingOrder(order); setRefundNote(""); }}
                            >
                              <RotateCcw className="h-3 w-3" /> Refund
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8 gap-1 text-primary hover:text-primary"
                            onClick={() => openEdit(order)}
                          >
                            Update <ArrowUpRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Order Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); resetCreateDialog(); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Plus className="h-4 w-4 text-white" />
              </div>
              Create Manual Order
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* User picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">User</Label>
              {selectedUser ? (
                <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                      {selectedUser.first_name || selectedUser.email.split("@")[0]}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Balance: <span className="font-semibold text-foreground">₦{parseFloat(selectedUser.wallet_balance).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span>
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-xs flex-shrink-0" onClick={() => { setSelectedUser(null); setUserSearch(""); }}>
                    Change
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search user by email or name..."
                    className="pl-9"
                  />
                  {(userSearching || userResults.length > 0) && (
                    <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-xl border border-border bg-background shadow-xl overflow-hidden">
                      {userSearching ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : userResults.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No users found.</p>
                      ) : (
                        userResults.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border/30 last:border-b-0"
                            onClick={() => { setSelectedUser(u); setUserSearch(u.email); setUserResults([]); }}
                          >
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <User className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {u.first_name ? `${u.first_name} ${u.last_name}`.trim() : u.email.split("@")[0]}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            </div>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              ₦{parseFloat(u.wallet_balance).toLocaleString()}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Service type + name */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Service Type</Label>
                <Select value={coServiceType} onValueChange={setCoServiceType}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="social_account">Social Account</SelectItem>
                    <SelectItem value="smm_boost">SMM Boosting</SelectItem>
                    <SelectItem value="phone_number">Phone Number</SelectItem>
                    <SelectItem value="gift">Gift</SelectItem>
                    <SelectItem value="website_template">Website</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Initial Status</Label>
                <Select value={coStatus} onValueChange={setCoStatus}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Service / Product Name</Label>
              <Input
                value={coServiceName}
                onChange={(e) => setCoServiceName(e.target.value)}
                placeholder="e.g. Instagram 10K Followers, USDT Top-up..."
              />
            </div>

            {/* Amount + wallet toggle */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Amount (₦)</Label>
              <div className="flex gap-3 items-center">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₦</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={coAmount}
                    onChange={(e) => setCoAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>
            </div>

            {/* Wallet deduction toggle */}
            <button
              type="button"
              onClick={() => setCoDeduct((v) => !v)}
              className={`w-full flex items-center gap-3 rounded-xl border p-4 transition-colors text-left ${
                coDeduct
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-emerald-500/30 bg-emerald-500/5"
              }`}
            >
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${coDeduct ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
                <Wallet className={`h-4 w-4 ${coDeduct ? "text-amber-500" : "text-emerald-500"}`} />
              </div>
              <div className="flex-1">
                <p className={`text-sm font-bold ${coDeduct ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {coDeduct ? "Deduct from wallet" : "No charge (complimentary)"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {coDeduct
                    ? "Amount will be deducted from user's wallet balance"
                    : "Order is created without touching the user's wallet"}
                </p>
              </div>
              <div className={`h-5 w-9 rounded-full transition-colors flex-shrink-0 ${coDeduct ? "bg-amber-500" : "bg-emerald-500"}`}>
                <div className={`h-4 w-4 rounded-full bg-white shadow m-0.5 transition-transform ${coDeduct ? "translate-x-4" : "translate-x-0"}`} />
              </div>
            </button>

            {coDeduct && selectedUser && parseFloat(coAmount) > parseFloat(selectedUser.wallet_balance) && (
              <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-xs text-destructive">
                  Insufficient balance — user has ₦{parseFloat(selectedUser.wallet_balance).toLocaleString()} but this order costs ₦{parseFloat(coAmount || "0").toLocaleString()}.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Admin Notes <span className="font-normal">(optional)</span></Label>
              <Textarea
                value={coNotes}
                onChange={(e) => setCoNotes(e.target.value)}
                placeholder="Internal notes about this order..."
                rows={2}
              />
            </div>

            {coStatus === "completed" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Result / Delivery Info <span className="font-normal">(shown to user)</span></Label>
                <Textarea
                  value={coResult}
                  onChange={(e) => setCoResult(e.target.value)}
                  placeholder="e.g. Login credentials, delivery confirmation..."
                  rows={3}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetCreateDialog(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !selectedUser || !coServiceName.trim() || coAmount === ""}
              className="bg-primary hover:bg-primary/90 text-white shadow-lg"
            >
              {creating
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</>
                : <><Plus className="h-4 w-4 mr-2" />Create Order</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Confirmation Dialog */}
      <Dialog open={!!refundingOrder} onOpenChange={() => { setRefundingOrder(null); setRefundNote(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <RotateCcw className="h-4 w-4 text-amber-500" />
              </div>
              Refund Order #{refundingOrder?.id}
            </DialogTitle>
          </DialogHeader>
          {refundingOrder && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">User</span>
                  <span className="text-foreground font-semibold">{refundingOrder.user_email}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Service</span>
                  <span className="text-foreground font-semibold">{refundingOrder.service_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground font-medium">Refund Amount</span>
                  <span className="text-base font-bold text-amber-500">{formatAmount(refundingOrder.amount)}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                This will credit <strong>{formatAmount(refundingOrder.amount)}</strong> back to the user's wallet and mark the order as <strong>Refunded</strong>. This cannot be undone.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Reason <span className="font-normal">(optional, shown in admin notes)</span></Label>
                <Input
                  placeholder="e.g. Service unavailable, duplicate order..."
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRefundingOrder(null); setRefundNote(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleRefund}
              disabled={refundLoading}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {refundLoading
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</>
                : <><RotateCcw className="h-4 w-4 mr-2" />Confirm Refund</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Order Dialog */}
      <Dialog open={!!editingOrder} onOpenChange={() => setEditingOrder(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Package className="h-4 w-4 text-white" />
              </div>
              Update Order #{editingOrder?.id}
            </DialogTitle>
          </DialogHeader>
          {editingOrder && (
            <div className="space-y-4 py-2">
              {/* Order summary */}
              <div className="rounded-xl border border-border/30 bg-muted/20 p-4 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">User</span>
                  <span className="text-foreground font-semibold">{editingOrder.user_email}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Service</span>
                  <span className="text-foreground font-semibold">{editingOrder.service_name}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Amount</span>
                  <span className="text-foreground font-bold text-sm">{formatAmount(editingOrder.amount)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Date</span>
                  <span className="text-foreground font-semibold">{new Date(editingOrder.created_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Current Status</span>
                  {(() => {
                    const sc = statusConfig[editingOrder.status];
                    const StatusIcon = sc?.icon || Clock;
                    return (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${sc?.bg || "bg-muted"} ${sc?.color || "text-muted-foreground"}`}>
                        <StatusIcon className="h-3 w-3" /> {editingOrder.status}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Social account order — show buyer-provided details */}
              {editingOrder.service_type === "social_account" && editingOrder.external_data?.user_details && Object.keys(editingOrder.external_data.user_details as Record<string, string>).length > 0 && (
                <div className="rounded-xl border border-border/30 bg-muted/20 p-4 space-y-2.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Buyer Details</p>
                  {Object.entries(editingOrder.external_data.user_details as Record<string, string>).map(([k, v]) => (
                    <div key={k} className="flex justify-between items-start text-xs gap-4">
                      <span className="text-muted-foreground font-medium flex-shrink-0">{k}</span>
                      <span className="text-foreground font-semibold text-right break-all">{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Gift delivery details — only for gift orders with external_data */}
              {editingOrder.service_type === "gift" && editingOrder.external_data && Object.keys(editingOrder.external_data).length > 0 && (
                <div className="rounded-xl border border-border/30 bg-muted/20 p-4 space-y-2.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Gift Delivery Details</p>
                  {editingOrder.external_data.recipient_name && (
                    <div className="flex justify-between items-start text-xs">
                      <span className="text-muted-foreground font-medium">Recipient</span>
                      <span className="text-foreground font-semibold text-right">{editingOrder.external_data.recipient_name}</span>
                    </div>
                  )}
                  {editingOrder.external_data.recipient_phone && (
                    <div className="flex justify-between items-start text-xs">
                      <span className="text-muted-foreground font-medium">Phone</span>
                      <span className="text-foreground font-semibold text-right">{editingOrder.external_data.recipient_phone}</span>
                    </div>
                  )}
                  {editingOrder.external_data.delivery_address && (
                    <div className="flex justify-between items-start text-xs gap-4">
                      <span className="text-muted-foreground font-medium flex-shrink-0">Address</span>
                      <span className="text-foreground font-semibold text-right">{editingOrder.external_data.delivery_address}</span>
                    </div>
                  )}
                  {editingOrder.external_data.sender_name && (
                    <div className="flex justify-between items-start text-xs">
                      <span className="text-muted-foreground font-medium">Sender</span>
                      <span className="text-foreground font-semibold text-right">{editingOrder.external_data.sender_name}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">New Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {editingOrder.service_type === "gift" ? (
                      /* Gift orders have specific statuses */
                      <>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_transit">In Transit</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </>
                    ) : (
                      /* Other order types */
                      <>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {newStatus === "failed" && (
                <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-red-500">Mark as Failed</p>
                    <p className="text-xs text-red-400/80 mt-0.5">Use the <strong>Refund</strong> button on the orders table to return funds to the user's wallet.</p>
                  </div>
                </div>
              )}

              {/* Tracking fields — shown when status is in_transit for gift orders */}
              {newStatus === "in_transit" && editingOrder.service_type === "gift" && (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Link2 className="h-4 w-4 text-indigo-500" />
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Tracking Information</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Tracking Code</Label>
                    <Input
                      value={trackingCode}
                      onChange={(e) => setTrackingCode(e.target.value)}
                      placeholder="e.g. NGR1234567890"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Tracking URL</Label>
                    <Input
                      value={trackingUrl}
                      onChange={(e) => setTrackingUrl(e.target.value)}
                      placeholder="e.g. https://tracking.example.com/track/..."
                      className="h-10"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Notes (admin only)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes..." rows={2} />
              </div>

              {newStatus === "completed" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground uppercase">Result (delivered to user)</Label>
                  <Textarea value={result} onChange={(e) => setResult(e.target.value)} placeholder="Result or delivery details..." rows={2} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrder(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={loading} className="bg-primary hover:bg-primary/90 text-white shadow-lg">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Update Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrdersPage;
