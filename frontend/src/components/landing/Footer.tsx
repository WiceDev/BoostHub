import { Link } from "react-router-dom";
import { Zap } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-foreground text-background/70 py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg gradient-blue flex items-center justify-center">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-background">PriveBoost</span>
            </div>
            <p className="text-sm leading-relaxed">
              The all-in-one platform for social media growth and digital services.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-background mb-4">Products</h4>
            <div className="flex flex-col gap-2">
              <Link to="/services" className="text-sm hover:text-background transition-colors">Social Boosting</Link>
              <Link to="/services" className="text-sm hover:text-background transition-colors">Verification Numbers</Link>
              <Link to="/services" className="text-sm hover:text-background transition-colors">Web Development</Link>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-background mb-4">Company</h4>
            <div className="flex flex-col gap-2">
              <Link to="/" className="text-sm hover:text-background transition-colors">About Us</Link>
              <Link to="/" className="text-sm hover:text-background transition-colors">Contact</Link>
              <Link to="/" className="text-sm hover:text-background transition-colors">Support</Link>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-background mb-4">Legal</h4>
            <div className="flex flex-col gap-2">
              <Link to="/" className="text-sm hover:text-background transition-colors">Privacy Policy</Link>
              <Link to="/" className="text-sm hover:text-background transition-colors">Terms of Service</Link>
              <Link to="/" className="text-sm hover:text-background transition-colors">Refund Policy</Link>
            </div>
          </div>
        </div>

        <div className="border-t border-background/10 pt-8 text-center text-sm">
          © {new Date().getFullYear()} PriveBoost. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
