import { useEffect } from "react";

const SITE_NAME = "PriveBoost";
const DEFAULT_DESCRIPTION =
  "PriveBoost is Nigeria's trusted platform for social media boosting, OTP verification numbers, verified social media accounts, gift delivery, and web development.";

interface PageMeta {
  title: string;
  description?: string;
  canonical?: string;
}

/**
 * Sets <title>, <meta name="description">, <link rel="canonical">,
 * and the matching Open Graph tags for the current page.
 * Resets to defaults on unmount.
 */
export function usePageMeta({ title, description, canonical }: PageMeta) {
  useEffect(() => {
    const fullTitle = `${title} | ${SITE_NAME}`;
    const desc = description || DEFAULT_DESCRIPTION;

    // Title
    document.title = fullTitle;

    // Meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", desc);

    // OG tags
    const setMeta = (selector: string, content: string) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute("content", content);
    };

    setMeta('meta[property="og:title"]', fullTitle);
    setMeta('meta[property="og:description"]', desc);
    setMeta('meta[name="twitter:title"]', fullTitle);
    setMeta('meta[name="twitter:description"]', desc);

    // Canonical URL
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical) {
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = canonical;
    }

    // OG URL
    if (canonical) {
      setMeta('meta[property="og:url"]', canonical);
    }

    // Cleanup: restore defaults on unmount
    return () => {
      document.title = `${SITE_NAME} — Buy Social Media Growth, Verification Numbers & Digital Services`;
    };
  }, [title, description, canonical]);
}
