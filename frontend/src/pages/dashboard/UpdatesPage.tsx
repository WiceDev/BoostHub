import { Megaphone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchAnnouncements } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const AnnouncementsPage = () => {
  const { data: announcements, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: fetchAnnouncements,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-6 w-full max-w-2xl mx-auto px-1">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-t-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-blue-600/10" />
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 header-diamond-pattern pointer-events-none" />
        <div className="p-6 md:p-8 relative z-20 flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
            <Megaphone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
            <p className="text-muted-foreground text-sm">Latest news and announcements from the team</p>
          </div>
        </div>
        <div className="hidden sm:block absolute bottom-0 inset-x-0 h-20 bg-gradient-to-b from-transparent to-background pointer-events-none" />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="glass-card p-5 space-y-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          ))}
        </div>
      ) : !announcements || announcements.length === 0 ? (
        <div className="glass-card px-5 py-16 text-center text-muted-foreground">
          <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-15" />
          <p className="text-sm font-medium">No updates yet</p>
          <p className="text-xs mt-1 opacity-60">Check back later for news and announcements</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a, idx) => (
            <div key={a.id}>
              <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-blue-600/5">
                <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                        <Megaphone className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Announcement</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString("en-US", {
                        year: "numeric", month: "long", day: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="text-base font-bold text-foreground leading-snug">{a.title}</p>
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line leading-relaxed">{a.body}</p>
                </div>
              </div>
              {idx < announcements.length - 1 && (
                <div className="flex items-center gap-3 mt-4">
                  <div className="flex-1 h-px bg-border/40" />
                  <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">Earlier</span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnouncementsPage;
