import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Zap, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { login, verify2faLogin, ApiError, type User } from "@/lib/api";
import { toast } from "sonner";

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"credentials" | "2fa">("credentials");
  const [totpCode, setTotpCode] = useState("");
  const { setUser } = useAuth();
  const navigate = useNavigate();

  // Show password-changed banner if redirected from profile
  useEffect(() => {
    if (sessionStorage.getItem("password_changed") === "true") {
      sessionStorage.removeItem("password_changed");
      toast.success("Password updated! Please log in with your new password.", {
        duration: 6000,
      });
    }
  }, []);

  // Load reCAPTCHA v3 script
  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY) return;
    if (document.querySelector(`script[src*="recaptcha"]`)) return;

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const getRecaptchaToken = useCallback((): Promise<string> => {
    if (!RECAPTCHA_SITE_KEY) return Promise.resolve("");

    return new Promise((resolve) => {
      const w = window as unknown as { grecaptcha?: { ready: (cb: () => void) => void; execute: (key: string, opts: { action: string }) => Promise<string> } };
      if (!w.grecaptcha) {
        resolve("");
        return;
      }
      w.grecaptcha.ready(() => {
        w.grecaptcha!
          .execute(RECAPTCHA_SITE_KEY, { action: "login" })
          .then(resolve)
          .catch(() => resolve(""));
      });
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const recaptchaToken = await getRecaptchaToken();
      const result = await login(email, password, recaptchaToken);
      if ('requires_2fa' in result && result.requires_2fa) {
        setStep("2fa");
        return;
      }
      const user = result as User;
      setUser(user);
      navigate(user.is_staff ? "/admin" : "/dashboard");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Login failed. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handle2faSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await verify2faLogin(totpCode.replace(/\s/g, ""));
      setUser(user);
      navigate(user.is_staff ? "/admin" : "/dashboard");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Invalid code. Please try again.";
      toast.error(message);
      setTotpCode("");
    } finally {
      setLoading(false);
    }
  };

  if (step === "2fa") {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/15 border border-primary/20 mb-4">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Two-Factor Auth</h1>
            <p className="text-muted-foreground mt-1">Enter the 6-digit code from your authenticator app</p>
          </div>

          <div className="glass-card p-8">
            <form className="space-y-5" onSubmit={handle2faSubmit}>
              <div className="space-y-2">
                <Label htmlFor="totp">Verification Code</Label>
                <Input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9 ]*"
                  maxLength={7}
                  placeholder="000 000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="text-center text-xl tracking-widest font-mono"
                  autoFocus
                  required
                />
              </div>

              <Button className="w-full h-11 shadow-blue" type="submit" disabled={loading || totpCode.replace(/\s/g, "").length < 6}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verify
              </Button>

              <button
                type="button"
                onClick={() => { setStep("credentials"); setTotpCode(""); }}
                className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
              >
                ← Back to login
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="h-10 w-10 rounded-xl gradient-blue flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">BoostHub</span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="text-muted-foreground mt-1">Sign in to your account</p>
        </div>

        <div className="glass-card p-8">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button className="w-full h-11 shadow-blue" type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sign In
            </Button>

            {RECAPTCHA_SITE_KEY && (
              <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                Protected by reCAPTCHA.{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy</a>{" & "}
                <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline">Terms</a>
              </p>
            )}
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{" "}
          <Link to="/signup" className="text-primary font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
