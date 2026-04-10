import { useState, useRef } from "react";
import { Globe, Plus, Pencil, Trash2, Loader2, ExternalLink, Video, Upload, X, ImageIcon, Film } from "lucide-react";
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
  uploadWebDevMedia, deleteWebDevMedia,
  AdminWebDev, WebDevMedia,
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
  const [currentMedia, setCurrentMedia] = useState<WebDevMedia[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setCurrentMedia([]);
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
    setCurrentMedia(item.media || []);
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

  const handleMediaUpload = async (files: FileList | null) => {
    if (!files || !editing) return;
    const fileArray = Array.from(files);
    if (currentMedia.length + fileArray.length > 5) {
      toast.error("Maximum 5 media files per item.");
      return;
    }
    setUploadingMedia(true);
    try {
      const res = await uploadWebDevMedia(editing.id, fileArray);
      setCurrentMedia(prev => [...prev, ...res.media]);
      toast.success(res.detail);
      queryClient.invalidateQueries({ queryKey: ["admin-webdev"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to upload media.");
    }
    setUploadingMedia(false);
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  };

  const handleMediaDelete = async (mediaId: number) => {
    if (!editing) return;
    try {
      await deleteWebDevMedia(editing.id, mediaId);
      setCurrentMedia(prev => prev.filter(m => m.id !== mediaId));
      toast.success("Media deleted.");
      queryClient.invalidateQueries({ queryKey: ["admin-webdev"] });
    } catch { toast.error("Failed to delete media."); }
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
          {items.map((item) => {
            const firstImage = item.media?.find(m => m.media_type === 'image');
            const videoCount = item.media?.filter(m => m.media_type === 'video').length || 0;
            return (
              <div key={item.id} className="glass-card overflow-hidden group">
                {firstImage ? (
                  <div className="h-40 overflow-hidden relative">
                    <img src={firstImage.url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    {videoCount > 0 && (
                      <span className="absolute bottom-2 right-2 text-[10px] font-bold bg-black/60 text-white px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1">
                        <Film className="h-3 w-3" /> {videoCount} video{videoCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                ) : item.image_url ? (
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
                    {item.media?.length > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" /> {item.media.length} file{item.media.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

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
            );
          })}
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

            {/* Media Upload Section */}
            {editing ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-muted-foreground uppercase">Media Files ({currentMedia.length}/5)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={uploadingMedia || currentMedia.length >= 5}
                    onClick={() => mediaInputRef.current?.click()}
                  >
                    {uploadingMedia ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                    Upload
                  </Button>
                  <input
                    ref={mediaInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleMediaUpload(e.target.files)}
                  />
                </div>
                {currentMedia.length > 0 ? (
                  <div className="space-y-2">
                    {currentMedia.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border/50 p-2 group/media">
                        {m.media_type === 'video' ? (
                          <div className="h-14 w-20 rounded bg-black flex items-center justify-center flex-shrink-0">
                            <video src={m.url} className="h-full w-full object-cover rounded" />
                          </div>
                        ) : (
                          <img src={m.url} alt="" className="h-14 w-20 rounded object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${m.media_type === 'video' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                            {m.media_type}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-300 opacity-0 group-hover/media:opacity-100 transition-opacity"
                          onClick={() => handleMediaDelete(m.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-border/50 rounded-lg p-6 text-center cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => mediaInputRef.current?.click()}
                  >
                    <Film className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Click to upload videos or images</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Videos max 50MB, images max 5MB, up to 5 files</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-muted/30 border border-border/50 px-3 py-3 text-center">
                <Film className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Save the item first, then upload media</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Demo Video URL (legacy)</Label>
              <Input type="url" placeholder="https://youtube.com/watch?v=..." value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} />
              <p className="text-[10px] text-muted-foreground">Fallback if no uploaded videos</p>
            </div>
            <div className="space-y-2">
              <Label>Live Website URL</Label>
              <Input type="url" placeholder="https://example.com" value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Thumbnail Image URL (legacy)</Label>
              <Input type="url" placeholder="https://example.com/image.jpg" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
              <p className="text-[10px] text-muted-foreground">Fallback if no uploaded images</p>
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
