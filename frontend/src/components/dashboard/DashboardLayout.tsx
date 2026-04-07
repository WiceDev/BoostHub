import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, PlusCircle, ShoppingBag, LogOut,
  Bell, ChevronDown, ChevronRight, Menu, Zap, CreditCard, Package, RotateCcw, Info,
  Settings, ShieldCheck, ShieldAlert, Sun, Moon, Search,
  TrendingUp, Phone, UserCheck, Gift, Globe, Wallet, ArrowLeftRight, X,
  Users, Crown, AtSign, Mail, Bitcoin, ShieldX, BarChart2, MessageSquare, Database, Activity, Megaphone
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { logout as apiLogout, fetchWallet, fetchNotifications, markNotificationsRead, type NotificationsResponse } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/context/ThemeContext";
import { useCurrency } from "@/context/CurrencyContext";
import { toast } from "sonner";

const serviceItems = [
  { label: "Social Media Boosting", path: "/dashboard/boosting", icon: TrendingUp },
  { label: "Verification Numbers", path: "/dashboard/numbers", icon: Phone },
  { label: "Social Media Accounts", path: "/dashboard/accounts", icon: UserCheck },
  { label: "Send Gifts", path: "/dashboard/gifts", icon: Gift },
  { label: "Web Development", path: "/dashboard/webdev", icon: Globe },
];

