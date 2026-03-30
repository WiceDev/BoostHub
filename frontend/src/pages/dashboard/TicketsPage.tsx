import { useState } from "react";
import {
  MessageSquare, Plus, Loader2, CheckCircle2,
  Clock, AlertCircle, ChevronDown, ChevronUp, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTickets, createTicket, ApiError, type Ticket } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open:        { label: "Open",        color: "bg-primary/10 text-primary border-primary/20",          icon: Clock },
  in_progress: { label: "In Progress", color: "bg-amber-500/10 text-amber-500 border-amber-500/20",    icon: AlertCircle },
  resolved:    { label: "Resolved",    color: "bg-success/10 text-success border-success/20",           icon: CheckCircle2 },
};

const TicketsPage = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["tickets"],
    queryFn: fetchTickets,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createTicket({ subject, message, order_number: orderNumber || undefined });
      toast.success("Ticket submitted! We'll get back to you shortly.");
      setSubject("");
      setMessage("");
      setOrderNumber("");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to submit ticket.");
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-t-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-blue-600/10" />
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 header-diamond-pattern pointer-events-none" />
        <div className="p-6 md:p-8 relative z-20 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Support Tickets</h1>
              <p className="text-muted-foreground text-sm">Submit an issue and we'll resolve it as soon as possible</p>
            </div>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Ticket
          </Button>
        </div>
        <div className="hidden sm:block absolute bottom-0 inset-x-0 h-20 bg-gradient-to-b from-transparent to-background pointer-events-none" />
      </div>

      {/* New Ticket Form */}
      {showForm && (
        <div className="glass-card p-6 sm:p-8 space-y-5">
          <h2 className="text-base font-bold text-foreground">Submit a New Ticket</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Subject <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Briefly describe your issue"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Order Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  placeholder="e.g. 1042"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Message <span className="text-destructive">*</span></Label>
              <textarea
                placeholder="Describe your problem in detail..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit Ticket
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Tickets List */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">My Tickets</h2>
          {!isLoading && (
            <span className="text-xs text-muted-foreground">{tickets.length} total</span>
          )}
        </div>

        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-16 text-center">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-foreground font-medium mb-1">No tickets yet</p>
            <p className="text-sm text-muted-foreground">Click "New Ticket" to submit a support request.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {tickets.map((ticket: Ticket) => {
              const cfg = statusConfig[ticket.status] || statusConfig.open;
              const StatusIcon = cfg.icon;
              const isExpanded = expandedId === ticket.id;

              return (
                <div key={ticket.id} className="hover:bg-muted/20 transition-colors">
                  {/* Ticket header row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                    className="w-full px-6 py-4 flex items-start gap-4 text-left"
                  >
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MessageSquare className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-foreground truncate">{ticket.subject}</p>
                        {ticket.order_number && (
                          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                            Order #{ticket.order_number}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ticket.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
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

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-6 pb-5 space-y-4">
                      <div className="rounded-xl bg-muted/30 border border-border/30 p-4">
                        <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Your Message</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.message}</p>
                      </div>

                      {ticket.admin_response ? (
                        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                          <p className="text-xs font-bold text-primary uppercase mb-2">Support Response</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.admin_response}</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>Awaiting response from our support team.</span>
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

export default TicketsPage;
