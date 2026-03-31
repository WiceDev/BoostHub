import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAPILogs, clearAPILogs, APICallLog } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  RefreshCw,
  Eye,
  Activity,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PROVIDERS = [
  { value: "all", label: "All Providers" },
  { value: "rss", label: "RSS SMM Panel" },
  { value: "smspool", label: "SMSPool" },
  { value: "paystack", label: "Paystack" },
  { value: "other", label: "Other" },
];

const SUCCESS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "true", label: "Success" },
  { value: "false", label: "Failed" },
];

function LogDetailDialog({ log, onClose }: { log: APICallLog | null; onClose: () => void }) {
  if (!log) return null;
  return (
    <Dialog open={!!log} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {log.success ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            [{log.provider.toUpperCase()}] {log.action}
          </DialogTitle>
          <DialogDescription>{log.endpoint}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Status</p>
              <Badge
                variant="outline"
                className={log.success
                  ? "bg-success/10 text-success border-success/20"
                  : "bg-destructive/10 text-destructive border-destructive/20"}
              >
                {log.success ? "Success" : "Failed"}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">HTTP Status</p>
              <p className="font-mono">{log.http_status ?? "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Duration</p>
              <p className="font-mono">{log.duration_ms != null ? `${log.duration_ms}ms` : "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Triggered By</p>
              <p className="font-mono text-xs">{log.triggered_by || "—"}</p>
            </div>
            <div className="space-y-1 col-span-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Timestamp</p>
              <p className="font-mono text-xs">{new Date(log.created_at).toLocaleString("en-NG")}</p>
            </div>
          </div>

          {log.error_message && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Error</p>
              <p className="bg-destructive/10 text-destructive rounded p-2 text-xs font-mono break-all">
                {log.error_message}
              </p>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Request Payload</p>
            <pre className="bg-muted rounded p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(log.request_data, null, 2)}
            </pre>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Response</p>
            <pre className="bg-muted rounded p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-48">
              {log.response_data != null ? JSON.stringify(log.response_data, null, 2) : "null"}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminApiLogsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [provider, setProvider] = useState("all");
  const [successFilter, setSuccessFilter] = useState("all");
  const [actionSearch, setActionSearch] = useState("");
  const [triggeredBySearch, setTriggeredBySearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<APICallLog | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  const queryKey = ["admin-api-logs", provider, successFilter, actionSearch, triggeredBySearch, page];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () =>
      fetchAPILogs({
        provider: provider !== "all" ? provider : undefined,
        success: successFilter === "all" ? undefined : successFilter === "true",
        action: actionSearch || undefined,
        triggered_by: triggeredBySearch || undefined,
        page,
        page_size: 50,
      }),
    staleTime: 30_000,
  });

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin-api-logs"] });
  }, [queryClient]);

  const handleClear = async () => {
    setClearing(true);
    try {
      const res = await clearAPILogs(provider !== "all" ? provider : undefined);
      toast({ title: "Cleared", description: res.detail });
      queryClient.invalidateQueries({ queryKey: ["admin-api-logs"] });
    } catch {
      toast({ title: "Error", description: "Failed to clear logs.", variant: "destructive" });
    } finally {
      setClearing(false);
      setClearConfirm(false);
    }
  };

  const resetFilters = () => {
    setProvider("all");
    setSuccessFilter("all");
    setActionSearch("");
    setTriggeredBySearch("");
    setPage(1);
  };

  const summary = data?.summary;
  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">API Call Logs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All outbound calls to external APIs (RSS, SMSPool, Paystack)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setClearConfirm(true)}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Clear Logs
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Calls", value: summary?.total, icon: Activity, color: "text-primary" },
          { label: "Successful", value: summary?.success, icon: CheckCircle2, color: "text-success" },
          { label: "Failed", value: summary?.failed, icon: XCircle, color: "text-destructive" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold text-foreground">
                {value != null ? value.toLocaleString() : <Skeleton className="h-6 w-12 inline-block" />}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[140px]">
          <p className="text-xs text-muted-foreground mb-1">Provider</p>
          <Select value={provider} onValueChange={(v) => { setProvider(v); setPage(1); }}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[120px]">
          <p className="text-xs text-muted-foreground mb-1">Result</p>
          <Select value={successFilter} onValueChange={(v) => { setSuccessFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUCCESS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[160px]">
          <p className="text-xs text-muted-foreground mb-1">Action</p>
          <Input
            className="h-9 text-sm"
            placeholder="e.g. place_order"
            value={actionSearch}
            onChange={(e) => { setActionSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div className="flex-1 min-w-[160px]">
          <p className="text-xs text-muted-foreground mb-1">Triggered By</p>
          <Input
            className="h-9 text-sm"
            placeholder="e.g. user:42"
            value={triggeredBySearch}
            onChange={(e) => { setTriggeredBySearch(e.target.value); setPage(1); }}
          />
        </div>

        {(provider !== "all" || successFilter !== "all" || actionSearch || triggeredBySearch) && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9">
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                {["Time", "Provider", "Action", "Status", "HTTP", "Duration", "Triggered By", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !data?.results.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    No API calls logged yet. Calls are recorded automatically when external APIs are used.
                  </td>
                </tr>
              ) : (
                data.results.map((log, index) => (
                  <tr
                    key={log.id}
                    className={`border-b border-border/30 hover:bg-muted/30 transition-colors ${index % 2 === 1 ? "bg-muted/10" : ""}`}
                  >
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("en-NG", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs font-mono uppercase">
                        {log.provider}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground max-w-[200px]">
                      <p className="truncate">{log.action}</p>
                    </td>
                    <td className="px-4 py-3">
                      {log.success ? (
                        <span className="flex items-center gap-1 text-success text-xs font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" /> OK
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-destructive text-xs font-semibold">
                          <XCircle className="h-3.5 w-3.5" /> FAIL
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                      {log.http_status ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {log.duration_ms != null ? `${log.duration_ms}ms` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px]">
                      <p className="truncate">{log.triggered_by || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > data.page_size && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * data.page_size + 1}–{Math.min(page * data.page_size, data.total)} of {data.total.toLocaleString()} entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <LogDetailDialog log={selectedLog} onClose={() => setSelectedLog(null)} />

      {/* Clear confirm dialog */}
      <Dialog open={clearConfirm} onOpenChange={setClearConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear API Logs</DialogTitle>
            <DialogDescription>
              {provider !== "all"
                ? `Delete all logs for provider "${provider}"?`
                : "Delete ALL API call logs? This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setClearConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleClear} disabled={clearing}>
              {clearing ? "Clearing…" : "Clear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
