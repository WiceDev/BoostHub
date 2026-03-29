import { useState } from "react";
import { AtSign, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminAccounts, createAdminAccount, updateAdminAccount, deleteAdminAccount,
  AdminAccount,
} from "@/lib/api";
import { toast } from "sonner";

const PLATFORMS = ["Instagram", "Facebook", "Twitter", "TikTok", "Telegram", "YouTube", "Snapchat", "LinkedIn"];

const emptyForm = {
  platform: "Instagram",
  service_name: "",
  description: "",
  price: "",
  buying_price: "",
  notes: "",
  required_fields_raw: "", // comma-separated field labels
  is_active: true,
};

const AdminAccountsPage = () => {
  const queryClient = useQueryClient();
  const { data: accounts, isLoading, error } = useQuery({ queryKey: ["admin-accounts"], queryFn: fetchAdminAccounts });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminAccount | null>(null);
  const [deleting, setDeleting] = useState<AdminAccount | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (a: AdminAccount) => {
    setEditing(a);
    setForm({
      platform: a.platform,
      service_name: a.service_name,
      description: a.description,
      price: a.price,
      buying_price: a.buying_price ?? "",
      notes: a.notes,
      required_fields_raw: (a.required_fields || []).join(", "),
      is_active: a.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.service_name || !form.price) {
      toast.error("Service name and price are required.");
      return;
    }
    setSaving(true);
    const required_fields = form.required_fields_raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = { ...form, required_fields };
    try {
      if (editing) {
        await updateAdminAccount(editing.id, payload);
        toast.success("Account updated.");
      } else {
        await createAdminAccount(payload);
        toast.success("Account created.");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });
      setDialogOpen(false);
    } catch {
      toast.error("Failed to save account.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteAdminAccount(deleting.id);
      toast.success("Account deleted.");
      queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });
      setDeleteDialogOpen(false);
      setDeleting(null);
    } catch {
      toast.error("Failed to delete account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-t-2xl p-8 bg-primary">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)" }} />
        <div className="absolute inset-0 header-diamond-pattern pointer-events-none" />
        <div className="relative z-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <AtSign className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Social Media Accounts</h1>
              <p className="text-white/60 text-sm mt-0.5">{accounts?.length || 0} accounts configured</p>
            </div>
          </div>
          <Button onClick={openCreate} className="bg-white/10 hover:bg-white/20 text-white border border-white/10">
            <Plus className="h-4 w-4 mr-2" /> Add Account
          </Button>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-b from-transparent to-background pointer-events-none" />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-16 text-destructive text-sm">
            Failed to load accounts: {(error as Error).message}
          </div>
        ) : !accounts?.length ? (
          <div className="text-center py-16 text-muted-foreground">No accounts yet. Click "Add Account" to create one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left p-4 text-muted-foreground font-medium">Platform</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Service Name</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Required Fields</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Selling / Buying</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="p-4 font-medium">{a.platform}</td>
                    <td className="p-4">{a.service_name}</td>
                    <td className="p-4 text-xs text-muted-foreground">
                      {(a.required_fields || []).length > 0
                        ? (a.required_fields || []).join(", ")
                        : <span className="opacity-40">None</span>
                      }
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-sm font-semibold">{Number(a.price).toLocaleString("en-NG", { style: "currency", currency: "NGN" })}</span>
                      {a.buying_price && (
                        <p className="text-[10px] text-muted-foreground font-mono">
                          Cost: {Number(a.buying_price).toLocaleString("en-NG", { style: "currency", currency: "NGN" })}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                        {a.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => { setDeleting(a); setDeleteDialogOpen(true); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Account" : "Add Account"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Service Name</Label>
              <Input placeholder="e.g. Aged Instagram Account" value={form.service_name} onChange={(e) => setForm({ ...form, service_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Account description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Selling Price (NGN)</Label>
                <Input type="number" placeholder="0.00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                <p className="text-[10px] text-muted-foreground">What the user pays</p>
              </div>
              <div className="space-y-2">
                <Label>Buying Price (NGN)</Label>
                <Input type="number" placeholder="0.00" value={form.buying_price} onChange={(e) => setForm({ ...form, buying_price: e.target.value })} />
                <p className="text-[10px] text-muted-foreground">Your cost — profit tracking</p>
              </div>
            </div>
            {form.price && form.buying_price && parseFloat(form.buying_price) > 0 && (
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Profit per sale</span>
                <span className="font-bold text-emerald-600">
                  ₦{(parseFloat(form.price) - parseFloat(form.buying_price)).toLocaleString()} &nbsp;
                  ({(((parseFloat(form.price) - parseFloat(form.buying_price)) / parseFloat(form.price)) * 100).toFixed(1)}% margin)
                </span>
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Extra notes for buyer..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Required Fields from Buyer</Label>
              <Input
                placeholder="e.g. Target Username, Email (comma-separated)"
                value={form.required_fields_raw}
                onChange={(e) => setForm({ ...form, required_fields_raw: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of info you need from the buyer before their order is fulfilled.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.is_active ? "active" : "inactive"} onValueChange={(v) => setForm({ ...form, is_active: v === "active" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Are you sure you want to delete <strong>{deleting?.service_name}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAccountsPage;
