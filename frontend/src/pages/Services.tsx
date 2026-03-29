import { Link } from "react-router-dom";
import { TrendingUp, Phone, Users, Code, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const services = [
  {
    icon: TrendingUp,
    title: "Social Media Boosting",
    description: "Grow your followers, likes, and engagement across all major social platforms instantly. We support Instagram, TikTok, Twitter, YouTube, and Facebook.",
    link: "/dashboard/boosting",
    color: "bg-primary/10 text-primary",
    available: true,
  },
  {
    icon: Phone,
    title: "Verification Numbers",
    description: "Get temporary phone numbers for account verification on any platform worldwide. Multiple countries and services available.",
    link: "/dashboard/numbers",
    color: "bg-accent/10 text-accent",
    available: true,
  },
  {
    icon: Users,
    title: "Social Media Accounts",
    description: "Purchase verified social media accounts ready to use for marketing and business. Instagram, Facebook, Twitter, TikTok, Telegram, and YouTube.",
    link: "#",
    color: "bg-success/10 text-success",
    available: false,
  },
  {
    icon: Code,
    title: "Website Development",
    description: "Get custom websites built by professional developers for your business needs. Ecommerce, investment platforms, delivery systems, and more.",
    link: "/web-development",
    color: "bg-warning/10 text-warning",
    available: true,
  },
];

const Services = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <section className="flex-1 py-24 bg-surface">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Our Services</h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Everything you need to grow your digital presence in one platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {services.map((service) => (
              <div
                key={service.title}
                className="glass-card p-8 group cursor-pointer hover:-translate-y-1 transition-transform"
              >
                <div className={`h-12 w-12 rounded-xl ${service.color} flex items-center justify-center mb-5`}>
                  <service.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{service.title}</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">{service.description}</p>
                {service.available ? (
                  <Link to={service.link}>
                    <Button variant="ghost" className="px-0 text-primary hover:text-primary group-hover:gap-3 transition-all">
                      Explore Service
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                ) : (
                  <Button variant="ghost" className="px-0 text-muted-foreground" disabled>
                    Coming Soon
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Services;
