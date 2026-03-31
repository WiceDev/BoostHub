import { useState, useMemo } from "react";
import { Database, Search, RefreshCw, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCatalogBoostingServices, toggleCatalogBoostingService,
  fetchCatalogSMSCountries, toggleCatalogSMSCountry,
  fetchCatalogSMSServices, toggleCatalogSMSService,
  type CatalogBoostingService, type CatalogSMSCountry, type CatalogSMSService,
} from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tab = "boosting" | "sms-countries" | "sms-services";

const PLATFORMS = ["All", "Instagram", "TikTok", "Twitter", "YouTube", "Facebook",
  "Telegram", "Spotify", "LinkedIn", "Threads", "Snapchat", "Discord", "Twitch",
  "SoundCloud", "Pinterest", "Reddit", "Other"];

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

function BoostingTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("All");
  const [platformOpen, setPlatformOpen] = useState(false);
  const [toggling, setToggling] = useState<Set<number>>(new Set());

  const { data: services = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-catalog-boosting"],
    queryFn: () => fetchCatalogBoostingServices(),
  });

  const mutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      toggleCatalogBoostingService(id, is_active),
    onMutate: ({ id }) => setToggling(prev => new Set(prev).add(id)),
    onSuccess: (data, { is_active }) => {
      queryClient.setQueryData<CatalogBoostingService[]>(["admin-catalog-boosting"], (old = []) =>
        old.map(s => s.id === data.id ? { ...s, is_active: data.is_active } : s)
      );
    },
    onError: (_, { id }) => toast.error("Failed to update service."),
    onSettled: (_, __, { id }) => setToggling(prev => { const n = new Set(prev); n.delete(id); return n; }),
  });

  const filtered = useMemo(() => {
    let list = services;
    if (platform !== "All") list = list.filter(s => s.platform === platform);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
    }
    return list;
  }, [services, platform, search]);

  const activeCount = services.filter(s => s.is_active).length;
  const platforms = useMemo(() => {
    const set = new Set(services.map(s => s.platform));
    return ["All", ...PLATFORMS.filter(p => p !== "All" && set.has(p))];
  }, [services]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search services…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="relative">
          <button
            onClick={() => setPlatformOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground min-w-[140px] justify-between"
          >
            <span>{platform}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          {platformOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-auto max-h-52">
              {platforms.map(p => (
                <button
                  key={p}
                  onMouseDown={e => { e.preventDefault(); setPlatform(p); setPlatformOpen(false); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm hover:bg-muted/50",
                    platform === p && "bg-primary/10 text-primary"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4 mr-1", isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        {activeCount} of {services.length} active · showing {filtered.length}
      </div>

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

      <div className="text-xs text-muted-foreground">
        {activeCount} of {countries.length} active · showing {filtered.length}
      </div>

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

      <div className="text-xs text-muted-foreground">
        {activeCount} of {services.length} active · showing {filtered.length}
      </div>

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
  const [tab, setTab] = useState<Tab>("boosting");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Database className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Service Catalog</h1>
          <p className="text-sm text-muted-foreground">Toggle which services are visible to users. Data synced automatically via Celery.</p>
        </div>
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
