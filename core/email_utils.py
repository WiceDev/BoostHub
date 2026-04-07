"""
Centralized email notification utilities for PriveBoost.
All outgoing emails (user + admin) go through helpers in this module.
"""
import logging
from django.core.mail import EmailMessage
from django.conf import settings
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def _send(subject, html_body, to_list, fail_silently=True):
    """Low-level send helper. *to_list* is a list of email strings."""
    if not to_list:
        return
    email = EmailMessage(
        subject=subject,
        body=html_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=to_list if isinstance(to_list, list) else [to_list],
    )
    email.content_subtype = 'html'
    try:
        email.send(fail_silently=fail_silently)
    except Exception as e:
        logger.error(f'Email send failed ({subject}): {e}')


def _get_admin_emails():
    from users.models import User
    return list(
        User.objects.filter(is_staff=True, is_active=True)
        .exclude(email='')
        .values_list('email', flat=True)
    )


def _frontend_url():
    return getattr(settings, 'FRONTEND_URL', 'https://www.priveboost.com').rstrip('/')


def _user_name(user):
    return user.first_name or user.email.split('@')[0]


# ═══════════════════════════════════════════════════════════════════════════════
# USER EMAILS
# ═══════════════════════════════════════════════════════════════════════════════

def send_password_changed_email(user):
    """Notify user that their password was changed."""
    html = render_to_string('emails/password_changed.html', {
        'first_name': _user_name(user),
        'support_url': f'{_frontend_url()}/dashboard/tickets',
    })
    _send('Your password was changed — PriveBoost', html, [user.email])


def send_referral_bonus_email(user, referred_email, bonus_amount):
    """Notify referrer that they earned a referral bonus."""
    html = render_to_string('emails/referral_bonus.html', {
        'first_name': _user_name(user),
        'referred_email': referred_email,
        'bonus_amount': f'{bonus_amount:,.0f}',
        'wallet_url': f'{_frontend_url()}/dashboard/wallet',
    })
    _send(f'You earned a referral bonus! — PriveBoost', html, [user.email])


def send_ticket_reply_email(user, ticket):
    """Notify user that admin replied to their ticket."""
    html = render_to_string('emails/ticket_reply.html', {
        'first_name': _user_name(user),
        'ticket_id': ticket.id,
        'ticket_subject': ticket.subject,
        'admin_response': ticket.admin_response,
        'tickets_url': f'{_frontend_url()}/dashboard/tickets',
    })
    _send(f'Reply to your ticket #{ticket.id} — PriveBoost', html, [user.email])


def send_order_status_email(user, order):
    """Notify user when an order status changes to a final state."""
    html = render_to_string('emails/order_status.html', {
        'first_name': _user_name(user),
        'order_id': order.id,
        'service_name': order.service_name,
        'status': order.status,
        'result': order.result,
        'notes': order.notes,
        'amount': f'{order.amount:,.2f}',
        'orders_url': f'{_frontend_url()}/dashboard/orders',
    })
    status_label = order.status.replace('_', ' ').title()
    _send(f'Order #{order.id} {status_label} — PriveBoost', html, [user.email])


def send_account_details_email(user, order):
    """Notify user when admin adds account details for a social_account order."""
    html = render_to_string('emails/account_details.html', {
        'first_name': _user_name(user),
        'order_id': order.id,
        'service_name': order.service_name,
        'result': order.result,
        'orders_url': f'{_frontend_url()}/dashboard/orders',
    })
    _send(f'Your account is ready — Order #{order.id} — PriveBoost', html, [user.email])


def send_gift_status_email(user, order):
    """Notify user when their gift order status changes."""
    html = render_to_string('emails/gift_status.html', {
        'first_name': _user_name(user),
        'order_id': order.id,
        'service_name': order.service_name,
        'status': order.status,
        'tracking_code': order.tracking_code,
        'tracking_url': order.tracking_url,
        'notes': order.notes,
        'orders_url': f'{_frontend_url()}/dashboard/orders',
    })
    status_label = order.status.replace('_', ' ').title()
    _send(f'Gift Order #{order.id} {status_label} — PriveBoost', html, [user.email])


