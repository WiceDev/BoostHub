import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  AdminAnnouncement,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Megaphone, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EMPTY_FORM = { title: "", body: "", is_active: true };

export default function AdminAnnouncementsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminAnnouncement | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminAnnouncement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: fetchAdminAnnouncements,
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (a: AdminAnnouncement) => {
    setEditing(a);
    setForm({ title: a.title, body: a.body, is_active: a.is_active });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast({ title: "Validation", description: "Title and body are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateAnnouncement(editing.id, form);
        toast({ title: "Updated", description: "Announcement updated." });
      } else {
        await createAnnouncement(form);
        toast({ title: "Created", description: "Announcement published." });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setDialogOpen(false);
    } catch {
      toast({ title: "Error", description: "Failed to save announcement.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (a: AdminAnnouncement) => {
    try {
      await updateAnnouncement(a.id, { is_active: !a.is_active });
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    } catch {
      toast({ title: "Error", description: "Failed to update.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAnnouncement(deleteTarget.id);
      toast({ title: "Deleted", description: "Announcement removed." });
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setDeleteTarget(null);
    } catch {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage updates shown to all users on the dashboard
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Announcement
        </Button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))
        ) : !announcements?.length ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
            <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No announcements yet</p>
            <p className="text-sm mt-1 opacity-70">Click "New Announcement" to publish one</p>
          </div>
        ) : (
          announcements.map((a) => (
            <div
              key={a.id}
              className="bg-card border border-border rounded-xl p-5 flex gap-4 items-start"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-foreground text-sm">{a.title}</p>
                  <Badge
                    variant="outline"
                    className={a.is_active
                      ? "text-[10px] bg-success/10 text-success border-success/20"
                      : "text-[10px] bg-muted text-muted-foreground"}
                  >
                    {a.is_active ? "Active" : "Hidden"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-3">{a.body}</p>
                <p className="text-xs text-muted-foreground/60 mt-2">
                  {new Date(a.created_at).toLocaleDateString("en-NG", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                  {a.updated_at !== a.created_at && " · edited"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch
                  checked={a.is_active}
                  onCheckedChange={() => handleToggleActive(a)}
                  title={a.is_active ? "Hide from users" : "Show to users"}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget(a)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Announcement" : "New Announcement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                placeholder="e.g. Platform maintenance on Sunday"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea
                placeholder="Write your announcement here…"
                className="min-h-[120px] resize-y"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              <Label htmlFor="is_active">Visible to users immediately</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Announcement</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete "<span className="font-medium text-foreground">{deleteTarget?.title}</span>"? This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
