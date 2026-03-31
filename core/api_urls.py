from django.urls import path
from django.middleware.csrf import get_token
from django.http import JsonResponse
from users.api_views import (
    api_register, api_login, api_logout, api_me,
    api_update_profile, api_change_password,
    api_verify_email, api_resend_verification,
    api_forgot_password, api_reset_password,
    api_referral_stats,
    api_2fa_setup, api_2fa_enable, api_2fa_disable, api_2fa_verify_login,
)
from wallet.api_views import (
    api_wallet, api_transactions, api_deposit_paystack, api_verify_deposit,
    api_submit_crypto_deposit, api_my_crypto_deposits,
)
from orders.api_views import api_orders, api_order_detail, api_dashboard_stats, api_place_gift_order
from tickets.api_views import api_tickets, admin_tickets, admin_ticket_update
from services.api_views import (
    api_accounts_list, api_place_account_order,
    api_gifts, api_gift_detail, api_webdev_portfolio, api_public_settings,
)
from notifications.api_views import api_notifications, api_mark_notifications_read, sse_notifications, api_announcements
from api_integrations.api_views import api_boosting_services, api_boosting_order, api_boosting_order_status
from api_integrations.smspool_views import (
    api_numbers_countries, api_numbers_services, api_numbers_price,
    api_numbers_order, api_numbers_order_status, api_numbers_cancel,
)
from core.admin_api_views import (
    admin_stats, admin_analytics, admin_users, admin_user_detail, admin_user_credit,
    admin_user_debit, admin_user_delete,
    admin_gifts, admin_gift_detail,
    admin_boosting_services, admin_boosting_service_detail,
    admin_orders, admin_order_update, admin_create_order,
    admin_platform_settings,
    admin_accounts, admin_account_detail,
    admin_webdev, admin_webdev_detail,
    admin_send_email,
    public_crypto_methods,
    admin_deposits,
    admin_crypto_deposits,
    admin_crypto_deposit_action,
    admin_ip_logs,
    admin_banned_ips,
    admin_banned_ip_detail,
    admin_catalog_boosting, admin_catalog_boosting_detail,
    admin_catalog_sms_countries, admin_catalog_sms_country_detail,
    admin_catalog_sms_services, admin_catalog_sms_service_detail,
    admin_catalog_sync,
)


def api_csrf(request):
    """Return CSRF token and set the cookie."""
    return JsonResponse({'csrfToken': get_token(request)})


