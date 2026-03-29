import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import WebDevelopment from "./pages/WebDevelopment";
import Services from "./pages/Services";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import DepositPage from "./pages/dashboard/DepositPage";
import BoostingPage from "./pages/dashboard/BoostingPage";
import NumbersPage from "./pages/dashboard/NumbersPage";
import OrdersPage from "./pages/dashboard/OrdersPage";
import ProfilePage from "./pages/dashboard/ProfilePage";
import GiftsPage from "./pages/dashboard/GiftsPage";
import GiftCheckoutPage from "./pages/dashboard/GiftCheckoutPage";
import WebDevPage from "./pages/dashboard/WebDevPage";
import AccountsPage from "./pages/dashboard/AccountsPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminGiftsPage from "./pages/admin/AdminGiftsPage";
import AdminServicesPage from "./pages/admin/AdminServicesPage";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminAccountsPage from "./pages/admin/AdminAccountsPage";
import AdminWebDevPage from "./pages/admin/AdminWebDevPage";
import AdminEmailPage from "./pages/admin/AdminEmailPage";
import AdminDepositsPage from "./pages/admin/AdminDepositsPage";
import AdminSecurityPage from "./pages/admin/AdminSecurityPage";
import AdminAnalyticsPage from "./pages/admin/AdminAnalyticsPage";
import TicketsPage from "./pages/dashboard/TicketsPage";
import AdminTicketsPage from "./pages/admin/AdminTicketsPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, refreshUser } = useAuth();

  // Re-verify auth every time a protected route is accessed
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_verified && !user.is_staff) return <Navigate to="/verify-email" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, refreshUser } = useAuth();

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_staff) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={user.is_staff ? "/admin" : "/dashboard"} replace />;
  return <>{children}</>;
}

const App = () => (
  <ThemeProvider>
  <CurrencyProvider>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/services" element={<Services />} />
            <Route path="/web-development" element={<WebDevelopment />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout><DashboardHome /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/wallet" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard/deposit" element={<ProtectedRoute><DashboardLayout><DepositPage /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/boosting" element={<ProtectedRoute><DashboardLayout><BoostingPage /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/numbers" element={<ProtectedRoute><DashboardLayout><NumbersPage /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/accounts" element={<ProtectedRoute><DashboardLayout><AccountsPage /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/webdev" element={<ProtectedRoute><DashboardLayout><WebDevPage /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/gifts" element={<ProtectedRoute><DashboardLayout><GiftsPage /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/gifts/checkout/:id" element={<ProtectedRoute><DashboardLayout><GiftCheckoutPage /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/orders" element={<ProtectedRoute><DashboardLayout><OrdersPage /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/profile" element={<ProtectedRoute><DashboardLayout><ProfilePage /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/tickets" element={<ProtectedRoute><DashboardLayout><TicketsPage /></DashboardLayout></ProtectedRoute>} />
            {/* Admin routes */}
            <Route path="/admin" element={<AdminRoute><DashboardLayout><AdminDashboard /></DashboardLayout></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><DashboardLayout><AdminUsersPage /></DashboardLayout></AdminRoute>} />
            <Route path="/admin/gifts" element={<AdminRoute><DashboardLayout><AdminGiftsPage /></DashboardLayout></AdminRoute>} />
            <Route path="/admin/services" element={<AdminRoute><DashboardLayout><AdminServicesPage /></DashboardLayout></AdminRoute>} />
            <Route path="/admin/orders" element={<AdminRoute><DashboardLayout><AdminOrdersPage /></DashboardLayout></AdminRoute>} />
            <Route path="/admin/accounts" element={<AdminRoute><DashboardLayout><AdminAccountsPage /></DashboardLayout></AdminRoute>} />
            <Route path="/admin/webdev" element={<AdminRoute><DashboardLayout><AdminWebDevPage /></DashboardLayout></AdminRoute>} />
            <Route path="/admin/email" element={<AdminRoute><DashboardLayout><AdminEmailPage /></DashboardLayout></AdminRoute>} />
            <Route path="/admin/deposits" element={<AdminRoute><DashboardLayout><AdminDepositsPage /></DashboardLayout></AdminRoute>} />
            <Route path="/admin/security" element={<AdminRoute><DashboardLayout><AdminSecurityPage /></DashboardLayout></AdminRoute>} />
            <Route path="/admin/analytics" element={<AdminRoute><DashboardLayout><AdminAnalyticsPage /></DashboardLayout></AdminRoute>} />
            <Route path="/admin/settings" element={<AdminRoute><DashboardLayout><AdminSettingsPage /></DashboardLayout></AdminRoute>} />
            <Route path="/admin/tickets" element={<AdminRoute><DashboardLayout><AdminTicketsPage /></DashboardLayout></AdminRoute>} />
            <Route path="/admin/profile" element={<AdminRoute><DashboardLayout><ProfilePage /></DashboardLayout></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  </CurrencyProvider>
  </ThemeProvider>
);

export default App;
