import { Link } from "react-router-dom";
import {
  Users, Gift, Zap, ShoppingBag, DollarSign, Clock,
  ChevronRight, Crown, TrendingUp, ArrowUpRight, Package,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminStats } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";

const AdminDashboard = () => {
  const { formatAmount } = useCurrency();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchAdminStats,
  });

  const cards = [
    { label: "Total Users", value: stats?.users_count ?? "—", icon: Users, to: "/admin/users" },
    { label: "Total Orders", value: stats?.orders_count ?? "—", icon: ShoppingBag, to: "/admin/orders" },
    { label: "Revenue", value: stats ? formatAmount(stats.total_revenue) : "—", icon: DollarSign, to: "/admin/orders" },
    { label: "Pending Orders", value: stats?.pending_orders ?? "—", icon: Clock, to: "/admin/orders" },
    { label: "Active Gifts", value: stats?.active_gifts ?? "—", icon: Gift, to: "/admin/gifts" },
    { label: "Active Services", value: stats?.active_services ?? "—", icon: Zap, to: "/admin/services" },
  ];

  const quickActions = [
    { label: "Manage Users", desc: "View, edit, and manage user accounts, wallet balances, and permissions", icon: Users, to: "/admin/users" },
    { label: "Manage Gifts", desc: "Add, edit, or remove gift items from the catalog", icon: Gift, to: "/admin/gifts" },
    { label: "Manage Services", desc: "Configure social media boosting services and pricing", icon: Zap, to: "/admin/services" },
    { label: "Manage Orders", desc: "Review, update status, and process refunds for all orders", icon: Package, to: "/admin/orders" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 md:p-8 relative bg-primary">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/[0.03] -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-1/3 w-32 h-32 rounded-full bg-white/[0.03] translate-y-1/2" />
          <div className="relative flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
              <Crown className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-white/50 text-sm mt-0.5">Manage your platform, users, and services</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse">
              <div className="h-3 w-16 bg-muted rounded mb-4" />
              <div className="h-7 w-20 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <Link
              key={card.label}
              to={card.to}
              className="glass-card p-5 hover:border-primary/30 hover:shadow-lg transition-all duration-300 group relative overflow-hidden"
            >
              {/* Subtle gradient glow */}
              <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-primary opacity-10 group-hover:opacity-20 transition-opacity blur-xl" />

              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</span>
                  <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
                    <card.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUpRight className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">View details</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className="glass-card p-5 hover:border-primary/30 hover:shadow-lg transition-all duration-300 group flex items-start gap-4"
            >
              <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                <action.icon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground text-sm">{action.label}</h3>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
