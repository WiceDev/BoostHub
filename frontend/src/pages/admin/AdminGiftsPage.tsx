import { useState, useRef } from "react";
import { Gift, Plus, Pencil, Trash2, Loader2, Star, Tag, Sparkles, Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminGifts, createAdminGift, updateAdminGift, deleteAdminGift,
  uploadGiftImages, deleteGiftImage, reorderGiftImages,
  type AdminGift, type GiftImage,
} from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { toast } from "sonner";

const categoryOptions = [
  { value: "food_groceries", label: "Food & Groceries" },
  { value: "electronics", label: "Electronics" },
  { value: "fashion", label: "Fashion" },
  { value: "home_living", label: "Home & Living" },
  { value: "health_beauty", label: "Health & Beauty" },
];

const colorOptions = [
  "bg-blue-500",
  "bg-blue-600",
  "bg-blue-700",
  "bg-blue-800",
  "bg-sky-500",
  "bg-sky-600",
  "bg-indigo-500",
  "bg-indigo-600",
  "bg-cyan-500",
  "bg-slate-600",
];

const emptyForm = {
  name: "", description: "", price: "", buying_price: "", category: "", emoji: "", color: colorOptions[0],
  image_url: "", delivery_days: "3", notes: "", rating: "4.5", is_active: true,
};

