// In dev, Vite proxy forwards /api to Django. In prod, same origin.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function getCsrfToken(): Promise<string> {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  if (match) return match[1];
  // Cookie not set yet — fetch it from the server
  try {
    await fetch(`${API_BASE}/csrf/`, { credentials: 'include' });
    const retry = document.cookie.match(/csrftoken=([^;]+)/);
    return retry ? retry[1] : '';
  } catch {
    return '';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const csrfToken = await getCsrfToken();
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken,
      ...(options.headers as Record<string, string> || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail || 'Something went wrong.');
  }

  if (res.status === 204) return {} as T;
  return res.json();
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// --- Auth ---

export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  phone: string;
  is_verified: boolean;
  is_staff: boolean;
  full_name: string;
  date_of_birth: string | null;
  created_at: string;
  referral_code: string;
  totp_enabled: boolean;
}

export function fetchMe() {
  return request<User>('/auth/me/');
}

export type LoginResult = User | { requires_2fa: true };

export function login(email: string, password: string, recaptcha_token?: string) {
  return request<LoginResult>('/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ email, password, recaptcha_token }),
  });
}

// 2FA (admin accounts)
export function fetch2faSetup() {
  return request<{ secret: string; otpauth_uri: string }>('/auth/2fa/setup/');
}
export function enable2fa(code: string) {
  return request<{ detail: string }>('/auth/2fa/enable/', { method: 'POST', body: JSON.stringify({ code }) });
}
export function disable2fa(code: string) {
  return request<{ detail: string }>('/auth/2fa/disable/', { method: 'POST', body: JSON.stringify({ code }) });
}
export function verify2faLogin(code: string) {
  return request<User>('/auth/2fa/verify/', { method: 'POST', body: JSON.stringify({ code }) });
}

