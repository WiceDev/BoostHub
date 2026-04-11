import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "What is PriveBoost?",
    answer:
      "PriveBoost is a digital services platform where you can buy social media growth (followers, likes, views), OTP verification numbers, verified social media accounts, gift delivery, and professional web development — all in one place.",
  },
  {
    question: "How does social media boosting work?",
    answer:
      "Simply choose a service (e.g. Instagram Followers), enter your profile link and desired quantity, and place your order. Delivery starts automatically within minutes. You can track progress from your dashboard.",
  },
  {
    question: "Is it safe to use PriveBoost?",
    answer:
      "Yes. We use secure payment processing through Korapay, protect your account with optional 2FA, and never ask for your social media passwords. All transactions are encrypted and your data is kept private.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept bank transfers, debit/credit cards, and USDT crypto payments. All payments are processed in Nigerian Naira (NGN). You fund your wallet first, then use your balance to place orders.",
  },
  {
    question: "How long does delivery take?",
    answer:
      "Most social media boosting orders start within minutes and complete within hours depending on quantity. Verification numbers are delivered instantly. Gift deliveries typically take 2-5 business days.",
  },
  {
    question: "What happens if my order fails?",
    answer:
      "If an order fails for any reason, your wallet is automatically refunded in full — no action needed on your part. You'll see the refund in your transaction history immediately.",
  },
  {
    question: "Can I get a refund on my wallet deposit?",
    answer:
      "Wallet deposits are non-refundable to your original payment method, but your balance never expires and can be used for any service on the platform. Failed orders are always auto-refunded to your wallet.",
  },
  {
    question: "How do verification numbers work?",
    answer:
      "Select the country and service you need (e.g. WhatsApp, Telegram), purchase a temporary phone number, and receive the OTP code directly on your dashboard. Numbers are active for up to 20 minutes.",
  },
];

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-24 scroll-mt-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Got questions? We've got answers. If you need more help, reach out through our contact form.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="glass-card overflow-hidden"
            >
              <button
                onClick={() => toggle(index)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="font-medium text-foreground pr-4">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                className={`grid transition-all duration-200 ease-in-out ${
                  openIndex === index
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
              },
            })),
          }),
        }}
      />
    </section>
  );
};

export default FAQSection;
