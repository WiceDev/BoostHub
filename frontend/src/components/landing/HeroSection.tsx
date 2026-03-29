import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Shield, Clock, Target, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

const highlights = [
  { icon: Shield, title: "Instant Credibility", description: "Skip the slow grind — start with an established presence that commands trust from day one." },
  { icon: Clock, title: "Save Time and Effort", description: "Focus on your content and strategy while we handle the heavy lifting of audience growth." },
  { icon: Target, title: "Targeted Audience", description: "Reach the right people with accounts and services tailored to your niche and market." },
  { icon: Rocket, title: "Strategic Expansion", description: "Scale your digital footprint across multiple platforms quickly and efficiently." },
];

const HeroSection = () => {
  return (
    <>
      {/* Hero */}
      <section id="home" className="relative min-h-screen flex items-center overflow-hidden scroll-mt-16">
        <div className="absolute inset-0 gradient-blue-subtle" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-fade-in border border-primary/20">
              <Sparkles className="h-4 w-4" />
              Trusted by 10,000+ users worldwide
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground mb-6 animate-fade-in leading-[1.08]" style={{ animationDelay: "0.1s" }}>
              Grow Your Social<br />
              <span className="text-gradient">Presence Instantly</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              Buy social media growth services, verification numbers, and digital solutions in one powerful platform.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <Link to="/signup">
                <Button size="lg" className="shadow-blue text-base px-10 h-12 rounded-xl">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a
                href="#services"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("services")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <Button variant="outline" size="lg" className="text-base px-10 h-12 rounded-xl">
                  Explore Services
                </Button>
              </a>
            </div>

            {/* Social proof mini-stats */}
            <div className="flex items-center justify-center gap-8 mt-14 animate-fade-in" style={{ animationDelay: "0.4s" }}>
              <div>
                <p className="text-2xl font-bold text-foreground">10K+</p>
                <p className="text-xs text-muted-foreground">Happy Users</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div>
                <p className="text-2xl font-bold text-foreground">50+</p>
                <p className="text-xs text-muted-foreground">Platforms</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div>
                <p className="text-2xl font-bold text-foreground">99%</p>
                <p className="text-xs text-muted-foreground">Satisfaction</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="min-h-screen flex items-center py-24 bg-surface scroll-mt-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">About Us</h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-4">
              Unlock the power of established social media presence with BoostHub.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              In today's digital age, social media has become an indispensable tool for individuals, businesses, and influencers alike to connect, engage, and grow their online presence. However, building a strong following and establishing credibility on social media platforms can be a time-consuming and challenging endeavor. That's where BoostHub comes in — your ultimate destination to unlock the power of established social media presence.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {highlights.map((item) => (
              <div key={item.title} className="glass-card p-6 text-center">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default HeroSection;