export function register(data: {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  password: string;
  referral_code?: string;
}) {
  return request<User>('/auth/register/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface ReferralStats {
  referral_code: string;
  referral_link: string;
  total_referred: number;
  qualified_referrals: number;
  total_bonus_earned: number;
  bonus_per_referral: number;
  deposit_threshold: number;
}

export function fetchReferralStats() {
  return request<ReferralStats>('/referral/');
}

// --- Tickets ---

export interface Ticket {
  id: number;
  user_email: string;
  user_name: string;
  order_number: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  admin_response: string;
  created_at: string;
  updated_at: string;
}

export function fetchTickets() {
  return request<Ticket[]>('/tickets/');
}

export function createTicket(data: { subject: string; message: string; order_number?: string }) {
  return request<Ticket>('/tickets/', { method: 'POST', body: JSON.stringify(data) });
}

export function fetchAdminTickets(status?: string) {
  const qs = status ? `?status=${status}` : '';
  return request<Ticket[]>(`/admin/tickets/${qs}`);
}

export function updateAdminTicket(ticketId: number, data: { status?: string; admin_response?: string }) {
  return request<Ticket>(`/admin/tickets/${ticketId}/`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function logout() {
  return request<{ detail: string }>('/auth/logout/', { method: 'POST' });
}

export function verifyEmail(token: string) {
  return request<{ detail: string }>(`/auth/verify-email/?token=${encodeURIComponent(token)}`);
}

export function forgotPassword(email: string) {
  return request<{ detail: string }>('/auth/forgot-password/', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, new_password: string) {
  return request<{ detail: string }>('/auth/reset-password/', {
    method: 'POST',
    body: JSON.stringify({ token, new_password }),
  });
}

export function resendVerification() {
  return request<{ detail: string }>('/auth/resend-verification/', { method: 'POST' });
}

// --- Profile ---

export function updateProfile(data: { first_name?: string; last_name?: string; phone?: string }) {
  return request<User>('/profile/', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function changePassword(current_password: string, new_password: string) {
  return request<{ detail: string }>('/profile/password/', {
    method: 'POST',
    body: JSON.stringify({ current_password, new_password }),
  });
}

// --- Wallet ---

export interface Wallet {
  balance: string;
  currency: string;
  updated_at: string;
}

export interface Transaction {
  id: number;
  amount: string;
  transaction_type: 'credit' | 'debit' | 'refund';
  status: 'pending' | 'completed' | 'failed';
  description: string;
  reference: string | null;
  created_at: string;
}

export function fetchWallet() {
  return request<Wallet>('/wallet/');
}

export function fetchTransactions() {
  return request<Transaction[]>('/wallet/transactions/');
}

export function depositPaystack(amount: number, callback_url?: string) {
  return request<{ authorization_url: string; reference: string }>('/wallet/deposit/', {
    method: 'POST',
    body: JSON.stringify({ amount, callback_url }),
  });
}

export function verifyDeposit(reference: string) {
  return request<{ detail: string; wallet: Wallet }>(`/wallet/verify/?reference=${reference}`);
}

// --- Orders ---

export interface Order {
  id: number;
  service_type: string;
  service_name: string;
  amount: string;
  status: string;
  external_order_id: string;
  external_data: Record<string, string | number | Record<string, string>>;
  result: string;
  tracking_code: string;
  tracking_url: string;
  created_at: string;
  updated_at: string;
}

export function fetchOrders(type?: string) {
  const params = type ? `?type=${type}` : '';
  return request<Order[]>(`/orders/${params}`);
}

export function fetchOrder(id: number) {
  return request<Order>(`/orders/${id}/`);
}

export function placeGiftOrder(data: {
  gift_id?: number;
  gift_name: string;
  amount: number;
  recipient_name: string;
  recipient_phone: string;
  delivery_address: string;
  sender_name: string;
}) {
  return request<{ detail: string; order: Order }>('/orders/gift/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// --- Boosting (RSS SMM Panel) ---

export interface BoostingService {
  id: number;
  name: string;
  type: string;
  category: string;
  rate_per_k_ngn: string;
  rate_per_k_usd: string;
  min: number;
  max: number;
  platform: string;
  refill: boolean;
  cancel: boolean;
}

export function fetchBoostingServices() {
  return request<BoostingService[]>('/boosting/services/');
}

export function placeBoostingOrder(data: {
  service_id: number;
  link: string;
  quantity: number;
}) {
  return request<{ detail: string; order: Order }>('/boosting/order/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function checkBoostingOrderStatus(orderId: number) {
  return request<Order & { rss_status?: Record<string, string> }>(
    `/boosting/order/${orderId}/status/`
  );
}

// --- Notifications ---

export interface Notification {
  id: number;
  notification_type: 'deposit' | 'withdrawal' | 'purchase' | 'order_update' | 'refund' | 'system';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unread_count: number;
}

export function fetchNotifications() {
  return request<NotificationsResponse>('/notifications/');
}

export function markNotificationsRead() {
  return request<{ detail: string }>('/notifications/read/', { method: 'POST' });
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  created_at: string;
}

export function fetchAnnouncements() {
  return request<Announcement[]>('/announcements/');
}

// --- Dashboard ---

export interface DashboardStats {
  balance: string;
  currency: string;
  total_orders: number;
  completed_orders: number;
  pending_orders: number;
  failed_orders: number;
  total_spent: string;
}

export function fetchDashboardStats() {
  return request<DashboardStats>('/dashboard/stats/');
}

// --- Admin API ---

export interface AdminStats {
  users_count: number;
  orders_count: number;
  total_revenue: string;
  pending_orders: number;
  active_gifts: number;
  active_services: number;
}

export interface AdminUser {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  is_verified: boolean;
  is_staff: boolean;
  is_active: boolean;
  wallet_balance: string;
  date_joined: string;
  orders_count: number;
}

export interface AdminUserDetail extends AdminUser {
  transactions: Transaction[];
  orders: Order[];
}

export interface AdminGift {
  id: number;
  name: string;
  description: string;
  price: string;
  buying_price: string | null;
  category: string;
  emoji: string;
  color: string;
  image_url: string;
  delivery_days: number;
  notes: string;
  rating: string;
  is_active: boolean;
  created_at: string;
}

export interface AdminBoostingService {
  id: number;
  name: string;
  platform: string;
  category: string;
  price_per_k: string;
  min_quantity: number;
  max_quantity: number;
  is_active: boolean;
  created_at: string;
}

export interface AdminOrder {
  id: number;
  user_email: string;
  user_id: number;
  service_type: string;
  service_name: string;
  amount: string;
  status: string;
  notes: string;
  result: string;
  tracking_code: string;
  tracking_url: string;
  external_data: Record<string, string | Record<string, string>>;
  created_at: string;
}

export function fetchAdminStats() {
  return request<AdminStats>('/admin/stats/');
}

export interface AnalyticsChartPoint { date: string; revenue?: number; profit?: number; orders?: number; users?: number; }
export interface ServiceBreakdown { service_type: string; count: number; revenue: number; }
export interface StatusBreakdown { status: string; count: number; }
export interface AnalyticsData {
  revenue_chart: AnalyticsChartPoint[];
  orders_chart: AnalyticsChartPoint[];
  users_chart: AnalyticsChartPoint[];
  service_breakdown: ServiceBreakdown[];
  status_breakdown: StatusBreakdown[];
  this_month: { revenue: number; profit: number; orders: number; users: number };
  last_month: { revenue: number; profit: number; orders: number; users: number };
}

export function fetchAdminAnalytics() {
  return request<AnalyticsData>('/admin/analytics/');
}

export function fetchAdminUsers(search?: string) {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  return request<AdminUser[]>(`/admin/users/${params}`);
}

export function fetchAdminUser(id: number) {
  return request<AdminUserDetail>(`/admin/users/${id}/`);
}

export function updateAdminUser(id: number, data: Record<string, unknown>) {
  return request<{ detail: string }>(`/admin/users/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function creditAdminUser(id: number, amount: number, description: string) {
  return request<{ detail: string; balance: string }>(`/admin/users/${id}/credit/`, {
    method: 'POST',
    body: JSON.stringify({ amount, description }),
  });
}

export function fetchAdminGifts() {
  return request<AdminGift[]>('/admin/gifts/');
}

export function createAdminGift(data: Record<string, unknown>) {
  return request<{ id: number; detail: string }>('/admin/gifts/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAdminGift(id: number, data: Record<string, unknown>) {
  return request<{ detail: string }>(`/admin/gifts/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteAdminGift(id: number) {
  return request<{ detail: string }>(`/admin/gifts/${id}/`, { method: 'DELETE' });
}

export function fetchAdminBoostingServices() {
  return request<AdminBoostingService[]>('/admin/services/');
}

export function createAdminBoostingService(data: Record<string, unknown>) {
  return request<{ id: number; detail: string }>('/admin/services/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAdminBoostingService(id: number, data: Record<string, unknown>) {
  return request<{ detail: string }>(`/admin/services/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteAdminBoostingService(id: number) {
  return request<{ detail: string }>(`/admin/services/${id}/`, { method: 'DELETE' });
}

export function fetchAdminOrders(params?: string) {
  return request<AdminOrder[]>(`/admin/orders/${params ? '?' + params : ''}`);
}

export interface AdminDeposit {
  id: number;
  user_email: string;
  user_id: number;
  user_name: string;
  amount: string;
  description: string;
  reference: string;
  method: string;
  status: string;
  created_at: string;
}

export function fetchAdminDeposits() {
  return request<AdminDeposit[]>('/admin/deposits/');
}

export function updateAdminOrder(id: number, data: Record<string, unknown>) {
  return request<{ detail: string }>(`/admin/orders/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export interface CreateOrderPayload {
  user_id: number;
  service_type: string;
  service_name: string;
  amount: number;
  deduct_wallet: boolean;
  notes?: string;
  status?: string;
  result?: string;
}

export function adminCreateOrder(data: CreateOrderPayload) {
  return request<{ detail: string; order_id: number; status: string }>('/admin/orders/create/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function debitAdminUser(id: number, amount: number, description: string) {
  return request<{ detail: string; balance: string }>(`/admin/users/${id}/debit/`, {
    method: 'POST',
    body: JSON.stringify({ amount, description }),
  });
}

export function deleteAdminUser(id: number) {
  return request<{ detail: string }>(`/admin/users/${id}/delete/`, { method: 'DELETE' });
}

export function sendAdminEmail(data: {
  subject: string;
  html_body: string;
  recipient_type: 'all' | 'selected';
  user_ids?: number[];
}) {
  return request<{ detail: string; sent: number; failed: number }>('/admin/email/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// --- Admin Social Media Accounts ---

export interface AdminAccount {
  id: number;
  platform: string;
  service_name: string;
  description: string;
  price: string;
  buying_price: string | null;
  notes: string;
  required_fields: string[];
  is_active: boolean;
  created_at: string;
}

export function fetchAdminAccounts() {
  return request<AdminAccount[]>('/admin/accounts/');
}

export function createAdminAccount(data: Record<string, unknown>) {
  return request<{ id: number; detail: string }>('/admin/accounts/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAdminAccount(id: number, data: Record<string, unknown>) {
  return request<{ detail: string }>(`/admin/accounts/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteAdminAccount(id: number) {
  return request<{ detail: string }>(`/admin/accounts/${id}/`, { method: 'DELETE' });
}

// --- Admin Web Development Portfolio ---

export interface AdminWebDev {
  id: number;
  title: string;
  description: string;
  video_url: string;
  website_url: string;
  image_url: string;
  price: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

export function fetchAdminWebDev() {
  return request<AdminWebDev[]>('/admin/webdev/');
}

export function createAdminWebDev(data: Record<string, unknown>) {
  return request<{ id: number; detail: string }>('/admin/webdev/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAdminWebDev(id: number, data: Record<string, unknown>) {
  return request<{ detail: string }>(`/admin/webdev/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteAdminWebDev(id: number) {
  return request<{ detail: string }>(`/admin/webdev/${id}/`, { method: 'DELETE' });
}

// --- Platform Settings ---

export interface CryptoMethod {
  id: string;
  name: string;
  network: string;
  address: string;
}

export interface ApiKeyInfo {
  masked: string | null;
  source: 'database' | 'env' | 'not_set';
}

export interface PlatformSettings {
  boosting_markup_percent: string;
  numbers_markup_percent: string;
  usd_to_ngn_rate: string;
  crypto_usd_rate: string;
  crypto_methods: CryptoMethod[];
  api_keys: {
    paystack_secret: ApiKeyInfo;
    paystack_public: ApiKeyInfo;
    rss_api_key: ApiKeyInfo;
    smspool_api_key: ApiKeyInfo;
  };
}

export function fetchPlatformSettings() {
  return request<PlatformSettings>('/admin/settings/');
}

export function updatePlatformSettings(data: Record<string, unknown>) {
  return request<PlatformSettings & { detail: string }>('/admin/settings/', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export interface CryptoMethodsResponse {
  crypto_usd_rate: string;
  methods: CryptoMethod[];
}

export function fetchCryptoMethods() {
  return request<CryptoMethodsResponse>('/settings/crypto/');
}

export interface PublicSettings {
  whatsapp: string;
}

export function fetchPublicSettings() {
  return request<PublicSettings>('/settings/');
}

// --- Gifts (user-facing) ---

export interface GiftItem {
  id: number;
  name: string;
  description: string;
  price: string;
  category: string;
  category_display: string;
  emoji: string;
  color: string;
  image_url: string;
  delivery_days: number;
  notes: string;
  rating: string;
}

export function fetchGifts() {
  return request<GiftItem[]>('/gifts/');
}

export function fetchGift(id: number) {
  return request<GiftItem>(`/gifts/${id}/`);
}

// --- Web Development Portfolio (user-facing) ---

export interface WebDevItem {
  id: number;
  title: string;
  description: string;
  video_url: string;
  website_url: string;
  image_url: string;
  price: string;
  category: string;
}

export function fetchWebDevPortfolio() {
  return request<WebDevItem[]>('/webdev/');
}

// --- Crypto Deposits (user) ---

export interface CryptoDeposit {
  id: number;
  amount_usd: string | null;
  amount_ngn: string;
  crypto_name: string;
  transaction_hash: string;
  status: 'pending' | 'completed' | 'rejected';
  admin_note: string;
  created_at: string;
}

export function submitCryptoDeposit(data: {
  amount_usd?: number;
  amount_ngn: number;
  transaction_hash: string;
  crypto_name: string;
}) {
  return request<{ detail: string; id: number; status: string }>('/wallet/crypto-deposit/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function fetchMyCryptoDeposits() {
  return request<CryptoDeposit[]>('/wallet/crypto-deposits/');
}

// --- Crypto Deposits (admin) ---

export interface AdminCryptoDeposit {
  id: number;
  user_id: number;
  user_email: string;
  user_name: string;
  amount_usd: string | null;
  amount_ngn: string;
  crypto_name: string;
  transaction_hash: string;
  status: 'pending' | 'completed' | 'rejected';
  admin_note: string;
  created_at: string;
  updated_at: string;
}

export function fetchAdminCryptoDeposits(status?: string) {
  const qs = status ? `?status=${status}` : '';
  return request<AdminCryptoDeposit[]>(`/admin/crypto-deposits/${qs}`);
}

export function actionAdminCryptoDeposit(id: number, action: 'confirm' | 'reject', admin_note?: string) {
  return request<{ detail: string }>(`/admin/crypto-deposits/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ action, admin_note }),
  });
}

// --- Social Media Accounts ---

export interface SocialMediaAccountListing {
  id: number;
  platform: string;
  service_name: string;
  description: string;
  price: string;
  notes: string;
  required_fields: string[];
}

export function fetchAccounts() {
  return request<SocialMediaAccountListing[]>('/accounts/');
}

export function placeAccountOrder(data: {
  account_id: number;
  user_details: Record<string, string>;
}) {
  return request<{ detail: string; order_id: number }>('/accounts/order/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// --- Numbers (SMSPool) ---

export interface SMSCountry {
  id: string;
  name: string;
  short_name: string;
  dial_code: string;
}

export interface SMSService {
  id: string;
  name: string;
  short_name: string;
}

export interface SMSPrice {
  price_ngn: string;
  price_usd: string;
  success_rate: string;
}

export interface SMSOrderResult {
  detail: string;
  order: Order;
  phone_number: string;
}

export interface SMSStatusResult extends Order {
  sms_code: string | null;
  phone_number: string;
}

export function fetchSMSCountries() {
  return request<SMSCountry[]>('/numbers/countries/');
}

export function fetchSMSServices() {
  return request<SMSService[]>('/numbers/services/');
}

export function fetchSMSPrice(country: string, service: string) {
  return request<SMSPrice>('/numbers/price/', {
    method: 'POST',
    body: JSON.stringify({ country, service }),
  });
}

export function purchaseSMSNumber(data: { country: string; service: string; service_name: string; country_name: string; country_short_name?: string; dial_code?: string }) {
  return request<SMSOrderResult>('/numbers/order/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function checkSMSStatus(orderId: number) {
  return request<SMSStatusResult>(`/numbers/order/${orderId}/status/`);
}

export function cancelSMSOrder(orderId: number) {
  return request<{ detail: string }>(`/numbers/order/${orderId}/cancel/`, {
    method: 'POST',
  });
}

// --- Security (IP logs & bans) ---

export interface IPLogEntry {
  id: number;
  ip_address: string;
  action: 'login_ok' | 'login_fail' | 'register';
  user_email: string | null;
  user_id: number | null;
  user_agent: string;
  created_at: string;
}

export interface BannedIP {
  id: number;
  ip_address: string;
  reason: string;
  banned_by: string;
  created_at: string;
}

export function fetchIPLogs(ip?: string) {
  const qs = ip ? `?ip=${encodeURIComponent(ip)}` : '';
  return request<IPLogEntry[]>(`/admin/ip-logs/${qs}`);
}

export function fetchBannedIPs() {
  return request<BannedIP[]>('/admin/banned-ips/');
}

export function banIP(ip_address: string, reason?: string) {
  return request<{ detail: string; id: number }>('/admin/banned-ips/', {
    method: 'POST',
    body: JSON.stringify({ ip_address, reason }),
  });
}

export function unbanIP(ban_id: number) {
  return request<{ detail: string }>(`/admin/banned-ips/${ban_id}/`, {
    method: 'DELETE',
  });
}

// --- Service Catalog (synced from external APIs) ---

export interface CatalogBoostingService {
  id: number;
  external_id: number;
  name: string;
  service_type: string;
  platform: string;
  category: string;
  cost_per_k_ngn: string;
  min_quantity: number;
  max_quantity: number;
  refill: boolean;
  cancel: boolean;
  is_active: boolean;
  last_synced: string;
}

export interface CatalogSMSCountry {
  id: number;
  external_id: string;
  name: string;
  short_name: string;
  dial_code: string;
  is_active: boolean;
  last_synced: string;
}

export interface CatalogSMSService {
  id: number;
  external_id: string;
  name: string;
  short_name: string;
  is_active: boolean;
  last_synced: string;
}

export function fetchCatalogBoostingServices(platform?: string) {
  const qs = platform ? `?platform=${encodeURIComponent(platform)}` : '';
  return request<CatalogBoostingService[]>(`/admin/catalog/boosting/${qs}`);
}

export function toggleCatalogBoostingService(id: number, is_active: boolean) {
  return request<{ id: number; is_active: boolean }>(`/admin/catalog/boosting/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active }),
  });
}

export function fetchCatalogSMSCountries() {
  return request<CatalogSMSCountry[]>('/admin/catalog/sms-countries/');
}

export function toggleCatalogSMSCountry(id: number, is_active: boolean) {
  return request<{ id: number; is_active: boolean }>(`/admin/catalog/sms-countries/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active }),
  });
}

export function fetchCatalogSMSServices() {
  return request<CatalogSMSService[]>('/admin/catalog/sms-services/');
}

export function toggleCatalogSMSService(id: number, is_active: boolean) {
  return request<{ id: number; is_active: boolean }>(`/admin/catalog/sms-services/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active }),
  });
}

export function syncCatalog(target: 'boosting' | 'sms' | 'all') {
  return request<Record<string, string>>('/admin/catalog/sync/', {
    method: 'POST',
    body: JSON.stringify({ target }),
  });
}
