import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, Shield, Loader2, Users, Copy, Check,
  Gift, TrendingUp, Link as LinkIcon, Phone, ShieldCheck, ShieldOff,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { updateProfile, changePassword, fetchReferralStats, fetch2faSetup, enable2fa, disable2fa, logout as apiLogout, ApiError } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCurrency } from "@/context/CurrencyContext";
import QRCode from "qrcode/lib/browser";

function getPasswordStrength(password: string): { score: number; label: string; color: string; bg: string } {
  if (!password) return { score: 0, label: "", color: "", bg: "" };
  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "Weak",   color: "text-destructive",  bg: "bg-destructive" };
  if (score === 2) return { score, label: "Fair",   color: "text-amber-500",    bg: "bg-amber-500" };
  if (score === 3) return { score, label: "Good",   color: "text-yellow-500",   bg: "bg-yellow-500" };
  if (score === 4) return { score, label: "Strong", color: "text-emerald-500",  bg: "bg-emerald-500" };
  return              { score,     label: "Very Strong", color: "text-emerald-500", bg: "bg-emerald-500" };
}

const ProfilePage = () => {
  const { user, refreshUser, handleLogout } = useAuth();
  const { formatAmount } = useCurrency();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [copied, setCopied] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // 2FA state (admin only)
  const [twoFaPhase, setTwoFaPhase] = useState<"idle" | "setup" | "disable">("idle");
  const [twoFaSecret, setTwoFaSecret] = useState("");
  const [twoFaQrDataUrl, setTwoFaQrDataUrl] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaLoading, setTwoFaLoading] = useState(false);

  useEffect(() => {
    if (twoFaPhase === "setup") {
      fetch2faSetup()
        .then(({ secret, otpauth_uri }) => {
          setTwoFaSecret(secret);
          return QRCode.toDataURL(otpauth_uri, { width: 200, margin: 1 });
        })
        .then(setTwoFaQrDataUrl)
        .catch((err) => {
          toast.error(err instanceof ApiError ? err.message : "Failed to generate QR code.");
          setTwoFaPhase("idle");
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twoFaPhase]);

  const handle2faEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFaLoading(true);
    try {
      await enable2fa(twoFaCode.replace(/\s/g, ""));
      toast.success("2FA enabled. Your account is now more secure.");
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setTwoFaPhase("idle");
      setTwoFaCode("");
      setTwoFaSecret("");
      setTwoFaQrDataUrl("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to enable 2FA.");
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handle2faDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFaLoading(true);
    try {
      await disable2fa(twoFaCode.replace(/\s/g, ""));
      toast.success("2FA disabled.");
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setTwoFaPhase("idle");
      setTwoFaCode("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to disable 2FA.");
    } finally {
      setTwoFaLoading(false);
    }
  };

  const passwordStrength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  const { data: referral } = useQuery({
    queryKey: ["referral-stats"],
    queryFn: fetchReferralStats,
  });

  // Build referral link using the current window origin so it always points to the right domain
  const referralLink = referral
    ? `${window.location.origin}/signup?ref=${referral.referral_code}`
    : "";

  const handleCopyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile({ first_name: firstName, last_name: lastName, phone });
      await refreshUser();
      toast.success("Profile updated successfully!");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update profile.";
      toast.error(message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      sessionStorage.setItem("password_changed", "true");
      try { await apiLogout(); } catch {}
      handleLogout();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update password.";
      toast.error(message);
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl sm:rounded-t-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-blue-600/10" />
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 header-diamond-pattern pointer-events-none" />
        <div className="p-6 md:p-8 relative z-20 flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Profile Settings</h1>
            <p className="text-muted-foreground text-sm">Manage your account details and security</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Personal Info ── */}
        <form onSubmit={handleSaveProfile} className="glass-card p-6 sm:p-8 space-y-6">
          <h2 className="text-lg font-semibold text-foreground">Personal Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input value={firstName} readOnly disabled className="bg-muted/50 cursor-not-allowed opacity-60" />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input value={lastName} readOnly disabled className="bg-muted/50 cursor-not-allowed opacity-60" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <div className="flex items-center gap-2">
              <Input value={user?.email || ""} readOnly disabled className="bg-muted/50 cursor-not-allowed opacity-60" />
              {user?.is_verified ? (
                <Badge className="bg-success/10 text-success border-success/20 flex items-center gap-1 flex-shrink-0">
                  <CheckCircle className="h-3 w-3" /> Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="text-warning border-warning/20 flex-shrink-0">Unverified</Badge>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Phone Number
            </Label>
            <Input
              type="tel"
              placeholder="e.g. +2348012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Optional. Include country code (e.g. +234).</p>
          </div>
          <Button type="submit" disabled={savingProfile}>
            {savingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </form>

        {/* ── Change Password ── */}
        <form onSubmit={handleChangePassword} className="glass-card p-6 sm:p-8 space-y-6">
          <h2 className="text-lg font-semibold text-foreground">Change Password</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input type="password" placeholder="••••••••" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
              {newPassword.length > 0 && (
                <div className="space-y-1.5">
                  {/* Meter bar — 5 segments */}
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((seg) => (
                      <div
                        key={seg}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          seg <= passwordStrength.score ? passwordStrength.bg : "bg-muted/50"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs font-semibold ${passwordStrength.color}`}>
                    {passwordStrength.label}
                    <span className="text-muted-foreground font-normal ml-1">
                      {passwordStrength.score < 3 && "— add uppercase, numbers or symbols"}
                    </span>
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className={confirmPassword.length > 0 ? (passwordsMatch ? "border-emerald-500/50 focus-visible:ring-emerald-500/30" : "border-destructive/50 focus-visible:ring-destructive/30") : ""}
              />
              {confirmPassword.length > 0 && (
                <p className={`text-xs font-semibold flex items-center gap-1 ${passwordsMatch ? "text-emerald-500" : "text-destructive"}`}>
                  {passwordsMatch ? <CheckCircle className="h-3.5 w-3.5" /> : null}
                  {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                </p>
              )}
            </div>
          </div>
          <Button type="submit" disabled={savingPassword || (confirmPassword.length > 0 && !passwordsMatch)}>
            {savingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Update Password
          </Button>
        </form>

        {/* ── Referral Program ── */}
        <div className="glass-card overflow-hidden">
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-blue-600/10" />
              <div className="absolute -top-10 -left-10 w-56 h-56 bg-primary/20 rounded-full blur-3xl" />
              <div className="p-6 sm:p-8 relative">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <Gift className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Referral Program</h2>
                    <p className="text-muted-foreground text-sm">Earn ₦2,000 for every friend you refer</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {/* How it works */}
              <div className="rounded-xl bg-primary/5 border border-primary/15 p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">How it works</p>
                <div className="space-y-2.5">
                  {[
                    { step: "1", text: "Share your unique referral link with friends" },
                    { step: "2", text: "They sign up using your link" },
                    { step: "3", text: "Once they deposit a total of ₦10,000, you automatically receive ₦2,000 bonus in your wallet" },
                  ].map(({ step, text }) => (
                    <div key={step} className="flex items-start gap-3">
                      <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                        {step}
                      </span>
                      <p className="text-sm text-muted-foreground">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Referral link */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  Your Referral Link
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={referralLink}
                    readOnly
                    className="font-mono text-xs bg-muted/30"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    className="flex-shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your code: <span className="font-mono font-bold text-foreground tracking-widest">{referral?.referral_code || "..."}</span>
                </p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="glass-card p-4 text-center">
                  <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-2">
                    <Users className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {referral?.total_referred ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Friends Referred</p>
                </div>

                <div className="glass-card p-4 text-center">
                  <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {referral?.qualified_referrals ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Qualified Deposits</p>
                </div>

                <div className="glass-card p-4 text-center">
                  <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-2">
                    <Gift className="h-4 w-4 text-amber-500" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {referral ? formatAmount(referral.total_bonus_earned) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total Bonus Earned</p>
                </div>
              </div>

              {/* Progress note */}
              {referral && referral.total_referred > referral.qualified_referrals && (
                <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    {referral.total_referred - referral.qualified_referrals} friend{referral.total_referred - referral.qualified_referrals !== 1 ? "s" : ""} still working towards ₦10,000 in deposits
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You'll automatically receive ₦2,000 for each one who reaches the threshold.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Security */}
          <div className="glass-card p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Security</h2>
            </div>

            {/* 2FA row — admin only */}
            {user?.is_staff && (
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                    <p className="text-xs text-muted-foreground">
                      {user.totp_enabled ? "Enabled — your account is protected with TOTP." : "Add an extra layer of security with an authenticator app."}
                    </p>
                  </div>
                  {user.totp_enabled ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => { setTwoFaPhase("disable"); setTwoFaCode(""); }}
                    >
                      <ShieldOff className="h-3.5 w-3.5" />
                      Disable
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setTwoFaPhase("setup")}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Enable 2FA
                    </Button>
                  )}
                </div>

                {/* Setup flow */}
                {twoFaPhase === "setup" && (
                  <div className="rounded-xl border border-border/50 bg-muted/20 p-5 space-y-4">
                    <p className="text-sm font-semibold text-foreground">Scan this QR code with your authenticator app</p>
                    <p className="text-xs text-muted-foreground">Use Google Authenticator, Authy, or any TOTP app.</p>
                    {twoFaQrDataUrl ? (
                      <div className="flex flex-col items-center gap-3">
                        <img src={twoFaQrDataUrl} alt="2FA QR code" className="rounded-lg border border-border/30 bg-white p-1" width={180} height={180} />
                        <p className="text-xs text-muted-foreground text-center">Can't scan? Enter this key manually:</p>
                        <code className="text-xs bg-muted/50 border border-border/30 rounded px-3 py-1.5 font-mono tracking-widest select-all">{twoFaSecret}</code>
                      </div>
                    ) : (
                      <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    )}
                    <form onSubmit={handle2faEnable} className="space-y-3 pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Enter the 6-digit code to confirm</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9 ]*"
                          maxLength={7}
                          placeholder="000 000"
                          value={twoFaCode}
                          onChange={(e) => setTwoFaCode(e.target.value)}
                          className="text-center font-mono tracking-widest"
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={twoFaLoading || twoFaCode.replace(/\s/g, "").length < 6} className="gap-1.5">
                          {twoFaLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                          Activate
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setTwoFaPhase("idle"); setTwoFaCode(""); setTwoFaSecret(""); setTwoFaQrDataUrl(""); }}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Disable flow */}
                {twoFaPhase === "disable" && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 space-y-3">
                    <p className="text-sm font-semibold text-foreground">Disable Two-Factor Authentication</p>
                    <p className="text-xs text-muted-foreground">Enter the current code from your authenticator app to confirm.</p>
                    <form onSubmit={handle2faDisable} className="space-y-3">
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9 ]*"
                        maxLength={7}
                        placeholder="000 000"
                        value={twoFaCode}
                        onChange={(e) => setTwoFaCode(e.target.value)}
                        className="text-center font-mono tracking-widest max-w-[160px]"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button type="submit" variant="destructive" size="sm" disabled={twoFaLoading || twoFaCode.replace(/\s/g, "").length < 6} className="gap-1.5">
                          {twoFaLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
                          Disable 2FA
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setTwoFaPhase("idle"); setTwoFaCode(""); }}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {!user?.is_staff && (
              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                  <p className="text-xs text-muted-foreground">Add an extra layer of security to your account</p>
                </div>
                <Button variant="outline" size="sm" disabled>Coming Soon</Button>
              </div>
            )}

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Active Sessions</p>
                <p className="text-xs text-muted-foreground">Manage your active sessions</p>
              </div>
              <Button variant="outline" size="sm" disabled>Coming Soon</Button>
            </div>
          </div>

      </div>
    </div>
  );
};

export default ProfilePage;
