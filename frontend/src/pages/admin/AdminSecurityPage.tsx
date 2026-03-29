import { useState } from "react";
import {
  Shield, Loader2, Search, Ban, Unlock, RefreshCw,
  CheckCircle2, XCircle, UserPlus, AlertTriangle, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchIPLogs, fetchBannedIPs, banIP, unbanIP,
  type IPLogEntry, type BannedIP,
} from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const actionConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  login_ok:   { label: "Login OK",   color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  login_fail: { label: "Login Failed", color: "bg-red-500/10 text-red-400 border-red-500/20",          icon: XCircle      },
  register:   { label: "Register",   color: "bg-blue-500/10 text-blue-400 border-blue-500/20",          icon: UserPlus     },
};

const AdminSecurityPage = () => {
  const queryClient = useQueryClient();
  const [logSearch, setLogSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  // Quick-ban form
  const [banIpInput, setBanIpInput] = useState("");
  const [banReason, setBanReason] = useState("");

  // Quick-ban from log
  const [banningIp, setBanningIp] = useState<string | null>(null);
  const [inlineReason, setInlineReason] = useState("");

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["ip-logs", appliedSearch],
    queryFn: () => fetchIPLogs(appliedSearch || undefined),
  });

  const { data: bannedIPs = [], isLoading: bansLoading } = useQuery({
    queryKey: ["banned-ips"],
    queryFn: fetchBannedIPs,
  });

  const bannedSet = new Set(bannedIPs.map((b) => b.ip_address));

  const banMutation = useMutation({
    mutationFn: ({ ip, reason }: { ip: string; reason: string }) => banIP(ip, reason),
    onSuccess: (_, vars) => {
      toast.success(`${vars.ip} banned.`);
      queryClient.invalidateQueries({ queryKey: ["banned-ips"] });
      queryClient.invalidateQueries({ queryKey: ["ip-logs"] });
      setBanIpInput(""); setBanReason("");
      setBanningIp(null); setInlineReason("");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to ban IP."),
  });

  const unbanMutation = useMutation({
    mutationFn: (id: number) => unbanIP(id),
    onSuccess: (_, id) => {
      const ip = bannedIPs.find((b) => b.id === id)?.ip_address;
      toast.success(`${ip ?? "IP"} unbanned.`);
      queryClient.invalidateQueries({ queryKey: ["banned-ips"] });
      queryClient.invalidateQueries({ queryKey: ["ip-logs"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to unban IP."),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 md:p-8 relative bg-primary">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/[0.03] -translate-y-1/3 translate-x-1/4" />
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Security</h1>
                <p className="text-white/50 text-sm mt-0.5">
                  {bannedIPs.length} banned IP{bannedIPs.length !== 1 ? "s" : ""} &middot; {logs.length} log entries
                </p>
              </div>
            </div>
            <Button
              className="bg-white/10 hover:bg-white/20 text-white border-0"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["ip-logs"] });
                queryClient.invalidateQueries({ queryKey: ["banned-ips"] });
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col — Banned IPs + quick-ban form */}
        <div className="space-y-4">
          {/* Quick-ban form */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Ban className="h-4 w-4 text-red-500" />
              </div>
              <h2 className="text-sm font-bold text-foreground">Ban an IP</h2>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">IP Address</Label>
              <Input
                value={banIpInput}
                onChange={(e) => setBanIpInput(e.target.value)}
                placeholder="e.g. 192.168.1.1"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Reason <span className="font-normal">(optional)</span></Label>
              <Input
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="e.g. Brute force, spam..."
              />
            </div>
            <Button
              className="w-full bg-red-600 hover:bg-red-700 text-white"
              disabled={!banIpInput.trim() || banMutation.isPending}
              onClick={() => banMutation.mutate({ ip: banIpInput.trim(), reason: banReason.trim() })}
            >
              {banMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <Ban className="h-4 w-4 mr-2" />}
              Ban IP
            </Button>
          </div>

          {/* Banned IPs list */}
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border/30 flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">Banned IPs</h2>
              <span className="text-xs text-muted-foreground">{bannedIPs.length} total</span>
            </div>
            {bansLoading ? (
              <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : bannedIPs.length === 0 ? (
              <div className="py-10 text-center">
                <Shield className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">No banned IPs yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {bannedIPs.map((ban) => (
                  <div key={ban.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono font-bold text-red-500">{ban.ip_address}</p>
                      {ban.reason && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{ban.reason}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        by {ban.banned_by} &middot; {new Date(ban.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground flex-shrink-0"
                      disabled={unbanMutation.isPending}
                      onClick={() => unbanMutation.mutate(ban.id)}
                    >
                      <Unlock className="h-3.5 w-3.5 mr-1" /> Unban
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right col — IP activity log */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="flex-1 glass-card p-1.5">
              <div className="flex items-center gap-3 px-4 py-2">
                <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Filter by IP address..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setAppliedSearch(logSearch)}
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full font-mono"
                />
                {logSearch && (
                  <button onClick={() => { setLogSearch(""); setAppliedSearch(""); }} className="text-xs text-muted-foreground hover:text-foreground">
                    Clear
                  </button>
                )}
              </div>
            </div>
            <Button variant="outline" onClick={() => setAppliedSearch(logSearch)} className="h-11">
              Search
            </Button>
          </div>

          {/* Log table */}
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border/30">
              <h2 className="text-sm font-bold text-foreground">IP Activity Log</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Login attempts and registrations — newest first</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3">IP Address</th>
                    <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3">Action</th>
                    <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3">User</th>
                    <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3 hidden lg:table-cell">Time</th>
                    <th className="text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {logsLoading ? (
                    <tr><td colSpan={5} className="px-5 py-10 text-center"><Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" /></td></tr>
                  ) : logs.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">No log entries yet.</td></tr>
                  ) : (
                    (logs as IPLogEntry[]).map((log, idx) => {
                      const cfg = actionConfig[log.action] ?? actionConfig.login_fail;
                      const Icon = cfg.icon;
                      const alreadyBanned = bannedSet.has(log.ip_address);
                      const isExpanded = banningIp === log.ip_address;
                      return (
                        <>
                          <tr
                            key={log.id}
                            className={cn(
                              "border-b border-border/20 hover:bg-muted/40 transition-colors",
                              idx % 2 === 1 && "bg-muted/20",
                              alreadyBanned && "opacity-50"
                            )}
                          >
                            <td className="px-5 py-3">
                              <span className={cn("font-mono text-xs font-bold", alreadyBanned ? "line-through text-muted-foreground" : "text-foreground")}>
                                {log.ip_address}
                              </span>
                              {alreadyBanned && (
                                <span className="ml-2 text-[10px] text-red-400 font-bold">BANNED</span>
                              )}
                            </td>
                            <td className="px-5 py-3">
                              <Badge variant="outline" className={cn("text-[10px] font-bold gap-1", cfg.color)}>
                                <Icon className="h-3 w-3" /> {cfg.label}
                              </Badge>
                            </td>
                            <td className="px-5 py-3">
                              {log.user_email
                                ? <span className="text-xs text-foreground">{log.user_email}</span>
                                : <span className="text-xs text-muted-foreground/40">—</span>}
                            </td>
                            <td className="px-5 py-3 hidden lg:table-cell">
                              <p className="text-xs text-muted-foreground">
                                {new Date(log.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                              </p>
                              <p className="text-[10px] text-muted-foreground/60">
                                {new Date(log.created_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </td>
                            <td className="px-5 py-3 text-right">
                              {alreadyBanned ? (
                                <span className="text-[10px] text-red-400 font-semibold">Banned</span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-[10px] h-7 px-2 text-red-500 hover:text-red-500 hover:bg-red-500/10"
                                  onClick={() => {
                                    if (isExpanded) { setBanningIp(null); setInlineReason(""); }
                                    else { setBanningIp(log.ip_address); setInlineReason(""); }
                                  }}
                                >
                                  <Ban className="h-3 w-3 mr-1" /> Ban
                                </Button>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${log.id}-ban`} className="bg-red-500/5 border-b border-red-500/10">
                              <td colSpan={5} className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                                  <p className="text-xs font-semibold text-red-500 mr-2">Ban {log.ip_address}</p>
                                  <input
                                    type="text"
                                    value={inlineReason}
                                    onChange={(e) => setInlineReason(e.target.value)}
                                    placeholder="Reason (optional)"
                                    className="flex-1 text-xs bg-background border border-border rounded-lg px-3 py-1.5 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-red-500/40"
                                  />
                                  <Button
                                    size="sm"
                                    className="bg-red-600 hover:bg-red-700 text-white text-xs h-8 flex-shrink-0"
                                    disabled={banMutation.isPending}
                                    onClick={() => banMutation.mutate({ ip: log.ip_address, reason: inlineReason.trim() })}
                                  >
                                    {banMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm Ban"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs h-8 flex-shrink-0"
                                    onClick={() => { setBanningIp(null); setInlineReason(""); }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSecurityPage;
