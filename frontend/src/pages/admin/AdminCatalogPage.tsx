import { useState, useMemo } from "react";
import { Database, Search, RefreshCw, Loader2, ChevronDown, RotateCcw, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCatalogBoostingServices, toggleCatalogBoostingService,
  fetchCatalogSMSCountries, toggleCatalogSMSCountry,
  fetchCatalogSMSServices, toggleCatalogSMSService,
  bulkToggleCatalogBoostingServices,
  bulkToggleCatalogSMSCountries,
  bulkToggleCatalogSMSServices,
  syncCatalog,
  type CatalogBoostingService, type CatalogSMSCountry, type CatalogSMSService,
} from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tab = "boosting" | "sms-countries" | "sms-services";

const PLATFORMS = ["All", "Instagram", "TikTok", "Twitter", "YouTube", "Facebook",
  "Telegram", "Spotify", "LinkedIn", "Threads", "Snapchat", "Discord", "Twitch",
  "SoundCloud", "Pinterest", "Reddit", "Other"];

// ── Bulk confirm dialog ────────────────────────────────────────────────────

interface BulkConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  action: 'activate' | 'deactivate';
  count: number;
  loading: boolean;
}

function BulkConfirmDialog({ open, onClose, onConfirm, action, count, loading }: BulkConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{action === 'activate' ? 'Activate All?' : 'Deactivate All?'}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to <strong>{action}</strong> all <strong>{count}</strong> currently visible service{count !== 1 ? 's' : ''}?
          {action === 'activate'
            ? ' They will become visible to users and be added to Manage Services (for boosting).'
            : ' They will be hidden from users immediately.'}
        </p>
        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            variant={action === 'deactivate' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Yes, {action} all
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Generic toggle switch ──────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
        checked ? "bg-primary" : "bg-muted",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span className={cn(
        "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
        checked ? "translate-x-5" : "translate-x-0.5"
      )} />
    </button>
  );
}

// ── Boosting tab ──────────────────────────────────────────────────────────

