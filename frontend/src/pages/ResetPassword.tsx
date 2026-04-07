import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Zap, Lock, Eye, EyeOff, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/api";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // Redirect to forgot-password if no token in URL
  useEffect(() => {
    if (!token) navigate("/forgot-password", { replace: true });
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. The link may have expired.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!token) return null;

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="h-10 w-10 rounded-xl gradient-blue flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">PriveBoost</span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Choose a new password</h1>
          <p className="text-muted-foreground mt-1">Make it strong and memorable</p>
        </div>

        <div className="glass-card p-8">
          {done ? (
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Password updated!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Your password has been reset. You can now log in with your new password.
                </p>
              </div>
              <Button className="w-full h-11" onClick={() => navigate("/login")}>
                Go to Sign In
              </Button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    placeholder="Repeat your new password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-10 h-11"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                  <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button className="w-full h-11 shadow-blue" type="submit" disabled={loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Resetting...</>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          )}
        </div>

        {!done && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            <Link to="/forgot-password" className="text-primary font-medium hover:underline">
              Request a new link
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
