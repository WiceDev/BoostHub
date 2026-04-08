import { useQuery } from "@tanstack/react-query";
import { fetchMySubmissions, type PendingSubmission } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  approved: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
};

export default function AdminMySubmissionsPage() {
  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["my-submissions"],
    queryFn: fetchMySubmissions,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Submissions</h1>
        <p className="text-muted-foreground text-sm mt-1">Track the status of your submitted services</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mb-3 opacity-40" />
            <p>You haven't submitted anything yet.</p>
            <p className="text-sm mt-1">When you add a new service, it will appear here for tracking.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub: PendingSubmission) => (
            <Card key={sub.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    #{sub.id} — {sub.submission_type_display}
                  </CardTitle>
                  <Badge variant="outline" className={statusColors[sub.status] || ""}>
                    {sub.status_display}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Submitted on {new Date(sub.created_at).toLocaleDateString()}
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

                {sub.review_note && (
                  <p className="text-sm text-muted-foreground border-t pt-2">
                    <strong>Review note:</strong> {sub.review_note}
                  </p>
                )}

                {sub.reviewed_by && (
                  <p className="text-xs text-muted-foreground">
                    Reviewed by {sub.reviewed_by.email} on {new Date(sub.updated_at).toLocaleDateString()}
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
