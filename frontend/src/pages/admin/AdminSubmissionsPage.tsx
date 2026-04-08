import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPendingSubmissions, reviewSubmission, type PendingSubmission } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, FileText } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  approved: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
};

export default function AdminSubmissionsPage() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["admin-submissions", statusFilter],
    queryFn: () => fetchPendingSubmissions(statusFilter),
  });

  const handleReview = async (id: number, action: "approve" | "reject") => {
    setLoading(true);
    try {
      const res = await reviewSubmission(id, action, reviewNote);
      toast.success(res.detail);
      setReviewingId(null);
      setReviewNote("");
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to review submission");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pending Approvals</h1>
        <p className="text-muted-foreground text-sm mt-1">Review submissions from service admins</p>
      </div>

      <div className="flex gap-2">
        {["pending", "approved", "rejected", ""].map((s) => (
          <Button
            key={s || "all"}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s || "All"}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mb-3 opacity-40" />
            <p>No submissions found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub: PendingSubmission) => (
            <Card key={sub.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    #{sub.id} — {sub.submission_type_display}
                  </CardTitle>
                  <Badge variant="outline" className={statusColors[sub.status] || ""}>
                    {sub.status_display}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Submitted by <strong>{sub.submitted_by.full_name}</strong> ({sub.submitted_by.email}) on{" "}
                  {new Date(sub.created_at).toLocaleDateString()}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-muted/50 rounded-lg p-4 text-sm">
                  <p className="font-medium mb-2">Submitted Data:</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    {Object.entries(sub.data).map(([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground">{key}:</span>
                        <span className="font-medium truncate ml-2">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {sub.status === "pending" && (
                  <>
                    {reviewingId === sub.id ? (
                      <div className="space-y-3 border-t pt-3">
                        <Textarea
                          placeholder="Review note (optional)"
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleReview(sub.id, "approve")}
                            disabled={loading}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReview(sub.id, "reject")}
                            disabled={loading}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setReviewingId(null); setReviewNote(""); }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setReviewingId(sub.id)}>
                        <Clock className="h-4 w-4 mr-1" /> Review
                      </Button>
                    )}
                  </>
                )}

                {sub.review_note && (
                  <p className="text-sm text-muted-foreground border-t pt-2">
                    <strong>Review note:</strong> {sub.review_note}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
