import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import ServicesSection from "@/components/landing/ServicesSection";
import ContactSection from "@/components/landing/ContactSection";
import Footer from "@/components/landing/Footer";
import { usePageMeta } from "@/hooks/use-page-meta";

const Index = () => {
  usePageMeta({
    title: "Buy Social Media Growth, Verification Numbers & Digital Services",
    description:
      "PriveBoost is Nigeria's trusted platform for social media boosting, OTP verification numbers, verified social media accounts, gift delivery, and web development. Instant delivery, NGN payments.",
    canonical: "https://www.priveboost.com/",
  });

  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <ServicesSection />
      <ContactSection />
      <Footer />
    </div>
  );
};

export default Index;
