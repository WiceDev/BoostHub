import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchServiceAdmins, createServiceAdmin, updateServiceAdmin, deleteServiceAdmin,
  type ServiceAdmin,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, Shield, Trash2, Pencil, Loader2, Users } from "lucide-react";

const ALL_PERMISSIONS = [
  { key: "manage_boosting", label: "Manage Boosting Services" },
  { key: "manage_numbers", label: "Manage Verification Numbers" },
  { key: "manage_accounts", label: "Manage Social Media Accounts" },
  { key: "manage_gifts", label: "Manage Gift Items" },
  { key: "manage_webdev", label: "Manage Web Dev Portfolio" },
];

export default function AdminServiceAdminsPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editAdmin, setEditAdmin] = useState<ServiceAdmin | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceAdmin | null>(null);
  const [loading, setLoading] = useState(false);

  // Create form
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [perms, setPerms] = useState<string[]>([]);

  // Edit form
  const [editPerms, setEditPerms] = useState<string[]>([]);

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ["service-admins"],
    queryFn: fetchServiceAdmins,
  });

  const resetCreateForm = () => {
    setEmail(""); setUsername(""); setFirstName(""); setLastName(""); setPassword(""); setPerms([]);
  };

  const togglePerm = (list: string[], key: string) =>
    list.includes(key) ? list.filter((p) => p !== key) : [...list, key];

  const handleCreate = async () => {
    if (!email || !username || !password) {
      toast.error("Email, username, and password are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await createServiceAdmin({ email, username, first_name: firstName, last_name: lastName, password, admin_permissions: perms });
      toast.success(res.detail);
      setCreateOpen(false);
      resetCreateForm();
      queryClient.invalidateQueries({ queryKey: ["service-admins"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create service admin.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editAdmin) return;
    setLoading(true);
    try {
      const res = await updateServiceAdmin(editAdmin.id, { admin_permissions: editPerms });
      toast.success(res.detail);
      setEditAdmin(null);
      queryClient.invalidateQueries({ queryKey: ["service-admins"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      const res = await deleteServiceAdmin(deleteTarget.id);
      toast.success(res.detail);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["service-admins"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to remove admin.");
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser?.is_super_admin) {
    return <div className="p-8 text-center text-muted-foreground">Only the super admin can manage service admins.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 md:p-8 relative bg-primary">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/[0.03] -translate-y-1/3 translate-x-1/4" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Service Admins</h1>
                <p className="text-white/50 text-sm mt-0.5">Create and manage sub-admin accounts with limited permissions</p>
              </div>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="bg-white/10 hover:bg-white/20 text-white border-0">
              <UserPlus className="h-4 w-4 mr-2" /> Add Service Admin
            </Button>
          </div>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : admins.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mb-3 opacity-40" />
            <p>No service admins yet.</p>
            <p className="text-sm mt-1">Click "Add Service Admin" to create one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {admins.map((admin) => (
            <Card key={admin.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{admin.full_name || admin.username}</h3>
                      <p className="text-sm text-muted-foreground">{admin.email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Joined {new Date(admin.date_joined).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setEditAdmin(admin); setEditPerms(admin.admin_permissions || []); }}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit Permissions
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteTarget(admin)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(admin.admin_permissions || []).length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No permissions assigned</span>
                  ) : (
                    admin.admin_permissions.map((p) => {
                      const perm = ALL_PERMISSIONS.find((ap) => ap.key === p);
                      return (
                        <Badge key={p} variant="secondary" className="text-xs">
                          {perm?.label || p}
                        </Badge>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Create Service Admin
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">First Name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Last Name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Username *</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="johndoe" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Password *</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Permissions</Label>
              <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/30">
                {ALL_PERMISSIONS.map((p) => (
                  <label key={p.key} className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={perms.includes(p.key)}
                      onCheckedChange={() => setPerms(togglePerm(perms, p.key))}
                    />
                    <span className="text-sm">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetCreateForm(); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={loading || !email || !username || !password}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Dialog */}
      <Dialog open={!!editAdmin} onOpenChange={(open) => { if (!open) setEditAdmin(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Edit Permissions
            </DialogTitle>
          </DialogHeader>
          {editAdmin && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Editing permissions for <strong>{editAdmin.full_name || editAdmin.email}</strong>
              </p>
              <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/30">
                {ALL_PERMISSIONS.map((p) => (
                  <label key={p.key} className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={editPerms.includes(p.key)}
                      onCheckedChange={() => setEditPerms(togglePerm(editPerms, p.key))}
                    />
                    <span className="text-sm">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAdmin(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Service Admin</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will demote <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong> to a regular user.
            Their account won't be deleted — they just lose admin access.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Remove Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
