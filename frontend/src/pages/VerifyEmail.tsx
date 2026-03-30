import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Mail, CheckCircle, XCircle, Loader2, Zap, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { verifyEmail, resendVerification, logout as apiLogout } from "@/lib/api";
import { toast } from "sonner";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { user, refreshUser, handleLogout } = useAuth();

  // If token present → verification callback mode
  // If no token → "check your email" prompt mode
  const [verifying, setVerifying] = useState(!!token);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // Handle token verification
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await verifyEmail(token);
        if (!cancelled) {
          setVerified(true);
          setError("");
          // Refresh user state so is_verified updates
          await refreshUser();
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Verification failed. The link may have expired."
          );
        }
      } finally {
        if (!cancelled) setVerifying(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token, refreshUser]);

  // If user is already verified and no token in URL, redirect to dashboard
  useEffect(() => {
    if (!token && user?.is_verified) {
      navigate(user.is_staff ? "/admin" : "/dashboard", { replace: true });
    }
  }, [user, token, navigate]);

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerification();
      setResent(true);
      toast.success("Verification email sent! Check your inbox.");
    } catch {
      toast.error("Failed to send verification email.");
    } finally {
      setResending(false);
    }
  };

  const handleContinue = () => {
    if (user) {
      navigate(user.is_staff ? "/admin" : "/dashboard", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  };

  const maskEmail = (email: string) => {
    const [local, domain] = email.split("@");
    if (local.length <= 5) {
      return `${local.slice(0, 2)}${"*".repeat(local.length - 2)}@${domain}`;
    }
    return `${local.slice(0, 3)}${"*".repeat(local.length - 5)}${local.slice(-2)}@${domain}`;
  };

  // Token verification mode
  if (token) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <div className="h-10 w-10 rounded-xl gradient-blue flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">BoostHub</span>
          </Link>

          <div className="glass-card p-8">
            {verifying ? (
              <div className="space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                <h2 className="text-xl font-bold text-foreground">Verifying your email...</h2>
                <p className="text-sm text-muted-foreground">Please wait a moment.</p>
              </div>
            ) : verified ? (
              <div className="space-y-4">
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Email Verified!</h2>
                <p className="text-sm text-muted-foreground">
                  Your email has been verified successfully. You can now access all features.
                </p>
                <Button onClick={handleContinue} className="w-full h-11 shadow-blue mt-2">
                  Continue to Dashboard
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Verification Failed</h2>
                <p className="text-sm text-muted-foreground">{error}</p>
                <div className="flex flex-col gap-2 mt-2">
                  {user && !user.is_verified && (
                    <Button onClick={handleResend} disabled={resending} variant="outline" className="w-full h-11">
                      {resending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Resend Verification Email
                    </Button>
                  )}
                  <Button onClick={() => navigate("/login")} variant="ghost" className="w-full h-11">
                    Go to Login
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // "Check your email" prompt mode (after registration)
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-xl gradient-blue flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-foreground">BoostHub</span>
        </Link>

        <div className="glass-card p-8 space-y-6">
          <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Mail className="h-10 w-10 text-primary" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground">Check your email</h2>
            <p className="text-sm text-muted-foreground mt-2">
              We've sent a verification link to{" "}
              <strong className="text-foreground">{user?.email ? maskEmail(user.email) : ""}</strong>.
              Please click the link in the email to verify your account.
            </p>
          </div>

          <a
            href="https://mail.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Open Email
          </a>

          <div className="border-t border-border/30 pt-4 space-y-3">
            <p className="text-xs text-muted-foreground">Didn't receive the email?</p>
            <Button
              onClick={handleResend}
              disabled={resending || resent}
              variant="outline"
              className="w-full h-10"
            >
              {resending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {resent ? "Email Sent!" : "Resend Verification Email"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Wrong email?{" "}
            <button
              onClick={async () => {
                try { await apiLogout(); } catch {}
                handleLogout();
                navigate("/signup");
              }}
              className="text-primary hover:underline"
            >
              Sign up again
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