const AdminGiftsPage = () => {
  const { formatAmount } = useCurrency();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGift, setEditingGift] = useState<AdminGift | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [currentImages, setCurrentImages] = useState<GiftImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: gifts = [], isLoading } = useQuery({
    queryKey: ["admin-gifts"],
    queryFn: fetchAdminGifts,
  });

  const activeCount = gifts.filter((g) => g.is_active).length;

  const openCreate = () => {
    setEditingGift(null);
    setForm(emptyForm);
    setCurrentImages([]);
    setDialogOpen(true);
  };

  const openEdit = (gift: AdminGift) => {
    setEditingGift(gift);
    setForm({
      name: gift.name,
      description: gift.description,
      price: gift.price,
      buying_price: gift.buying_price ?? "",
      category: gift.category,
      emoji: gift.emoji,
      color: gift.color,
      image_url: gift.image_url || "",
      delivery_days: String(gift.delivery_days || 3),
      notes: gift.notes || "",
      rating: gift.rating,
      is_active: gift.is_active,
    });
    setCurrentImages(gift.images || []);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price || !form.category) {
      toast.error("Name, price, and category are required.");
      return;
    }
    setLoading(true);
    try {
      if (editingGift) {
        await updateAdminGift(editingGift.id, form);
        toast.success("Gift updated.");
      } else {
        await createAdminGift(form);
        toast.success("Gift created.");
      }
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-gifts"] });
    } catch { toast.error("Failed to save gift."); }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAdminGift(deleteId);
      toast.success("Gift deleted.");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-gifts"] });
    } catch { toast.error("Failed to delete gift."); }
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || !editingGift) return;
    const fileArray = Array.from(files);
    if (currentImages.length + fileArray.length > 8) {
      toast.error("Maximum 8 images per gift.");
      return;
    }
    setUploadingImages(true);
    try {
      const res = await uploadGiftImages(editingGift.id, fileArray);
      setCurrentImages(prev => [...prev, ...res.images]);
      toast.success(res.detail);
      queryClient.invalidateQueries({ queryKey: ["admin-gifts"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to upload images.");
    }
    setUploadingImages(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImageDelete = async (imageId: number) => {
    if (!editingGift) return;
    try {
      await deleteGiftImage(editingGift.id, imageId);
      setCurrentImages(prev => prev.filter(img => img.id !== imageId));
      toast.success("Image deleted.");
      queryClient.invalidateQueries({ queryKey: ["admin-gifts"] });
    } catch { toast.error("Failed to delete image."); }
  };

  const handleMoveImage = async (index: number, direction: -1 | 1) => {
    if (!editingGift) return;
    const newImages = [...currentImages];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= newImages.length) return;
    [newImages[index], newImages[swapIndex]] = [newImages[swapIndex], newImages[index]];
    setCurrentImages(newImages);
    try {
      await reorderGiftImages(editingGift.id, newImages.map(img => img.id));
      queryClient.invalidateQueries({ queryKey: ["admin-gifts"] });
    } catch { toast.error("Failed to reorder images."); }
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
                <Gift className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Manage Gifts</h1>
                <p className="text-white/50 text-sm mt-0.5">{gifts.length} gifts &middot; {activeCount} active</p>
              </div>
            </div>
            <Button onClick={openCreate} className="bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-sm shadow-lg">
              <Plus className="h-4 w-4 mr-2" /> Add Gift
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-card p-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : gifts.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Gift className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No gifts yet</h3>
          <p className="text-sm text-muted-foreground mb-5">Add your first gift to the catalog</p>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Add First Gift</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {gifts.map((gift) => {
            const firstImage = gift.images?.[0];
            return (
              <div key={gift.id} className={`glass-card overflow-hidden group hover:border-primary/30 hover:shadow-lg transition-all duration-300 ${!gift.is_active ? "opacity-60" : ""}`}>
                {/* Card gradient top / image */}
                <div className="h-36 bg-primary/80 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  {firstImage ? (
                    <img src={firstImage.url} alt={gift.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : gift.image_url ? (
                    <img src={gift.image_url} alt={gift.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <span className="text-5xl drop-shadow-lg relative z-10 group-hover:scale-110 transition-transform duration-300">{gift.emoji || "🎁"}</span>
                  )}
                  {gift.images?.length > 1 && (
                    <span className="absolute bottom-2 right-2 text-[10px] font-bold bg-black/60 text-white px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" /> {gift.images.length}
                    </span>
                  )}
                  {!gift.is_active && (
                    <span className="absolute top-3 right-3 text-[10px] font-bold bg-black/60 text-white px-2.5 py-1 rounded-full backdrop-blur-sm">Inactive</span>
                  )}
                  {gift.rating && parseFloat(gift.rating) >= 4.5 && (
                    <span className="absolute top-3 left-3 text-[10px] font-bold bg-white/20 text-white px-2 py-1 rounded-full backdrop-blur-sm flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Popular
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      <Tag className="h-2.5 w-2.5" />
                      {categoryOptions.find((c) => c.value === gift.category)?.label || gift.category}
                    </span>
                    {gift.rating && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        <Star className="h-2.5 w-2.5 fill-amber-500" /> {gift.rating}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-foreground">{gift.name}</h3>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{gift.description}</p>
                  {gift.delivery_days > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">Delivery: {gift.delivery_days} day{gift.delivery_days !== 1 ? "s" : ""}</p>
                  )}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
                    <div>
                      <span className="text-lg font-bold text-foreground">{formatAmount(gift.price)}</span>
                      {gift.buying_price && (
                        <p className="text-[10px] text-muted-foreground">Cost: {formatAmount(gift.buying_price)}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => openEdit(gift)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteId(gift.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                {editingGift ? <Pencil className="h-4 w-4 text-white" /> : <Plus className="h-4 w-4 text-white" />}
              </div>
              {editingGift ? "Edit Gift" : "Add New Gift"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Name *</Label>
              <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Gift name" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Description</Label>
              <Textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="Short description" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Selling Price (NGN) *</Label>
                <Input type="number" value={form.price} onChange={(e) => updateField("price", e.target.value)} placeholder="25000" className="h-11" />
                <p className="text-[10px] text-muted-foreground">What the user pays</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Buying Price (NGN)</Label>
                <Input type="number" value={form.buying_price} onChange={(e) => updateField("buying_price", e.target.value)} placeholder="18000" className="h-11" />
                <p className="text-[10px] text-muted-foreground">Your cost — for profit tracking</p>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Rating</Label>
                <Input type="number" value={form.rating} onChange={(e) => updateField("rating", e.target.value)} min="0" max="5" step="0.1" className="h-11" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Category *</Label>
              <Select value={form.category} onValueChange={(v) => updateField("category", v)}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Emoji</Label>
              <Input value={form.emoji} onChange={(e) => updateField("emoji", e.target.value)} placeholder="🎁" className="h-11" />
            </div>

            {/* Image Upload Section */}
            {editingGift ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-muted-foreground uppercase">Images ({currentImages.length}/8)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={uploadingImages || currentImages.length >= 8}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadingImages ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                    Upload
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleImageUpload(e.target.files)}
                  />
                </div>
                {currentImages.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {currentImages.map((img, idx) => (
                      <div key={img.id} className="relative group/img aspect-square rounded-lg overflow-hidden border border-border/50">
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover/img:opacity-100">
                          {idx > 0 && (
                            <button onClick={() => handleMoveImage(idx, -1)} className="h-6 w-6 rounded bg-white/90 flex items-center justify-center text-[10px] font-bold text-black hover:bg-white">
                              ←
                            </button>
                          )}
                          {idx < currentImages.length - 1 && (
                            <button onClick={() => handleMoveImage(idx, 1)} className="h-6 w-6 rounded bg-white/90 flex items-center justify-center text-[10px] font-bold text-black hover:bg-white">
                              →
                            </button>
                          )}
                          <button onClick={() => handleImageDelete(img.id)} className="h-6 w-6 rounded bg-red-500/90 flex items-center justify-center hover:bg-red-500">
                            <X className="h-3 w-3 text-white" />
                          </button>
                        </div>
                        {idx === 0 && (
                          <span className="absolute bottom-1 left-1 text-[8px] font-bold bg-primary/90 text-white px-1.5 py-0.5 rounded">Main</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-border/50 rounded-lg p-6 text-center cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Click to upload images</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Max 5MB per image, up to 8 images</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-muted/30 border border-border/50 px-3 py-3 text-center">
                <ImageIcon className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Save the gift first, then upload images</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Image URL (legacy)</Label>
              <Input type="url" value={form.image_url} onChange={(e) => updateField("image_url", e.target.value)} placeholder="https://example.com/gift-image.jpg" className="h-11" />
              <p className="text-[10px] text-muted-foreground">Fallback if no uploaded images</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Delivery Days</Label>
                <Input type="number" value={form.delivery_days} onChange={(e) => updateField("delivery_days", e.target.value)} min="1" className="h-11" />
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
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Notes (shown to buyer)</Label>
              <Textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Extra notes for the buyer..." rows={2} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Color</Label>
              <div className="flex flex-wrap gap-2.5">
                {colorOptions.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateField("color", c)}
                    className={`h-9 w-9 rounded-xl ${c} border-2 transition-all hover:scale-110 ${form.color === c ? "border-foreground scale-110 shadow-lg" : "border-transparent"}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={loading} className="bg-primary hover:bg-primary/90 text-white shadow-lg">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingGift ? "Update" : "Create"} Gift
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
              Delete Gift?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone. The gift will be permanently removed from the catalog.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Gift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminGiftsPage;
