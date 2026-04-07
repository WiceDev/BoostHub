import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Zap, Eye, EyeOff, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { register, ApiError } from "@/lib/api";
import { toast } from "sonner";

const Signup = () => {
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState(
    searchParams.get("ref") || ""
  );
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const username =
        email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "") +
        Math.floor(Math.random() * 1000);
      const user = await register({
        email,
        username,
        first_name: firstName,
        last_name: lastName,
        password,
        referral_code: referralCode.trim() || undefined,
      });
      setUser(user);
      toast.success("Account created! Please verify your email.");
      navigate("/verify-email");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Registration failed. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="h-10 w-10 rounded-xl gradient-blue flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">PriveBoost</span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">
            Create your account
          </h1>
          <p className="text-muted-foreground mt-1">
            Start growing your presence today
          </p>
        </div>

        <div className="glass-card p-8">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Referral code */}
            <div className="space-y-2">
              <Label htmlFor="referralCode" className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                Referral Code
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="referralCode"
                placeholder="e.g. BOOST3X9"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                maxLength={12}
                className={referralCode ? "uppercase tracking-widest font-mono" : ""}
              />
              {referralCode && (
                <p className="text-xs text-primary flex items-center gap-1">
                  🎁 You were referred by someone — both of you benefit when you deposit ₦10,000!
                </p>
              )}
            </div>

            <Button
              className="w-full h-11 shadow-blue"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Create Account
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
