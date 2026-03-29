import { useState } from "react";
import {
  Search, Users, ShieldCheck, ShieldAlert, ChevronRight, Loader2,
  CreditCard, Crown, UserCircle, ArrowUpRight, Wallet, Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAdminUsers, fetchAdminUser, updateAdminUser, creditAdminUser, debitAdminUser, deleteAdminUser, type AdminUser, type AdminUserDetail } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { toast } from "sonner";

const AdminUsersPage = () => {
  const { formatAmount } = useCurrency();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [debitDialogOpen, setDebitDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDesc, setCreditDesc] = useState("Admin credit");
  const [debitAmount, setDebitAmount] = useState("");
  const [debitDesc, setDebitDesc] = useState("Admin debit");
  const [creditUserId, setCreditUserId] = useState<number | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => fetchAdminUsers(search || undefined),
  });

  const { data: userDetail } = useQuery({
    queryKey: ["admin-user", selectedUserId],
    queryFn: () => fetchAdminUser(selectedUserId!),
    enabled: !!selectedUserId,
  });

  const handleToggleActive = async (user: AdminUser | AdminUserDetail) => {
    try {
      await updateAdminUser(user.id, { is_active: !user.is_active });
      toast.success(`User ${user.is_active ? "deactivated" : "activated"}.`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user"] });
    } catch { toast.error("Failed to update user."); }
  };

  const handleToggleVerified = async (user: AdminUser | AdminUserDetail) => {
    try {
      await updateAdminUser(user.id, { is_verified: !user.is_verified });
      toast.success(`Email ${user.is_verified ? "unverified" : "verified"}.`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user"] });
    } catch { toast.error("Failed to update user."); }
  };

  const handleToggleStaff = async (user: AdminUser | AdminUserDetail) => {
    try {
      await updateAdminUser(user.id, { is_staff: !user.is_staff });
      toast.success(`Admin access ${user.is_staff ? "revoked" : "granted"}.`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user"] });
    } catch { toast.error("Failed to update user."); }
  };

  const handleCredit = async () => {
    if (!creditUserId || !creditAmount) return;
    setLoading(true);
    try {
      const res = await creditAdminUser(creditUserId, parseFloat(creditAmount), creditDesc);
      toast.success(res.detail);
      setCreditDialogOpen(false);
      setCreditAmount("");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user"] });
    } catch { toast.error("Failed to credit wallet."); }
    setLoading(false);
  };

  const handleDebit = async () => {
    if (!creditUserId || !debitAmount) return;
    setLoading(true);
    try {
      const res = await debitAdminUser(creditUserId, parseFloat(debitAmount), debitDesc);
      toast.success(res.detail);
      setDebitDialogOpen(false);
      setDebitAmount("");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user"] });
    } catch { toast.error("Failed to debit wallet. Check if user has sufficient balance."); }
    setLoading(false);
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    setLoading(true);
    try {
      await deleteAdminUser(deleteUserId);
      toast.success("User deleted.");
      setDeleteDialogOpen(false);
      setDeleteUserId(null);
      setSelectedUserId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch { toast.error("Failed to delete user."); }
    setLoading(false);
  };

  const statusColors: Record<string, string> = {
    completed: "bg-emerald-500/10 text-emerald-500",
    pending: "bg-amber-500/10 text-amber-500",
    processing: "bg-blue-500/10 text-blue-500",
    failed: "bg-red-500/10 text-red-500",
    refunded: "bg-primary/10 text-primary",
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (name[0] || "?").toUpperCase();
  };

  const avatarGradients = [
    "bg-blue-500",
    "bg-blue-600",
    "bg-blue-700",
    "bg-blue-800",
    "bg-blue-500",
    "bg-blue-600",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 md:p-8 relative bg-primary">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/[0.03] -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-1/3 w-32 h-32 rounded-full bg-white/[0.03] translate-y-1/2" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Manage Users</h1>
                <p className="text-white/50 text-sm mt-0.5">{users.length} registered users</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="glass-card p-1.5 max-w-lg">
        <div className="flex items-center gap-3 px-4 py-2">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by email, name, or username..."
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

      {isLoading ? (
        <div className="glass-card p-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : users.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">No users found.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">User</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Phone</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Balance</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Orders</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Status</th>
                  <th className="text-right py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr key={user.id} className="border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-full ${avatarGradients[idx % avatarGradients.length]} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                          <span className="text-[11px] font-bold text-white">{getInitials(user.full_name)}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground text-sm truncate">{user.full_name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground text-xs hidden md:table-cell">{user.phone || "—"}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-foreground">{formatAmount(user.wallet_balance)}</span>
                    </td>
                    <td className="py-3.5 px-4 hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Hash className="h-3 w-3" />{user.orders_count}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {user.is_verified ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">
                            <ShieldCheck className="h-3 w-3" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full">
                            <ShieldAlert className="h-3 w-3" /> Unverified
                          </span>
                        )}
                        {user.is_staff && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            <Crown className="h-3 w-3" /> Admin
                          </span>
                        )}
                        {!user.is_active && (
                          <span className="text-[10px] font-semibold bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full">Disabled</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8 gap-1.5 text-emerald-400 hover:text-emerald-300"
                          onClick={() => { setCreditUserId(user.id); setCreditDialogOpen(true); }}
                        >
                          <CreditCard className="h-3.5 w-3.5" /> Credit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8 gap-1.5 text-amber-400 hover:text-amber-300"
                          onClick={() => { setCreditUserId(user.id); setDebitDialogOpen(true); }}
                        >
                          <CreditCard className="h-3.5 w-3.5" /> Debit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8 gap-1 text-primary hover:text-primary"
                          onClick={() => setSelectedUserId(user.id)}
                        >
                          View <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUserId} onOpenChange={() => setSelectedUserId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <UserCircle className="h-5 w-5 text-primary" />
              User Details
            </DialogTitle>
          </DialogHeader>
          {userDetail ? (
            <div className="space-y-5">
              {/* User profile header */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-primary/5 border border-border/30">
                <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center shadow-lg">
                  <span className="text-lg font-bold text-white">{getInitials(userDetail.full_name)}</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{userDetail.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{userDetail.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {userDetail.is_staff && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        <Crown className="h-3 w-3" /> Admin
                      </span>
                    )}
                    {userDetail.is_verified && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">
                        <ShieldCheck className="h-3 w-3" /> Verified
                      </span>
                    )}
                    {!userDetail.is_active && (
                      <span className="text-[10px] font-semibold bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full">Disabled</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Username", value: userDetail.username, icon: UserCircle },
                  { label: "Phone", value: userDetail.phone || "—", icon: null },
                  { label: "Wallet Balance", value: formatAmount(userDetail.wallet_balance), icon: Wallet, highlight: true },
                  { label: "Total Orders", value: userDetail.orders.length, icon: Hash },
                  { label: "Member Since", value: new Date(userDetail.date_joined).toLocaleDateString(), icon: null },
                ].map((item) => (
                  <div key={item.label} className={`rounded-xl border border-border/30 p-3.5 ${item.highlight ? "bg-primary/5" : "bg-muted/20"}`}>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{item.label}</p>
                    <p className={`text-sm mt-1 ${item.highlight ? "font-bold text-primary" : "font-medium text-foreground"}`}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Admin actions */}
              <div className="flex gap-2 flex-wrap p-3 rounded-xl bg-muted/20 border border-border/30">
                <Button size="sm" variant={userDetail.is_active ? "destructive" : "default"} onClick={() => handleToggleActive(userDetail)} className="text-xs h-8">
                  {userDetail.is_active ? "Deactivate" : "Activate"} Account
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleToggleVerified(userDetail)} className="text-xs h-8">
                  <ShieldCheck className="h-3 w-3 mr-1.5" />
                  {userDetail.is_verified ? "Unverify Email" : "Verify Email"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleToggleStaff(userDetail)} className="text-xs h-8">
                  <Crown className="h-3 w-3 mr-1.5" />
                  {userDetail.is_staff ? "Revoke Admin" : "Make Admin"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setCreditUserId(userDetail.id); setCreditDialogOpen(true); }} className="text-xs h-8">
                  <CreditCard className="h-3 w-3 mr-1.5" /> Credit Wallet
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setCreditUserId(userDetail.id); setDebitDialogOpen(true); }} className="text-xs h-8">
                  <CreditCard className="h-3 w-3 mr-1.5" /> Debit Wallet
                </Button>
                {!userDetail.is_staff && (
                  <Button size="sm" variant="destructive" onClick={() => { setDeleteUserId(userDetail.id); setDeleteDialogOpen(true); }} className="text-xs h-8">
                    Delete Account
                  </Button>
                )}
              </div>

              {/* Recent transactions */}
              {userDetail.transactions.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Recent Transactions</h4>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto rounded-xl border border-border/30 p-2">
                    {userDetail.transactions.map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors text-xs">
                        <div className="flex items-center gap-2">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center ${t.transaction_type === "credit" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                            <span className={`text-[10px] font-bold ${t.transaction_type === "credit" ? "text-emerald-500" : "text-red-500"}`}>
                              {t.transaction_type === "credit" ? "+" : "-"}
                            </span>
                          </div>
                          <div>
                            <span className={`font-semibold ${t.transaction_type === "credit" ? "text-emerald-500" : "text-red-500"}`}>{t.transaction_type}</span>
                            <span className="text-muted-foreground ml-2">{t.description}</span>
                          </div>
                        </div>
                        <span className="font-bold text-foreground">{formatAmount(t.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent orders */}
              {userDetail.orders.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Recent Orders</h4>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto rounded-xl border border-border/30 p-2">
                    {userDetail.orders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-muted-foreground">#{o.id}</span>
                          <span className="font-medium text-foreground">{o.service_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[o.status] || "bg-muted text-muted-foreground"}`}>{o.status}</span>
                          <span className="font-bold text-foreground">{formatAmount(o.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Credit Wallet Dialog */}
      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Wallet className="h-4 w-4 text-white" />
              </div>
              Credit User Wallet
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Amount (NGN)</Label>
              <Input type="number" placeholder="Enter amount" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} min="1" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Description</Label>
              <Input value={creditDesc} onChange={(e) => setCreditDesc(e.target.value)} className="h-11" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCredit} disabled={loading || !creditAmount} className="bg-primary hover:bg-primary/90 text-white shadow-lg">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Credit Wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Debit Wallet Dialog */}
      <Dialog open={debitDialogOpen} onOpenChange={setDebitDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Wallet className="h-4 w-4 text-white" />
              </div>
              Debit User Wallet
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Amount (NGN)</Label>
              <Input type="number" placeholder="Enter amount" value={debitAmount} onChange={(e) => setDebitAmount(e.target.value)} min="1" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Description</Label>
              <Input value={debitDesc} onChange={(e) => setDebitDesc(e.target.value)} className="h-11" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDebitDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDebit} disabled={loading || !debitAmount} className="bg-primary hover:bg-primary/90 text-white shadow-lg">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Debit Wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete User Account</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Are you sure you want to permanently delete this user? This action cannot be undone. All user data including orders and transactions will be removed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsersPage;
