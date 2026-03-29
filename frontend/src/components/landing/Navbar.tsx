import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const navLinks = [
  { label: "Home", to: "/", hash: "#home" },
  { label: "About", to: "/", hash: "#about" },
  { label: "Services", to: "/", hash: "#services" },
  { label: "Contact", to: "/", hash: "#contact" },
];

const observedIds = ["home", "about", "services", "contact"];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (location.pathname !== "/") {
      setActiveSection("");
      return;
    }

    // Small delay to let DOM render
    const timer = setTimeout(() => {
      const visible = new Map<string, IntersectionObserverEntry>();

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            visible.set(entry.target.id, entry);
          });

          // Pick the topmost visible section
          for (const id of observedIds) {
            const entry = visible.get(id);
            if (entry?.isIntersecting) {
              setActiveSection(id);
              return;
            }
          }
        },
        { rootMargin: "-40% 0px -40% 0px", threshold: 0 }
      );

      observedIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });

      // Set initial state
      setActiveSection("home");

      return () => observer.disconnect();
    }, 100);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  const isActive = (link: typeof navLinks[0]) => {
    if (link.hash && location.pathname === "/") {
      return `#${activeSection}` === link.hash;
    }
    return false;
  };

  const handleClick = (link: typeof navLinks[0]) => {
    setMobileOpen(false);
    if (link.hash && location.pathname === "/") {
      const el = document.querySelector(link.hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/90 backdrop-blur-lg border-b border-border/50 shadow-sm" : "bg-transparent border-b border-transparent"}`}>
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="flex items-center gap-2" onClick={() => {
          if (location.pathname === "/") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}>
          <div className="h-8 w-8 rounded-lg gradient-blue flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">BoostHub</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const active = isActive(link);
            if (link.hash) {
              return (
                <a
                  key={link.label}
                  href={`/${link.hash}`}
                  onClick={(e) => {
                    if (location.pathname === "/") {
                      e.preventDefault();
                      handleClick(link);
                    }
                  }}
                  className={`text-sm font-medium transition-colors ${active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {link.label}
                </a>
              );
            }
            return (
              <Link
                key={link.label}
                to={link.to}
                className={`text-sm font-medium transition-colors ${active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" size="sm">Log In</Button>
          </Link>
          <Link to="/signup">
            <Button size="sm" className="shadow-blue">Get Started</Button>
          </Link>
        </div>

        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-foreground">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile */}
      {mobileOpen && (
        <div className="md:hidden bg-background/95 backdrop-blur-lg border-b border-border px-4 pb-4 animate-fade-in">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => {
              const active = isActive(link);
              if (link.hash) {
                return (
                  <a
                    key={link.label}
                    href={`/${link.hash}`}
                    onClick={(e) => {
                      if (location.pathname === "/") {
                        e.preventDefault();
                      }
                      handleClick(link);
                    }}
                    className={`text-sm font-medium py-2 ${active ? "text-primary font-semibold" : "text-muted-foreground"}`}
                  >
                    {link.label}
                  </a>
                );
              }
              return (
                <Link
                  key={link.label}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={`text-sm font-medium py-2 ${active ? "text-primary font-semibold" : "text-muted-foreground"}`}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link to="/login" onClick={() => setMobileOpen(false)}>
              <Button variant="ghost" className="w-full">Log In</Button>
            </Link>
            <Link to="/signup" onClick={() => setMobileOpen(false)}>
              <Button className="w-full">Get Started</Button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