def send_deposit_confirmed_email(user, amount, method='Korapay'):
    """Notify user when their deposit is confirmed."""
    html = render_to_string('emails/deposit_confirmed.html', {
        'first_name': _user_name(user),
        'amount': f'{amount:,.2f}',
        'method': method,
        'wallet_url': f'{_frontend_url()}/dashboard/wallet',
    })
    _send(f'Deposit of ₦{amount:,.2f} confirmed — PriveBoost', html, [user.email])


def send_crypto_deposit_status_email(user, deposit, action):
    """Notify user when their crypto deposit is approved or rejected."""
    html = render_to_string('emails/crypto_deposit_status.html', {
        'first_name': _user_name(user),
        'deposit_id': deposit.id,
        'amount_ngn': f'{deposit.amount_ngn:,.2f}',
        'crypto_name': deposit.crypto_name,
        'action': action,  # 'confirm' or 'reject'
        'admin_note': deposit.admin_note,
        'wallet_url': f'{_frontend_url()}/dashboard/wallet',
    })
    if action == 'confirm':
        subject = f'Crypto deposit approved — ₦{deposit.amount_ngn:,.2f} credited — PriveBoost'
    else:
        subject = f'Crypto deposit rejected — PriveBoost'
    _send(subject, html, [user.email])


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN EMAILS
# ═══════════════════════════════════════════════════════════════════════════════

def notify_admin_new_user(user):
    """Alert admins when a new user registers."""
    admin_emails = _get_admin_emails()
    if not admin_emails:
        return
    html = render_to_string('emails/admin_new_user.html', {
        'user_email': user.email,
        'user_name': user.get_full_name() or user.email,
        'admin_url': f'{_frontend_url()}/admin/users',
    })
    _send('[PriveBoost] New user registered', html, admin_emails)


def notify_admin_new_ticket(user, ticket):
    """Alert admins when a user opens a new support ticket."""
    admin_emails = _get_admin_emails()
    if not admin_emails:
        return
    html = render_to_string('emails/admin_new_ticket.html', {
        'user_email': user.email,
        'user_name': _user_name(user),
        'ticket_id': ticket.id,
        'ticket_subject': ticket.subject,
        'ticket_message': ticket.message,
        'admin_url': f'{_frontend_url()}/admin/tickets',
    })
    _send(f'[PriveBoost] New ticket #{ticket.id}: {ticket.subject}', html, admin_emails)


def notify_admin_new_deposit(user, amount, method, reference=''):
    """Alert admins when a new deposit is confirmed."""
    admin_emails = _get_admin_emails()
    if not admin_emails:
        return
    html = render_to_string('emails/admin_new_deposit.html', {
        'user_email': user.email,
        'user_name': _user_name(user),
        'amount': f'{amount:,.2f}',
        'method': method,
        'reference': reference,
        'admin_url': f'{_frontend_url()}/admin/deposits',
    })
    _send(f'[PriveBoost] New deposit: ₦{amount:,.2f} from {user.email}', html, admin_emails)


def notify_admin_gift_order(user, order):
    """Alert admins when a user places a gift order (needs manual processing)."""
    admin_emails = _get_admin_emails()
    if not admin_emails:
        return
    ext = order.external_data or {}
    html = render_to_string('emails/admin_gift_order.html', {
        'user_email': user.email,
        'user_name': _user_name(user),
        'order_id': order.id,
        'gift_name': order.service_name,
        'amount': f'{order.amount:,.2f}',
        'recipient_name': ext.get('recipient_name', 'N/A'),
        'recipient_phone': ext.get('recipient_phone', 'N/A'),
        'delivery_address': ext.get('delivery_address', 'N/A'),
        'admin_url': f'{_frontend_url()}/admin/orders',
    })
    _send(f'[PriveBoost] New gift order #{order.id} — {order.service_name}', html, admin_emails)


def notify_admin_api_downtime(provider, error_message):
    """Alert admins when an external API provider is unreachable."""
    admin_emails = _get_admin_emails()
    if not admin_emails:
        return
    html = render_to_string('emails/admin_api_downtime.html', {
        'provider': provider,
        'error_message': str(error_message),
    })
    _send(f'[PriveBoost] API downtime alert: {provider}', html, admin_emails)