function FilterDropdown({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground min-w-[140px] justify-between"
      >
        <span className="truncate">{value}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-auto max-h-52">
          {options.map(opt => (
            <button
              key={opt}
              onMouseDown={e => { e.preventDefault(); onChange(opt); setOpen(false); }}
              className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50", value === opt && "bg-primary/10 text-primary")}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BoostingTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("All");
  const [category, setCategory] = useState("All");
  const [toggling, setToggling] = useState<Set<number>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<'activate' | 'deactivate' | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const { data: services = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-catalog-boosting"],
    queryFn: () => fetchCatalogBoostingServices(),
  });

  const mutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      toggleCatalogBoostingService(id, is_active),
    onMutate: ({ id }) => setToggling(prev => new Set(prev).add(id)),
    onSuccess: (data) => {
      queryClient.setQueryData<CatalogBoostingService[]>(["admin-catalog-boosting"], (old = []) =>
        old.map(s => s.id === data.id ? { ...s, is_active: data.is_active } : s)
      );
    },
    onError: () => toast.error("Failed to update service."),
    onSettled: (_, __, { id }) => setToggling(prev => { const n = new Set(prev); n.delete(id); return n; }),
  });

  // Available platforms (from data)
  const platforms = useMemo(() => {
    const set = new Set(services.map(s => s.platform));
    return ["All", ...PLATFORMS.filter(p => p !== "All" && set.has(p))];
  }, [services]);

  // Available categories — filtered by selected platform
  const categories = useMemo(() => {
    const base = platform === "All" ? services : services.filter(s => s.platform === platform);
    const set = new Set(base.map(s => s.category).filter(Boolean));
    return ["All", ...[...set].sort()];
  }, [services, platform]);

  const handlePlatformChange = (p: string) => { setPlatform(p); setCategory("All"); };

  const filtered = useMemo(() => {
    let list = services;
    if (platform !== "All") list = list.filter(s => s.platform === platform);
    if (category !== "All") list = list.filter(s => s.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q));
    }
    return list;
  }, [services, platform, category, search]);

  const activeCount = services.filter(s => s.is_active).length;

  const handleBulkConfirm = async () => {
    if (!bulkConfirm) return;
    setBulkLoading(true);
    const is_active = bulkConfirm === 'activate';
    const ids = filtered.map(s => s.id);
    try {
      await bulkToggleCatalogBoostingServices(ids, is_active);
      queryClient.setQueryData<CatalogBoostingService[]>(["admin-catalog-boosting"], (old = []) =>
        old.map(s => ids.includes(s.id) ? { ...s, is_active } : s)
      );
      toast.success(`${filtered.length} services ${is_active ? 'activated' : 'deactivated'}.`);
    } catch {
      toast.error('Bulk update failed.');
    } finally {
      setBulkLoading(false);
      setBulkConfirm(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search services…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <FilterDropdown value={platform} options={platforms} onChange={handlePlatformChange} />
        <FilterDropdown value={category} options={categories} onChange={setCategory} />
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4 mr-1", isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">
          {activeCount} of {services.length} active · showing {filtered.length}
        </span>
        {filtered.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setBulkConfirm('activate')} disabled={bulkLoading}>
              <CheckSquare className="h-3.5 w-3.5 mr-1.5" /> Select All ({filtered.length})
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkConfirm('deactivate')} disabled={bulkLoading}>
              <Square className="h-3.5 w-3.5 mr-1.5" /> Deselect All
            </Button>
          </div>
        )}
      </div>

      <BulkConfirmDialog
        open={!!bulkConfirm}
        onClose={() => setBulkConfirm(null)}
        onConfirm={handleBulkConfirm}
        action={bulkConfirm || 'activate'}
        count={filtered.length}
        loading={bulkLoading}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {services.length === 0 ? "No services synced yet. Run the Celery sync task first." : "No services match your search."}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Service</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Platform</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Category</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Cost/1K</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Active</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((svc, i) => (
                <tr key={svc.id} className={cn("border-t border-border", i % 2 === 0 ? "bg-card" : "bg-muted/10")}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground line-clamp-1">{svc.name}</div>
                    <div className="text-xs text-muted-foreground">#{svc.external_id}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{svc.platform}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{svc.category}</td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell text-muted-foreground">
                    ₦{Number(svc.cost_per_k_ngn).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Toggle
                      checked={svc.is_active}
                      disabled={toggling.has(svc.id)}
                      onChange={v => mutation.mutate({ id: svc.id, is_active: v })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── SMS Countries tab ─────────────────────────────────────────────────────

function SMSCountriesTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [toggling, setToggling] = useState<Set<number>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<'activate' | 'deactivate' | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const { data: countries = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-catalog-sms-countries"],
    queryFn: fetchCatalogSMSCountries,
  });

  const mutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      toggleCatalogSMSCountry(id, is_active),
    onMutate: ({ id }) => setToggling(prev => new Set(prev).add(id)),
    onSuccess: (data) => {
      queryClient.setQueryData<CatalogSMSCountry[]>(["admin-catalog-sms-countries"], (old = []) =>
        old.map(c => c.id === data.id ? { ...c, is_active: data.is_active } : c)
      );
    },
    onError: () => toast.error("Failed to update country."),
    onSettled: (_, __, { id }) => setToggling(prev => { const n = new Set(prev); n.delete(id); return n; }),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return countries;
    const q = search.toLowerCase();
    return countries.filter(c => c.name.toLowerCase().includes(q) || c.short_name.toLowerCase().includes(q));
  }, [countries, search]);

  const activeCount = countries.filter(c => c.is_active).length;

  const handleBulkConfirm = async () => {
    if (!bulkConfirm) return;
    setBulkLoading(true);
    const is_active = bulkConfirm === 'activate';
    const ids = filtered.map(c => c.id);
    try {
      await bulkToggleCatalogSMSCountries(ids, is_active);
      queryClient.setQueryData<CatalogSMSCountry[]>(["admin-catalog-sms-countries"], (old = []) =>
        old.map(c => ids.includes(c.id) ? { ...c, is_active } : c)
      );
      toast.success(`${filtered.length} countries ${is_active ? 'activated' : 'deactivated'}.`);
    } catch {
      toast.error('Bulk update failed.');
    } finally {
      setBulkLoading(false);
      setBulkConfirm(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search countries…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4 mr-1", isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">
          {activeCount} of {countries.length} active · showing {filtered.length}
        </span>
        {filtered.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setBulkConfirm('activate')} disabled={bulkLoading}>
              <CheckSquare className="h-3.5 w-3.5 mr-1.5" /> Select All ({filtered.length})
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkConfirm('deactivate')} disabled={bulkLoading}>
              <Square className="h-3.5 w-3.5 mr-1.5" /> Deselect All
            </Button>
          </div>
        )}
      </div>

      <BulkConfirmDialog
        open={!!bulkConfirm}
        onClose={() => setBulkConfirm(null)}
        onConfirm={handleBulkConfirm}
        action={bulkConfirm || 'activate'}
        count={filtered.length}
        loading={bulkLoading}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {countries.length === 0 ? "No countries synced yet." : "No countries match your search."}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Country</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Code</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Dial</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Active</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} className={cn("border-t border-border", i % 2 === 0 ? "bg-card" : "bg-muted/10")}>
                  <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{c.short_name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">+{c.dial_code}</td>
                  <td className="px-4 py-3 text-center">
                    <Toggle
                      checked={c.is_active}
                      disabled={toggling.has(c.id)}
                      onChange={v => mutation.mutate({ id: c.id, is_active: v })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── SMS Services tab ──────────────────────────────────────────────────────

function SMSServicesTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [toggling, setToggling] = useState<Set<number>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<'activate' | 'deactivate' | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const { data: services = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-catalog-sms-services"],
    queryFn: fetchCatalogSMSServices,
  });

  const mutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      toggleCatalogSMSService(id, is_active),
    onMutate: ({ id }) => setToggling(prev => new Set(prev).add(id)),
    onSuccess: (data) => {
      queryClient.setQueryData<CatalogSMSService[]>(["admin-catalog-sms-services"], (old = []) =>
        old.map(s => s.id === data.id ? { ...s, is_active: data.is_active } : s)
      );
    },
    onError: () => toast.error("Failed to update service."),
    onSettled: (_, __, { id }) => setToggling(prev => { const n = new Set(prev); n.delete(id); return n; }),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return services;
    const q = search.toLowerCase();
    return services.filter(s => s.name.toLowerCase().includes(q) || s.short_name.toLowerCase().includes(q));
  }, [services, search]);

  const activeCount = services.filter(s => s.is_active).length;

  const handleBulkConfirm = async () => {
    if (!bulkConfirm) return;
    setBulkLoading(true);
    const is_active = bulkConfirm === 'activate';
    const ids = filtered.map(s => s.id);
    try {
      await bulkToggleCatalogSMSServices(ids, is_active);
      queryClient.setQueryData<CatalogSMSService[]>(["admin-catalog-sms-services"], (old = []) =>
        old.map(s => ids.includes(s.id) ? { ...s, is_active } : s)
      );
      toast.success(`${filtered.length} services ${is_active ? 'activated' : 'deactivated'}.`);
    } catch {
      toast.error('Bulk update failed.');
    } finally {
      setBulkLoading(false);
      setBulkConfirm(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search services…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4 mr-1", isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">
          {activeCount} of {services.length} active · showing {filtered.length}
        </span>
        {filtered.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setBulkConfirm('activate')} disabled={bulkLoading}>
              <CheckSquare className="h-3.5 w-3.5 mr-1.5" /> Select All ({filtered.length})
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkConfirm('deactivate')} disabled={bulkLoading}>
              <Square className="h-3.5 w-3.5 mr-1.5" /> Deselect All
            </Button>
          </div>
        )}
      </div>

      <BulkConfirmDialog
        open={!!bulkConfirm}
        onClose={() => setBulkConfirm(null)}
        onConfirm={handleBulkConfirm}
        action={bulkConfirm || 'activate'}
        count={filtered.length}
        loading={bulkLoading}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {services.length === 0 ? "No services synced yet." : "No services match your search."}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Service</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Short Name</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Active</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id} className={cn("border-t border-border", i % 2 === 0 ? "bg-card" : "bg-muted/10")}>
                  <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{s.short_name}</td>
                  <td className="px-4 py-3 text-center">
                    <Toggle
                      checked={s.is_active}
                      disabled={toggling.has(s.id)}
                      onChange={v => mutation.mutate({ id: s.id, is_active: v })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; desc: string }[] = [
  { id: "boosting", label: "Boosting Services", desc: "RSS SMM panel" },
  { id: "sms-countries", label: "SMS Countries", desc: "SMSPool countries" },
  { id: "sms-services", label: "SMS Services", desc: "SMSPool services" },
];

const AdminCatalogPage = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("boosting");
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncCatalog('all');
      queryClient.invalidateQueries({ queryKey: ["admin-catalog-boosting"] });
      queryClient.invalidateQueries({ queryKey: ["admin-catalog-sms-countries"] });
      queryClient.invalidateQueries({ queryKey: ["admin-catalog-sms-services"] });
      const parts = Object.values(result).join(' · ');
      toast.success(`Sync complete — ${parts}`);
    } catch {
      toast.error("Sync failed. Check API credentials in Settings.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Service Catalog</h1>
            <p className="text-sm text-muted-foreground">Toggle which services are visible to users. Sync pulls fresh data from the APIs.</p>
          </div>
        </div>
        <Button onClick={handleSync} disabled={syncing} className="flex-shrink-0">
          <RotateCcw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
          {syncing ? "Syncing…" : "Sync Now"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/40 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === t.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="glass-card p-6">
        {tab === "boosting" && <BoostingTab />}
        {tab === "sms-countries" && <SMSCountriesTab />}
        {tab === "sms-services" && <SMSServicesTab />}
      </div>
    </div>
  );
};

export default AdminCatalogPage;
