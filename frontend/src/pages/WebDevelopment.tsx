import { MessageSquare, ExternalLink, Play, Globe, Code } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/use-page-meta";

const WHATSAPP_LINK = "https://wa.me/2348000000000";

const projects = [
  {
    title: "ShopVault",
    type: "Ecommerce Platform",
    description: "Full-featured online store with payment processing, inventory management, and real-time analytics dashboard.",
    videoPlaceholder: "bg-blue-600",
    siteUrl: "#",
  },
  {
    title: "QuickBite",
    type: "Food Delivery System",
    description: "Real-time order tracking, driver management, and seamless checkout for restaurants and customers.",
    videoPlaceholder: "bg-blue-700",
    siteUrl: "#",
  },
  {
    title: "WealthPro",
    type: "Investment Platform",
    description: "Portfolio management with real-time trading charts, automated alerts, and financial analytics.",
    videoPlaceholder: "bg-blue-500",
    siteUrl: "#",
  },
  {
    title: "NeoVault Bank",
    type: "Online Banking UI",
    description: "Modern banking interface with secure account management, transfers, and transaction history.",
    videoPlaceholder: "bg-blue-600",
    siteUrl: "#",
  },
  {
    title: "CoinTrade",
    type: "Crypto Exchange",
    description: "Trading platform with live charts, order books, spot & P2P trading, and multi-currency wallets.",
    videoPlaceholder: "bg-blue-800",
    siteUrl: "#",
  },
  {
    title: "HomeHQ",
    type: "Real Estate Platform",
    description: "Property listings with virtual tours, agent dashboards, mortgage calculators, and lead management.",
    videoPlaceholder: "bg-blue-500",
    siteUrl: "#",
  },
  {
    title: "LearnSpace",
    type: "Education Platform",
    description: "LMS with course creation, video lessons, quizzes, certifications, and student progress tracking.",
    videoPlaceholder: "bg-blue-700",
    siteUrl: "#",
  },
  {
    title: "FreightFlow",
    type: "Logistics Platform",
    description: "End-to-end supply chain management with fleet tracking, warehouse ops, and delivery scheduling.",
    videoPlaceholder: "bg-blue-900",
    siteUrl: "#",
  },
  {
    title: "MedConnect",
    type: "Healthcare Portal",
    description: "Telemedicine appointments, patient records, prescription management, and doctor scheduling.",
    videoPlaceholder: "bg-blue-600",
    siteUrl: "#",
  },
  {
    title: "EventHive",
    type: "Event Management",
    description: "Event ticketing, seat selection, vendor coordination, and attendee check-in system.",
    videoPlaceholder: "bg-blue-800",
    siteUrl: "#",
  },
];

const WebDevelopment = () => {
  usePageMeta({
    title: "Web Development — Custom Websites for Your Business",
    description:
      "Get professional, modern websites built by PriveBoost developers. Ecommerce stores, investment platforms, food delivery apps, banking UIs, crypto exchanges, and more. View our portfolio.",
    canonical: "https://www.priveboost.com/web-development",
  });

  const handleInquire = (projectTitle: string) => {
    const message = encodeURIComponent(
      `Hi, I'm interested in a website similar to "${projectTitle}". I'd like to discuss the details.`
    );
    window.open(`${WHATSAPP_LINK}?text=${message}`, "_blank");
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Code className="h-4 w-4" />
              Professional Web Development
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Website <span className="text-gradient">Development</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We build modern, high-performance web applications tailored to your business.
              Browse our portfolio and get in touch to start your project.
            </p>
          </div>

          {/* Projects Grid — 3 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-7 max-w-7xl mx-auto">
            {projects.map((project) => (
              <div key={project.title} className="glass-card overflow-hidden group">
                {/* Video Preview Area */}
                <div className={`relative h-56 sm:h-64 ${project.videoPlaceholder} overflow-hidden`}>
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />

                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform cursor-pointer">
                      <Play className="h-7 w-7 text-white ml-1" fill="white" />
                    </div>
                  </div>

                  {/* Type badge */}
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm text-white text-xs font-semibold border border-white/10">
                      <Globe className="h-3 w-3" />
                      {project.type}
                    </span>
                  </div>

                  {/* Decorative elements */}
                  <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                      <div className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                      <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
                      <div className="ml-2 h-1.5 flex-1 rounded-full bg-white/20" />
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-foreground mb-1">{project.title}</h3>
                  <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{project.description}</p>

                  <div className="flex items-center gap-3">
                    <a
                      href={project.siteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button variant="outline" className="w-full" size="sm">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Website
                      </Button>
                    </a>
                    <Button
                      size="sm"
                      className="flex-1 shadow-blue"
                      onClick={() => handleInquire(project.title)}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Inquire
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA Section */}
          <div className="mt-16 text-center">
            <div className="glass-card max-w-2xl mx-auto p-8 md:p-12">
              <h2 className="text-2xl font-bold text-foreground mb-3">Have a custom project in mind?</h2>
              <p className="text-muted-foreground mb-6">
                Don't see exactly what you need? We build custom solutions from scratch. Let's discuss your vision.
              </p>
              <Button
                size="lg"
                className="shadow-blue"
                onClick={() => {
                  const msg = encodeURIComponent("Hi, I have a custom web development project I'd like to discuss.");
                  window.open(`${WHATSAPP_LINK}?text=${msg}`, "_blank");
                }}
              >
                <MessageSquare className="h-5 w-5 mr-2" />
                Chat on WhatsApp
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default WebDevelopment;
