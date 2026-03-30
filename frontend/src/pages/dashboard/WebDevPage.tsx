import { MessageSquare, ExternalLink, Play, Globe, Home, ChevronRight, Code, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchWebDevPortfolio, fetchPublicSettings } from "@/lib/api";

const WebDevPage = () => {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["webdev-portfolio"],
    queryFn: fetchWebDevPortfolio,
    staleTime: 5 * 60 * 1000,
  });

  const { data: publicSettings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: fetchPublicSettings,
    staleTime: 10 * 60 * 1000,
  });

  const whatsappBase = publicSettings?.whatsapp
    ? `https://wa.me/${publicSettings.whatsapp.replace(/\D/g, "")}`
    : null;

  const handleInquire = (projectTitle: string) => {
    if (!whatsappBase) return;
    const message = encodeURIComponent(
      `Hi, I'm interested in a website similar to "${projectTitle}". I'd like to discuss the details.`
    );
    window.open(`${whatsappBase}?text=${message}`, "_blank");
  };

  const handleCustomInquire = () => {
    if (!whatsappBase) return;
    const msg = encodeURIComponent("Hi, I have a custom web development project I'd like to discuss.");
    window.open(`${whatsappBase}?text=${msg}`, "_blank");
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground transition-colors flex items-center gap-1">
          <Home className="h-3.5 w-3.5" /> Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Web Development</span>
      </div>

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-t-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-blue-600/10" />
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 header-diamond-pattern pointer-events-none" />
        <div className="p-6 md:p-8 relative z-20">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
              <Code className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Web Development</h1>
              <p className="text-muted-foreground text-sm">Browse our portfolio and inquire about building your own</p>
            </div>
          </div>
        </div>
        <div className="hidden sm:block absolute bottom-0 inset-x-0 h-20 bg-gradient-to-b from-transparent to-background pointer-events-none" />
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="glass-card p-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-3 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading portfolio...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Code className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">No portfolio items available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="glass-card overflow-hidden group">
              {/* Video / Image Preview */}
              <div className="relative h-52 sm:h-60 bg-primary/80 overflow-hidden">
                {project.image_url ? (
                  <img
                    src={project.image_url}
                    alt={project.title}
                    className="w-full h-full object-cover"
                  />
                ) : null}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />

                {/* Play button — shown if video_url is set */}
                {project.video_url && (
                  <a
                    href={project.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform cursor-pointer">
                      <Play className="h-6 w-6 text-white ml-0.5" fill="white" />
                    </div>
                  </a>
                )}

                {/* Category badge */}
                {project.category && (
                  <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm text-white text-xs font-semibold border border-white/10">
                      <Globe className="h-3 w-3" />
                      {project.category}
                    </span>
                  </div>
                )}

                {/* Browser dots */}
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  <div className="flex gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    <div className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                    <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
                    <div className="ml-2 h-1.5 flex-1 rounded-full bg-white/20" />
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-5">
                <h3 className="text-lg font-bold text-foreground mb-1">{project.title}</h3>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{project.description}</p>

                <div className="flex items-center gap-3">
                  {project.website_url && (
                    <a href={project.website_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button variant="outline" className="w-full" size="sm">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Website
                      </Button>
                    </a>
                  )}
                  {whatsappBase && (
                    <Button
                      size="sm"
                      className={`shadow-blue ${project.website_url ? "flex-1" : "w-full"}`}
                      onClick={() => handleInquire(project.title)}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Inquire
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="glass-card p-8 text-center">
        <h2 className="text-xl font-bold text-foreground mb-2">Have a custom project in mind?</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Don't see exactly what you need? We build custom solutions from scratch.
        </p>
        {whatsappBase ? (
          <Button className="shadow-blue" onClick={handleCustomInquire}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat on WhatsApp
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground italic">Contact information not available.</p>
        )}
      </div>
    </div>
  );
};

export default WebDevPage;