urlpatterns = [
    # CSRF
    path('csrf/', api_csrf, name='api_csrf'),

    # Auth
    path('auth/register/', api_register, name='api_register'),
    path('auth/login/', api_login, name='api_login'),
    path('auth/logout/', api_logout, name='api_logout'),
    path('auth/me/', api_me, name='api_me'),
    path('auth/verify-email/', api_verify_email, name='api_verify_email'),
    path('auth/resend-verification/', api_resend_verification, name='api_resend_verification'),
    path('auth/forgot-password/', api_forgot_password, name='api_forgot_password'),
    path('auth/reset-password/', api_reset_password, name='api_reset_password'),

    # 2FA (admin accounts)
    path('auth/2fa/setup/',  api_2fa_setup,        name='api_2fa_setup'),
    path('auth/2fa/enable/', api_2fa_enable,        name='api_2fa_enable'),
    path('auth/2fa/disable/', api_2fa_disable,      name='api_2fa_disable'),
    path('auth/2fa/verify/', api_2fa_verify_login,  name='api_2fa_verify_login'),

    # Profile
    path('profile/', api_update_profile, name='api_update_profile'),
    path('profile/password/', api_change_password, name='api_change_password'),
    path('referral/', api_referral_stats, name='api_referral_stats'),

    # Wallet
    path('wallet/', api_wallet, name='api_wallet'),
    path('wallet/transactions/', api_transactions, name='api_transactions'),
    path('wallet/deposit/', api_deposit_paystack, name='api_deposit_paystack'),
    path('wallet/verify/', api_verify_deposit, name='api_verify_deposit'),
    path('wallet/crypto-deposit/', api_submit_crypto_deposit, name='api_submit_crypto_deposit'),
    path('wallet/crypto-deposits/', api_my_crypto_deposits, name='api_my_crypto_deposits'),

    # Orders
    path('orders/', api_orders, name='api_orders'),
    path('orders/gift/', api_place_gift_order, name='api_place_gift_order'),
    path('orders/<int:order_id>/', api_order_detail, name='api_order_detail'),

    # Boosting (RSS SMM panel)
    path('boosting/services/', api_boosting_services, name='api_boosting_services'),
    path('boosting/order/', api_boosting_order, name='api_boosting_order'),
    path('boosting/order/<int:order_id>/status/', api_boosting_order_status, name='api_boosting_order_status'),

    # Social Media Accounts
    path('accounts/', api_accounts_list, name='api_accounts_list'),
    path('accounts/order/', api_place_account_order, name='api_place_account_order'),

    # Numbers (SMSPool)
    path('numbers/countries/', api_numbers_countries, name='api_numbers_countries'),
    path('numbers/services/', api_numbers_services, name='api_numbers_services'),
    path('numbers/price/', api_numbers_price, name='api_numbers_price'),
    path('numbers/order/', api_numbers_order, name='api_numbers_order'),
    path('numbers/order/<int:order_id>/status/', api_numbers_order_status, name='api_numbers_order_status'),
    path('numbers/order/<int:order_id>/cancel/', api_numbers_cancel, name='api_numbers_cancel'),

    # Dashboard
    path('dashboard/stats/', api_dashboard_stats, name='api_dashboard_stats'),

    # Notifications
    path('notifications/', api_notifications, name='api_notifications'),
    path('notifications/stream/', sse_notifications, name='sse_notifications'),
    path('notifications/read/', api_mark_notifications_read, name='api_mark_notifications_read'),
    path('announcements/', api_announcements, name='api_announcements'),

    # Gifts
    path('gifts/', api_gifts, name='api_gifts'),
    path('gifts/<int:gift_id>/', api_gift_detail, name='api_gift_detail'),

    # Web Development Portfolio
    path('webdev/', api_webdev_portfolio, name='api_webdev_portfolio'),

    # Public settings
    path('settings/', api_public_settings, name='api_public_settings'),
    path('settings/crypto/', public_crypto_methods, name='public_crypto_methods'),

    # Admin API
    path('admin/stats/', admin_stats, name='admin_stats'),
    path('admin/analytics/', admin_analytics, name='admin_analytics'),
    path('admin/users/', admin_users, name='admin_users'),
    path('admin/users/<int:user_id>/', admin_user_detail, name='admin_user_detail'),
    path('admin/users/<int:user_id>/credit/', admin_user_credit, name='admin_user_credit'),
    path('admin/users/<int:user_id>/debit/', admin_user_debit, name='admin_user_debit'),
    path('admin/users/<int:user_id>/delete/', admin_user_delete, name='admin_user_delete'),
    path('admin/gifts/', admin_gifts, name='admin_gifts'),
    path('admin/gifts/<int:gift_id>/', admin_gift_detail, name='admin_gift_detail'),
    path('admin/services/', admin_boosting_services, name='admin_boosting_services'),
    path('admin/services/<int:service_id>/', admin_boosting_service_detail, name='admin_boosting_service_detail'),
    path('admin/orders/', admin_orders, name='admin_orders'),
    path('admin/orders/create/', admin_create_order, name='admin_create_order'),
    path('admin/orders/<int:order_id>/', admin_order_update, name='admin_order_update'),
    path('admin/settings/', admin_platform_settings, name='admin_platform_settings'),
    path('admin/accounts/', admin_accounts, name='admin_accounts'),
    path('admin/accounts/<int:account_id>/', admin_account_detail, name='admin_account_detail'),
    path('admin/webdev/', admin_webdev, name='admin_webdev'),
    path('admin/webdev/<int:item_id>/', admin_webdev_detail, name='admin_webdev_detail'),
    path('admin/email/', admin_send_email, name='admin_send_email'),
    path('admin/deposits/', admin_deposits, name='admin_deposits'),
    path('admin/crypto-deposits/', admin_crypto_deposits, name='admin_crypto_deposits'),
    path('admin/crypto-deposits/<int:deposit_id>/', admin_crypto_deposit_action, name='admin_crypto_deposit_action'),

    # Security
    path('admin/ip-logs/', admin_ip_logs, name='admin_ip_logs'),
    path('admin/banned-ips/', admin_banned_ips, name='admin_banned_ips'),
    path('admin/banned-ips/<int:ban_id>/', admin_banned_ip_detail, name='admin_banned_ip_detail'),

    # Tickets
    path('tickets/', api_tickets, name='api_tickets'),
    path('admin/tickets/', admin_tickets, name='admin_tickets'),
    path('admin/tickets/<int:ticket_id>/', admin_ticket_update, name='admin_ticket_update'),

    # Service Catalog (synced from external APIs)
    path('admin/catalog/boosting/', admin_catalog_boosting, name='admin_catalog_boosting'),
    path('admin/catalog/boosting/<int:service_id>/', admin_catalog_boosting_detail, name='admin_catalog_boosting_detail'),
    path('admin/catalog/sms-countries/', admin_catalog_sms_countries, name='admin_catalog_sms_countries'),
    path('admin/catalog/sms-countries/<int:country_id>/', admin_catalog_sms_country_detail, name='admin_catalog_sms_country_detail'),
    path('admin/catalog/sms-services/', admin_catalog_sms_services, name='admin_catalog_sms_services'),
    path('admin/catalog/sms-services/<int:sms_service_id>/', admin_catalog_sms_service_detail, name='admin_catalog_sms_service_detail'),
    path('admin/catalog/sync/', admin_catalog_sync, name='admin_catalog_sync'),
]
