import { useState } from "react";
import {
  MessageSquare, Loader2, CheckCircle2, Clock,
  AlertCircle, ChevronDown, ChevronUp, Send, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAdminTickets, updateAdminTicket, ApiError, type Ticket } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open:        { label: "Open",        color: "bg-primary/10 text-primary border-primary/20",        icon: Clock },
  in_progress: { label: "In Progress", color: "bg-amber-500/10 text-amber-500 border-amber-500/20",  icon: AlertCircle },
  resolved:    { label: "Resolved",    color: "bg-success/10 text-success border-success/20",         icon: CheckCircle2 },
};

const STATUS_OPTIONS = ["all", "open", "in_progress", "resolved"];

const AdminTicketsPage = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [responseText, setResponseText] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["admin-tickets", statusFilter],
    queryFn: () => fetchAdminTickets(statusFilter === "all" ? undefined : statusFilter),
  });

  const handleSave = async (ticket: Ticket) => {
    setSaving(ticket.id);
    try {
      await updateAdminTicket(ticket.id, {
        admin_response: responseText[ticket.id] ?? ticket.admin_response,
        status: ticket.status === "open" ? "in_progress" : ticket.status,
      });
      toast.success("Response saved.");
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save.");
    }
    setSaving(null);
  };

  const handleResolve = async (ticket: Ticket) => {
    setSaving(ticket.id);
    try {
      await updateAdminTicket(ticket.id, { status: "resolved" });
      toast.success("Ticket marked as resolved.");
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update.");
    }
    setSaving(null);
  };

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-t-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-blue-600/10" />
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute inset-0 header-diamond-pattern pointer-events-none" />
        <div className="p-6 md:p-8 relative z-20 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Support Tickets</h1>
              <p className="text-muted-foreground text-sm">
                {openCount > 0 && <span className="text-primary font-semibold">{openCount} open</span>}
                {openCount > 0 && inProgressCount > 0 && " · "}
                {inProgressCount > 0 && <span className="text-amber-500 font-semibold">{inProgressCount} in progress</span>}
                {openCount === 0 && inProgressCount === 0 && "All tickets resolved"}
              </p>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-b from-transparent to-background pointer-events-none" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 bg-card border border-border/50 rounded-xl p-1.5 w-fit">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize",
              statusFilter === s
                ? "bg-primary text-white shadow-md"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s === "all" ? "All" : s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Tickets list */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Tickets</h2>
          {!isLoading && (
            <span className="text-xs text-muted-foreground">{tickets.length} tickets</span>
          )}
        </div>

        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-16 text-center">
            <Filter className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-foreground font-medium mb-1">No tickets</p>
            <p className="text-sm text-muted-foreground">No tickets match the current filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {tickets.map((ticket: Ticket) => {
              const cfg = statusConfig[ticket.status] || statusConfig.open;
              const StatusIcon = cfg.icon;
              const isExpanded = expandedId === ticket.id;

              return (
                <div key={ticket.id} className="hover:bg-muted/20 transition-colors">
                  {/* Row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                    className="w-full px-6 py-4 flex items-start gap-4 text-left"
                  >
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MessageSquare className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-foreground">{ticket.subject}</p>
                        {ticket.order_number && (
                          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                            Order #{ticket.order_number}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ticket.user_name} · {ticket.user_email}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(ticket.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge variant="outline" className={cn("text-xs font-semibold gap-1", cfg.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                      {isExpanded
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Expanded */}
                  {isExpanded && (
                    <div className="px-6 pb-6 space-y-4">
                      {/* User message */}
                      <div className="rounded-xl bg-muted/30 border border-border/30 p-4">
                        <p className="text-xs font-bold text-muted-foreground uppercase mb-2">User Message</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.message}</p>
                      </div>

                      {/* Existing response */}
                      {ticket.admin_response && (
                        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                          <p className="text-xs font-bold text-primary uppercase mb-2">Current Response</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.admin_response}</p>
                        </div>
                      )}

                      {/* Response form — hidden for resolved tickets */}
                      {ticket.status !== "resolved" && (
                        <div className="space-y-3">
                          <p className="text-xs font-bold text-muted-foreground uppercase">
                            {ticket.admin_response ? "Update Response" : "Write Response"}
                          </p>
                          <textarea
                            rows={4}
                            placeholder="Type your response to the user..."
                            value={responseText[ticket.id] ?? ticket.admin_response}
                            onChange={(e) => setResponseText((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                            className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                          />
                          <div className="flex gap-3">
                            <Button
                              size="sm"
                              onClick={() => handleSave(ticket)}
                              disabled={saving === ticket.id}
                              className="gap-2"
                            >
                              {saving === ticket.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                              Save Response
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResolve(ticket)}
                              disabled={saving === ticket.id}
                              className="gap-2 text-success border-success/30 hover:bg-success/5"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Mark Resolved
                            </Button>
                          </div>
                        </div>
                      )}

                      {ticket.status === "resolved" && (
                        <div className="flex items-center gap-2 text-sm text-success">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="font-medium">This ticket has been resolved.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTicketsPage;