const notificationIcons: Record<string, typeof CreditCard> = {
  deposit: CreditCard,
  withdrawal: ArrowLeftRight,
  purchase: ShoppingBag,
  order_update: Package,
  refund: RotateCcw,
  system: Info,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [servicesExpanded, setServicesExpanded] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, handleLogout: authLogout } = useAuth();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const { formatAmount, currency, setCurrency } = useCurrency();
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const walletDropdownRef = useRef<HTMLDivElement>(null);

  const isAdminRoute = location.pathname.startsWith("/admin");

  // Only fetch wallet/notifications for user dashboard, not admin
  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: fetchWallet,
    refetchInterval: 30000,
    enabled: !isAdminRoute,
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    enabled: !isAdminRoute,
    staleTime: Infinity, // SSE keeps it fresh — no background refetching needed
  });

  const notifications = notifData?.notifications || [];
  const unreadCount = notifData?.unread_count || 0;

  // ── Real-time notifications via Server-Sent Events ──────────────────────
  useEffect(() => {
    if (isAdminRoute || !user) return;

    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      es = new EventSource('/api/notifications/stream/', { withCredentials: true });

      // Connection confirmed — do one fresh fetch to sync any missed notifications
      es.addEventListener('ping', () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      });

      // New notification pushed from server
      es.addEventListener('notification', (e: MessageEvent) => {
        try {
          const notif = JSON.parse(e.data);

          // Prepend to cached list and bump unread count
          queryClient.setQueryData(['notifications'], (old: NotificationsResponse | undefined) => {
            if (!old) return old;
            const already = old.notifications.some((n) => n.id === notif.id);
            if (already) return old;
            return {
              notifications: [notif, ...old.notifications].slice(0, 10),
              unread_count: old.unread_count + 1,
            };
          });

          // Pop a toast so the user is alerted even when the panel is closed
          toast.info(notif.title, {
            description: notif.message,
            duration: 5000,
          });
        } catch { /* ignore malformed event */ }
      });

      es.onerror = () => {
        es?.close();
        // Reconnect after 5 s — browser also auto-retries but this is explicit
        retryTimeout = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      es?.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [isAdminRoute, user, queryClient]);

  useEffect(() => {
    if (serviceItems.some((s) => location.pathname === s.path)) {
      setServicesExpanded(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(e.target as Node)) setWalletDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotifToggle = () => {
    const opening = !notifOpen;
    setNotifOpen(opening);
    if (opening && unreadCount > 0) {
      markNotificationsRead().then(() => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      });
    }
  };

  const onLogout = async () => {
    try { await apiLogout(); } catch { /* clear local state anyway */ }
    queryClient.clear();
    authLogout();
    document.cookie = "sessionid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    navigate("/login", { replace: true });
  };

  const initials = user
    ? `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase() || user.email[0].toUpperCase()
    : "?";

  const balanceDisplay = wallet ? formatAmount(wallet.balance) : "...";
  const isServicePage = serviceItems.some((s) => location.pathname === s.path);

  const NavLink = ({ to, icon: Icon, label, indent = false }: { to: string; icon: typeof LayoutDashboard; label: string; indent?: boolean }) => {
    const isActive = location.pathname === to;
    return (
      <Link
        to={to}
        onClick={() => setMobileSidebarOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 group ${
          indent ? "ml-5 pl-4" : ""
        } ${
          isActive
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
      >
        <Icon className={`h-[18px] w-[18px] flex-shrink-0 transition-colors ${isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"}`} />
        {sidebarOpen && <span>{label}</span>}
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-[70px] flex items-center gap-3 px-5 flex-shrink-0 border-b border-border/50">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg bg-primary shadow-primary/20">
          {isAdminRoute ? <Crown className="h-5 w-5 text-white" /> : <Zap className="h-5 w-5 text-white" />}
        </div>
        {sidebarOpen && (
          <div>
            <span className="text-[15px] font-bold text-foreground tracking-tight">
              {isAdminRoute ? "PriveBoost" : "PriveBoost"}
            </span>
            <p className="text-[10px] text-muted-foreground -mt-0.5">
              {isAdminRoute ? "Admin Panel" : "SMM Panel"}
            </p>
          </div>
        )}
      </div>

      {/* Mobile-only: user name + balance banner */}
      {!isAdminRoute && (
        <div className="md:hidden px-4 py-4 border-b border-border/50 bg-gradient-to-br from-primary/10 via-primary/5 to-blue-600/5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-bold text-foreground truncate">
              Hello {user?.first_name || user?.email?.split("@")[0]}
            </p>
            <div className="flex-shrink-0 text-right">
              <p className="text-[11px] text-muted-foreground">Available Balance</p>
              <p className="text-base font-bold text-foreground">{balanceDisplay}</p>
            </div>
          </div>
          <Link to="/dashboard/deposit" onClick={() => setMobileSidebarOpen(false)}
            className="mt-3 flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-primary text-white text-xs font-semibold shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors">
            <PlusCircle className="h-3.5 w-3.5" /> Add Funds
          </Link>
        </div>
      )}

      {/* Navigation — scrollable middle section */}
      <nav className="flex-1 py-5 px-3 space-y-1 overflow-y-auto min-h-0">
        {isAdminRoute ? (
          /* ─── Admin Sidebar ─── */
          <>
            {sidebarOpen && (
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 font-semibold px-3 mb-3">Management</p>
            )}
            <NavLink to="/admin" icon={Crown} label="Dashboard" />
            <NavLink to="/admin/analytics" icon={BarChart2} label="Analytics" />
            <NavLink to="/admin/users" icon={Users} label="Manage Users" />
            <NavLink to="/admin/gifts" icon={Gift} label="Manage Gifts" />
            <NavLink to="/admin/services" icon={Zap} label="Manage Services" />
            <NavLink to="/admin/catalog" icon={Database} label="Service Catalog" />
            <NavLink to="/admin/api-logs" icon={Activity} label="API Logs" />
            <NavLink to="/admin/accounts" icon={AtSign} label="Social Accounts" />
            <NavLink to="/admin/webdev" icon={Globe} label="Web Dev Portfolio" />
            <NavLink to="/admin/orders" icon={Package} label="Manage Orders" />
            <NavLink to="/admin/deposits" icon={Bitcoin} label="Manage Deposits" />
            <NavLink to="/admin/security" icon={ShieldX} label="Security" />
            <NavLink to="/admin/tickets" icon={MessageSquare} label="Support Tickets" />
            <NavLink to="/admin/announcements" icon={Megaphone} label="Announcements" />
            <NavLink to="/admin/email" icon={Mail} label="Send Email" />
            <NavLink to="/admin/settings" icon={Settings} label="Settings" />
            <NavLink to="/admin/profile" icon={ShieldCheck} label="My Profile & 2FA" />
          </>
        ) : (
          /* ─── User Sidebar ─── */
          <>
            {sidebarOpen && (
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 font-semibold px-3 mb-3">Main Menu</p>
            )}

            <NavLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" />

            {/* Services dropdown */}
            <div>
              <button
                onClick={() => setServicesExpanded(!servicesExpanded)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 w-full group ${
                  isServicePage ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <ShoppingBag className={`h-[18px] w-[18px] flex-shrink-0 transition-colors ${isServicePage ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"}`} />
                {sidebarOpen && (
                  <>
                    <span className="flex-1 text-left">Services</span>
                    <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 opacity-50 ${servicesExpanded ? "rotate-90" : ""}`} />
                  </>
                )}
              </button>

              {servicesExpanded && sidebarOpen && (
                <div className="mt-1 space-y-0.5 relative">
                  <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
                  {serviceItems.map((item) => (
                    <NavLink key={item.path} to={item.path} icon={item.icon} label={item.label} indent />
                  ))}
                </div>
              )}
            </div>

            <NavLink to="/dashboard/orders" icon={Package} label="Orders" />
            <NavLink to="/dashboard/deposit" icon={PlusCircle} label="Add Funds" />

            {sidebarOpen && (
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 font-semibold px-3 mt-7 mb-3">Account</p>
            )}

            <NavLink to="/dashboard/profile" icon={Settings} label="Settings" />
            <NavLink to="/dashboard/tickets" icon={MessageSquare} label="Support" />
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div className="p-3 flex-shrink-0 border-t border-border/50">
        {sidebarOpen && (
          <div className="rounded-xl bg-muted/30 p-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-md bg-primary shadow-primary/20">
                {isAdminRoute ? <Crown className="h-4 w-4" /> : initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground truncate">
                  {isAdminRoute ? "Administrator" : (user?.first_name || user?.email?.split("@")[0])}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {isAdminRoute ? user?.email : user?.email}
                </p>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 w-full"
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
          {sidebarOpen && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-3">
      {/* Single unified panel — rounded outer edges only */}
      <div className="flex h-[calc(100vh-1.5rem)] rounded-2xl overflow-hidden border border-border/50 bg-muted/[0.02]">

        {/* Desktop Sidebar */}
        <div className={`hidden md:flex flex-col flex-shrink-0 transition-all duration-300 ${sidebarOpen ? "w-[268px]" : "w-[76px]"} border-r border-border/50`}>
          <SidebarContent />
        </div>

        {/* Mobile Sidebar Overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
            <div className="relative h-full w-[270px] p-3 flex flex-col">
              <aside className="flex flex-col w-full h-full rounded-2xl overflow-hidden border border-border/50 bg-background">
                <button onClick={() => setMobileSidebarOpen(false)} className="absolute top-7 right-6 text-muted-foreground hover:text-foreground z-10">
                  <X className="h-5 w-5" />
                </button>
                <SidebarContent />
              </aside>
            </div>
          </div>
        )}

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Header */}
          <header className="h-[70px] bg-transparent border-b border-border/50 flex items-center justify-between px-3 sm:px-4 lg:px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (window.innerWidth < 768) setMobileSidebarOpen(!mobileSidebarOpen);
                else setSidebarOpen(!sidebarOpen);
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>

            {isAdminRoute ? (
              /* Admin header label */
              <span className="hidden md:block text-sm font-medium text-muted-foreground">Platform Administration</span>
            ) : (
              /* User search bar */
              <div className="hidden md:flex items-center gap-2 bg-muted/50 rounded-xl px-4 py-2 w-64">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search services..."
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {isAdminRoute ? (
              /* Admin header — just badge + theme + logout */
              <>
                <div className="flex items-center gap-2 px-3 py-2 sm:px-4 rounded-xl bg-primary/10 text-primary text-xs sm:text-sm font-semibold">
                  <Crown className="h-4 w-4" />
                  <span className="hidden sm:inline">Admin</span>
                </div>

                <button onClick={toggleTheme}
                  className="h-10 w-10 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                  {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
                </button>

                <button
                  onClick={onLogout}
                  className="h-10 px-4 rounded-xl bg-muted/30 flex items-center justify-center gap-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium"
                >
                  <LogOut className="h-[18px] w-[18px]" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              /* User header — wallet, theme, notifications, profile */
              <>
                {/* Balance pill */}
                <div className="relative" ref={walletDropdownRef}>
                  <button
                    onClick={() => setWalletDropdownOpen(!walletDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-2 sm:px-4 rounded-xl bg-primary/10 text-primary text-xs sm:text-sm font-semibold hover:bg-primary/15 transition-colors"
                  >
                    <Wallet className="h-4 w-4" />
                    <span className="hidden sm:inline">{balanceDisplay}</span>
                    <ChevronDown className={`h-3 w-3 transition-transform ${walletDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {walletDropdownOpen && (
                    <div className="absolute right-0 top-12 w-56 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in">
                      <div className="px-4 py-3 border-b border-border/50">
                        <p className="text-[10px] text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Currency</p>
                        <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
                          <button
                            onClick={() => { setCurrency("NGN"); setWalletDropdownOpen(false); }}
                            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${currency === "NGN" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                          >₦ NGN</button>
                          <button
                            onClick={() => { setCurrency("USD"); setWalletDropdownOpen(false); }}
                            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${currency === "USD" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                          >$ USD</button>
                        </div>
                      </div>
                      <Link to="/dashboard/deposit" onClick={() => setWalletDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted/30 transition-colors">
                        <PlusCircle className="h-4 w-4 text-muted-foreground" />
                        Add Funds
                      </Link>
                    </div>
                  )}
                </div>

                {/* Theme toggle */}
                <button onClick={toggleTheme}
                  className="h-10 w-10 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                  {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
                </button>

                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                  <button onClick={handleNotifToggle}
                    className="relative h-10 w-10 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                    <Bell className="h-[18px] w-[18px]" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-80 sm:max-w-sm bg-card border border-border/50 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in">
                      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                        <h3 className="font-semibold text-foreground text-sm">Notifications</h3>
                        {notifications.length > 0 && (
                          <span className="text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">{notifications.length} recent</span>
                        )}
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-12 text-center">
                            <Bell className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No notifications yet</p>
                          </div>
                        ) : (
                          notifications.map((notif) => {
                            const Icon = notificationIcons[notif.notification_type] || Info;
                            return (
                              <div key={notif.id}
                                className={`px-4 py-3 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors ${!notif.is_read ? "bg-primary/5" : ""}`}>
                                <div className="flex gap-3">
                                  <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Icon className="h-4 w-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-sm font-medium text-foreground truncate">{notif.title}</p>
                                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(notif.created_at)}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile avatar */}
                <div className="relative" ref={profileRef}>
                  <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white text-xs font-bold shadow-md shadow-primary/20">{initials}</div>
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 top-12 w-72 bg-card border border-border/50 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in">
                      <div className="px-4 py-4 border-b border-border/50">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-md shadow-primary/20">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{user?.full_name || user?.email}</p>
                            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                          </div>
                        </div>
                        <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${
                          user?.is_verified ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                        }`}>
                          {user?.is_verified ? (
                            <><ShieldCheck className="h-3.5 w-3.5" />Email verified</>
                          ) : (
                            <>
                              <ShieldAlert className="h-3.5 w-3.5" />
                              Email not verified
                              <button className="ml-auto underline hover:no-underline" onClick={() => { setProfileOpen(false); navigate("/dashboard/profile"); }}>Verify</button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="py-1">
                        <button onClick={() => { setProfileOpen(false); navigate("/dashboard/profile"); }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted/30 transition-colors">
                          <Settings className="h-4 w-4 text-muted-foreground" /> Profile Settings
                        </button>
                        <button onClick={() => { setProfileOpen(false); navigate("/dashboard/orders"); }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted/30 transition-colors">
                          <ShoppingBag className="h-4 w-4 text-muted-foreground" /> My Orders
                        </button>
                        <button onClick={() => { setProfileOpen(false); navigate("/dashboard/deposit"); }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted/30 transition-colors">
                          <PlusCircle className="h-4 w-4 text-muted-foreground" /> Add Funds
                        </button>
                      </div>
                      <div className="border-t border-border/50 py-1">
                        <button onClick={() => { setProfileOpen(false); onLogout(); }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-destructive hover:bg-destructive/5 transition-colors">
                          <LogOut className="h-4 w-4" /> Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </header>

          {/* Content */}
          <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto min-w-0">
            <div className="max-w-[1400px] mx-auto">
              {children}
            </div>
          </main>
        </div>

      </div>
    </div>
  );
};

export default DashboardLayout;
