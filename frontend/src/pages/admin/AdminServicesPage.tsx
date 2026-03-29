import { useState } from "react";
import { Zap, Plus, Pencil, Trash2, Loader2, TrendingUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminBoostingServices, createAdminBoostingService,
  updateAdminBoostingService, deleteAdminBoostingService,
  type AdminBoostingService,
} from "@/lib/api";
import { toast } from "sonner";

const platforms = ["Instagram", "TikTok", "Twitter", "YouTube", "Facebook"];
const categories = ["Followers", "Likes", "Views", "Subscribers", "Comments"];

const emptyForm = {
  name: "", platform: "", category: "", price_per_k: "", min_quantity: "100", max_quantity: "100000", is_active: true,
};

const platformConfig: Record<string, { color: string; gradient: string; icon: string }> = {
  Instagram: { color: "bg-pink-500/10 text-pink-500", gradient: "from-pink-500 to-rose-500", icon: "📸" },
  TikTok: { color: "bg-slate-500/10 text-slate-400", gradient: "from-slate-600 to-slate-800", icon: "🎵" },
  Twitter: { color: "bg-blue-400/10 text-blue-400", gradient: "from-blue-400 to-blue-500", icon: "🐦" },
  YouTube: { color: "bg-red-500/10 text-red-500", gradient: "from-red-500 to-red-600", icon: "▶️" },
  Facebook: { color: "bg-blue-600/10 text-blue-600", gradient: "from-blue-600 to-blue-700", icon: "👤" },
};

const AdminServicesPage = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSvc, setEditingSvc] = useState<AdminBoostingService | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterPlatform, setFilterPlatform] = useState("all");

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["admin-services"],
    queryFn: fetchAdminBoostingServices,
  });

  const filtered = filterPlatform === "all" ? services : services.filter((s) => s.platform === filterPlatform);
  const activeCount = services.filter((s) => s.is_active).length;

  const openCreate = () => {
    setEditingSvc(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (svc: AdminBoostingService) => {
    setEditingSvc(svc);
    setForm({
      name: svc.name,
      platform: svc.platform,
      category: svc.category,
      price_per_k: svc.price_per_k,
      min_quantity: String(svc.min_quantity),
      max_quantity: String(svc.max_quantity),
      is_active: svc.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.platform || !form.category || !form.price_per_k) {
      toast.error("Name, platform, category, and price are required.");
      return;
    }
    setLoading(true);
    try {
      const payload = { ...form, min_quantity: parseInt(form.min_quantity), max_quantity: parseInt(form.max_quantity) };
      if (editingSvc) {
        await updateAdminBoostingService(editingSvc.id, payload);
        toast.success("Service updated.");
      } else {
        await createAdminBoostingService(payload);
        toast.success("Service created.");
      }
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
    } catch { toast.error("Failed to save service."); }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAdminBoostingService(deleteId);
      toast.success("Service deleted.");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
    } catch { toast.error("Failed to delete."); }
  };

  const updateField = (field: string, value: unknown) => setForm((p) => ({ ...p, [field]: value }));

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
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Boosting Services</h1>
                <p className="text-white/50 text-sm mt-0.5">{services.length} services &middot; {activeCount} active</p>
              </div>
            </div>
            <Button onClick={openCreate} className="bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-sm shadow-lg">
              <Plus className="h-4 w-4 mr-2" /> Add Service
            </Button>
          </div>
        </div>
      </div>

      {/* Platform filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterPlatform("all")}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${filterPlatform === "all" ? "bg-primary text-white shadow-lg shadow-primary/25" : "glass-card text-muted-foreground hover:text-foreground hover:border-primary/30"}`}
        >
          All Platforms ({services.length})
        </button>
        {platforms.map((p) => {
          const count = services.filter((s) => s.platform === p).length;
          const config = platformConfig[p];
          return (
            <button
              key={p}
              onClick={() => setFilterPlatform(p)}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${filterPlatform === p ? "bg-primary text-white shadow-lg shadow-primary/25" : "glass-card text-muted-foreground hover:text-foreground hover:border-primary/30"}`}
            >
              <span>{config?.icon}</span> {p} ({count})
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="glass-card p-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Zap className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No services found</h3>
          <p className="text-sm text-muted-foreground mb-5">
            {filterPlatform !== "all" ? `No ${filterPlatform} services yet.` : "Add your first boosting service."}
          </p>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Add Service</Button>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Service</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Platform</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Category</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    <span className="flex items-center gap-1">Price/1K <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Range</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right py-3.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((svc) => {
                  const config = platformConfig[svc.platform];
                  return (
                    <tr key={svc.id} className="border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                            <Zap className="h-3.5 w-3.5 text-white" />
                          </div>
                          <span className="font-semibold text-foreground">{svc.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${config?.color || "bg-muted text-muted-foreground"}`}>
                          {config?.icon} {svc.platform}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-xs text-muted-foreground font-medium">{svc.category}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-foreground flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-emerald-500" /> ${svc.price_per_k}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground text-xs hidden md:table-cell">
                        {svc.min_quantity.toLocaleString()} — {svc.max_quantity.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${svc.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                          {svc.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => openEdit(svc)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteId(svc.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                {editingSvc ? <Pencil className="h-4 w-4 text-white" /> : <Plus className="h-4 w-4 text-white" />}
              </div>
              {editingSvc ? "Edit Service" : "Add New Service"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Service Name *</Label>
              <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Instagram Followers" className="h-11" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Platform *</Label>
                <Select value={form.platform} onValueChange={(v) => updateField("platform", v)}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {platforms.map((p) => <SelectItem key={p} value={p}>{platformConfig[p]?.icon} {p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Category *</Label>
                <Select value={form.category} onValueChange={(v) => updateField("category", v)}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Price/1K *</Label>
                <Input type="number" value={form.price_per_k} onChange={(e) => updateField("price_per_k", e.target.value)} placeholder="4.50" step="0.01" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Min Qty</Label>
                <Input type="number" value={form.min_quantity} onChange={(e) => updateField("min_quantity", e.target.value)} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Max Qty</Label>
                <Input type="number" value={form.max_quantity} onChange={(e) => updateField("max_quantity", e.target.value)} className="h-11" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Status</Label>
              <Select value={form.is_active ? "true" : "false"} onValueChange={(v) => updateField("is_active", v === "true")}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={loading} className="bg-primary hover:bg-primary/90 text-white shadow-lg">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingSvc ? "Update" : "Create"} Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Trash2 className="h-4 w-4 text-red-500" />
              </div>
              Delete Service?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone. The service will be permanently removed.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Service</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminServicesPage;
