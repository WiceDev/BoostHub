import { Link } from "react-router-dom";
import { TrendingUp, Phone, Users, Code, Gift, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const services = [
  {
    icon: TrendingUp,
    title: "Social Media Boosting",
    description: "Grow your followers, likes, and engagement across all major social platforms instantly.",
    link: "/dashboard/boosting",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: Phone,
    title: "Verification Numbers",
    description: "Get temporary phone numbers for account verification on any platform worldwide.",
    link: "/dashboard/numbers",
    color: "bg-accent/10 text-accent",
  },
  {
    icon: Users,
    title: "Social Media Accounts",
    description: "Purchase verified social media accounts ready to use for marketing and business.",
    link: "/services",
    color: "bg-success/10 text-success",
  },
  {
    icon: Code,
    title: "Website Development",
    description: "Get custom websites built by professional developers for your business needs.",
    link: "/web-development",
    color: "bg-warning/10 text-warning",
  },
  {
    icon: Gift,
    title: "Send Gifts Abroad",
    description: "Surprise your loved ones overseas with gift deliveries — from care packages to digital vouchers.",
    link: "/dashboard/gifts",
    color: "bg-pink-500/10 text-pink-500",
  },
];

const ServicesSection = () => {
  return (
    <section id="services" className="min-h-screen flex items-center py-24 scroll-mt-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Our Services</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Everything you need to grow your digital presence in one platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {services.map((service) => (
            <div
              key={service.title}
              className="glass-card p-8 group cursor-pointer hover:-translate-y-1"
            >
              <div className={`h-12 w-12 rounded-xl ${service.color} flex items-center justify-center mb-5`}>
                <service.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{service.title}</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">{service.description}</p>
              <Link to={service.link}>
                <Button variant="ghost" className="px-0 text-primary hover:text-primary group-hover:gap-3 transition-all">
                  Explore Service
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
