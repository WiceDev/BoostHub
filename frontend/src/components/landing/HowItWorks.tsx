import { Link } from "react-router-dom";
import { UserPlus, Wallet, ShoppingCart, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Create an Account",
    description: "Sign up in seconds with just your email address. No lengthy verification process — get instant access to our full suite of digital growth services.",
    details: [
      "Quick email registration",
      "Instant dashboard access",
      "Secure & private account",
    ],
  },
  {
    icon: Wallet,
    step: "02",
    title: "Fund Your Wallet",
    description: "Add funds to your wallet using Paystack for instant Naira deposits, or use cryptocurrency for international payments. Your balance is always ready to spend.",
    details: [
      "Paystack instant deposits",
      "Crypto payment support",
      "Real-time balance updates",
    ],
  },
  {
    icon: ShoppingCart,
    step: "03",
    title: "Place Your Order",
    description: "Browse our catalog of services, select what you need, and place your order. Delivery starts immediately and you can track progress in real-time from your dashboard.",
    details: [
      "Instant order processing",
      "Real-time delivery tracking",
      "24/7 customer support",
    ],
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="min-h-screen flex items-center py-24 bg-surface scroll-mt-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-20">
          <span className="inline-block text-sm font-semibold text-primary tracking-wider uppercase mb-3">
            Simple Process
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-5">
            How It Works
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            Getting started takes less than a minute. Follow these three simple steps and you'll be growing your digital presence in no time.
          </p>
        </div>

        <div className="max-w-5xl mx-auto space-y-8 md:space-y-0 md:grid md:grid-cols-3 md:gap-6 lg:gap-10 relative">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />

          {steps.map((step) => (
            <div key={step.step} className="relative glass-card p-8 text-center group hover:-translate-y-1 transition-transform">
              {/* Step number badge */}
              <div className="relative inline-flex mb-6">
                <div className="h-20 w-20 rounded-2xl gradient-blue flex items-center justify-center shadow-blue mx-auto">
                  <step.icon className="h-9 w-9 text-primary-foreground" />
                </div>
                <span className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-foreground text-background text-sm font-bold flex items-center justify-center shadow-lg">
                  {step.step}
                </span>
              </div>

              <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">{step.description}</p>

              <div className="space-y-3 text-left">
                {step.details.map((detail) => (
                  <div key={detail} className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <Link to="/signup">
            <Button size="lg" className="shadow-blue text-base px-10 h-12">
              Start Now — It's Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
