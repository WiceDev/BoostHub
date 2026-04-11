import { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Zap, ArrowLeft } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";

const Legal = () => {
  const { hash } = useLocation();

  usePageMeta({
    title: "Legal — Privacy Policy, Terms of Service & Refund Policy",
    description:
      "Read PriveBoost's Privacy Policy, Terms of Service, and Refund Policy. Learn how we protect your data, our service terms, and our automatic refund guarantee.",
    canonical: "https://www.priveboost.com/legal",
  });

  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [hash]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-blue flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">PriveBoost</span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Legal</h1>
        <p className="text-muted-foreground mb-10">
          Last updated: April 2026
        </p>

        {/* Quick nav */}
        <div className="flex flex-wrap gap-3 mb-12">
          <a href="#privacy" className="text-sm px-4 py-2 rounded-full border hover:bg-muted transition-colors">Privacy Policy</a>
          <a href="#terms" className="text-sm px-4 py-2 rounded-full border hover:bg-muted transition-colors">Terms of Service</a>
          <a href="#refund" className="text-sm px-4 py-2 rounded-full border hover:bg-muted transition-colors">Refund Policy</a>
        </div>

        {/* Privacy Policy */}
        <section id="privacy" className="mb-16 scroll-mt-24">
          <h2 className="text-2xl font-bold mb-6">Privacy Policy</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              PriveBoost ("we", "us", "our") is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your personal information when you use our platform.
            </p>

            <h3 className="text-lg font-semibold text-foreground pt-2">Information We Collect</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Account information: name, email address, and phone number provided during registration.</li>
              <li>Transaction data: wallet deposits, order history, and payment references.</li>
              <li>Usage data: pages visited, features used, and device/browser information collected automatically.</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground pt-2">How We Use Your Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>To process your orders and wallet transactions.</li>
              <li>To send transactional emails (order updates, deposit confirmations, security alerts).</li>
              <li>To improve our platform and provide customer support.</li>
              <li>To prevent fraud and ensure platform security.</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground pt-2">Data Sharing</h3>
            <p>
              We do not sell your personal information. We may share data with third-party payment processors (e.g., Korapay) solely to process your transactions. We may also disclose information if required by law.
            </p>

            <h3 className="text-lg font-semibold text-foreground pt-2">Data Security</h3>
            <p>
              We use industry-standard security measures including encryption, secure sessions, and input sanitization to protect your data. However, no method of transmission over the internet is 100% secure.
            </p>

            <h3 className="text-lg font-semibold text-foreground pt-2">Your Rights</h3>
            <p>
              You may update your profile information at any time from your dashboard. To request account deletion or data export, please contact our support team.
            </p>
          </div>
        </section>

        {/* Terms of Service */}
        <section id="terms" className="mb-16 scroll-mt-24">
          <h2 className="text-2xl font-bold mb-6">Terms of Service</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              By using PriveBoost, you agree to the following terms. If you do not agree, please do not use our platform.
            </p>

            <h3 className="text-lg font-semibold text-foreground pt-2">Account Responsibility</h3>
            <p>
              You are responsible for maintaining the security of your account credentials. You must provide accurate information during registration. We reserve the right to suspend accounts that violate our policies.
            </p>

            <h3 className="text-lg font-semibold text-foreground pt-2">Services</h3>
            <p>
              PriveBoost provides social media growth services, verification numbers, social media accounts, gift items, and web development leads. Services are fulfilled through third-party providers and are subject to availability.
            </p>

            <h3 className="text-lg font-semibold text-foreground pt-2">Wallet & Payments</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>All transactions are conducted in Nigerian Naira (NGN).</li>
              <li>Wallet funds are non-transferable to other users.</li>
              <li>Deposits are processed through our supported payment gateways.</li>
              <li>You must fund your wallet before placing orders.</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground pt-2">Prohibited Use</h3>
            <p>
              You may not use PriveBoost for any illegal activity, to distribute malware, to impersonate others, or to abuse our services in any way that disrupts the platform or harms other users.
            </p>

            <h3 className="text-lg font-semibold text-foreground pt-2">Limitation of Liability</h3>
            <p>
              PriveBoost is provided "as is". We do not guarantee uninterrupted service or specific results from third-party services. Our liability is limited to the amount paid for the specific service in question.
            </p>

            <h3 className="text-lg font-semibold text-foreground pt-2">Changes to Terms</h3>
            <p>
              We may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the updated terms.
            </p>
          </div>
        </section>

        {/* Refund Policy */}
        <section id="refund" className="mb-16 scroll-mt-24">
          <h2 className="text-2xl font-bold mb-6">Refund Policy</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <h3 className="text-lg font-semibold text-foreground pt-2">Automatic Refunds</h3>
            <p>
              If an order fails due to a service provider error, your wallet is automatically refunded in full. You will see the refund reflected in your transaction history immediately.
            </p>

            <h3 className="text-lg font-semibold text-foreground pt-2">Order Cancellations</h3>
            <p>
              Some services (e.g., verification numbers) may be cancelled while still in a pending or processing state. Cancelled orders are refunded to your wallet automatically.
            </p>

            <h3 className="text-lg font-semibold text-foreground pt-2">Non-Refundable Cases</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Orders that have been completed and delivered successfully.</li>
              <li>Social media boosting orders that have already started processing.</li>
              <li>Services used in violation of our Terms of Service.</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground pt-2">Wallet Deposits</h3>
            <p>
              Wallet deposits are non-refundable to your original payment method. Deposited funds remain in your wallet balance and can be used for any service on the platform.
            </p>

            <h3 className="text-lg font-semibold text-foreground pt-2">Disputes</h3>
            <p>
              If you believe a refund was not processed correctly, please contact our support team through the Help & Support section in your dashboard. We aim to resolve all disputes within 48 hours.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <div className="container mx-auto px-4">
          © {new Date().getFullYear()} PriveBoost. All rights reserved.
          <span className="mx-2">·</span>
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
        </div>
      </footer>
    </div>
  );
};

export default Legal;
