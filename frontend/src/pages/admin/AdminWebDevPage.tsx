import { useState } from "react";
import { Globe, Plus, Pencil, Trash2, Loader2, ExternalLink, Video } from "lucide-react";
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
  fetchAdminWebDev, createAdminWebDev, updateAdminWebDev, deleteAdminWebDev,
  AdminWebDev,
} from "@/lib/api";
import { toast } from "sonner";

const CATEGORIES = ["E-commerce", "Portfolio", "Blog", "Landing Page", "SaaS", "Other"];

const emptyForm = {
  title: "",
  description: "",
  video_url: "",
  website_url: "",
  image_url: "",
  price: "",
  category: "",
  is_active: true,
};

const AdminWebDevPage = () => {
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useQuery({ queryKey: ["admin-webdev"], queryFn: fetchAdminWebDev });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminWebDev | null>(null);
  const [deleting, setDeleting] = useState<AdminWebDev | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: AdminWebDev) => {
    setEditing(item);
    setForm({
      title: item.title,
      description: item.description,
      video_url: item.video_url,
      website_url: item.website_url,
      image_url: item.image_url,
      price: item.price,
      category: item.category,
      is_active: item.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.price) {
      toast.error("Title and price are required.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateAdminWebDev(editing.id, form);
        toast.success("Portfolio item updated.");
      } else {
        await createAdminWebDev(form);
        toast.success("Portfolio item created.");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-webdev"] });
      setDialogOpen(false);
    } catch {
      toast.error("Failed to save portfolio item.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteAdminWebDev(deleting.id);
      toast.success("Portfolio item deleted.");
      queryClient.invalidateQueries({ queryKey: ["admin-webdev"] });
      setDeleteDialogOpen(false);
      setDeleting(null);
    } catch {
      toast.error("Failed to delete portfolio item.");
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
              <Globe className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Web Development Portfolio</h1>
              <p className="text-white/60 text-sm mt-0.5">{items?.length || 0} portfolio items</p>
            </div>
          </div>
          <Button onClick={openCreate} className="bg-white/10 hover:bg-white/20 text-white border border-white/10">
            <Plus className="h-4 w-4 mr-2" /> Add Item
          </Button>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-b from-transparent to-background pointer-events-none" />
      </div>

      {/* Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !items?.length ? (
        <div className="glass-card text-center py-16 text-muted-foreground">No portfolio items yet. Click "Add Item" to create one.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id} className="glass-card overflow-hidden group">
              {/* Image/Placeholder */}
              {item.image_url ? (
                <div className="h-40 overflow-hidden">
                  <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
              ) : (
                <div className="h-40 bg-primary/10 flex items-center justify-center">
                  <Globe className="h-12 w-12 text-emerald-400/40" />
                </div>
              )}

              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                    {item.category && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 mt-1 inline-block">{item.category}</span>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${item.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                    {item.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                )}

                <p className="text-lg font-bold text-foreground">
                  {Number(item.price).toLocaleString("en-NG", { style: "currency", currency: "NGN" })}
                </p>

                {/* Links */}
                <div className="flex gap-2">
                  {item.website_url && (
                    <a href={item.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> Live Demo
                    </a>
                  )}
                  {item.video_url && (
                    <a href={item.video_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                      <Video className="h-3 w-3" /> Video
                    </a>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-white/5">
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => openEdit(item)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="flex-1 text-red-400 hover:text-red-300" onClick={() => { setDeleting(item); setDeleteDialogOpen(true); }}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Portfolio Item" : "Add Portfolio Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input placeholder="Project title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Project description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category || "none"} onValueChange={(v) => setForm({ ...form, category: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Price (NGN)</Label>
              <Input type="number" placeholder="0.00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Demo Video URL</Label>
              <Input type="url" placeholder="https://youtube.com/watch?v=..." value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Live Website URL</Label>
              <Input type="url" placeholder="https://example.com" value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Thumbnail Image URL</Label>
              <Input type="url" placeholder="https://example.com/image.jpg" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
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
            <DialogTitle>Delete Portfolio Item</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Are you sure you want to delete <strong>{deleting?.title}</strong>? This action cannot be undone.
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

export default AdminWebDevPage;
