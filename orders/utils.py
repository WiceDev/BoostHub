import logging
from django.core.mail import EmailMessage
from django.conf import settings
from django.template.loader import render_to_string
from users.models import User

logger = logging.getLogger(__name__)


def is_provider_insufficient_funds(error_message: str) -> bool:
    """
    Check if an error message from a provider API indicates insufficient funds.
    Returns True if keywords like 'insufficient', 'balance', 'no funds', 'not enough'
    appear in the error message (case-insensitive).
    """
    if not error_message:
        return False
    msg_lower = str(error_message).lower()
    keywords = ['insufficient', 'balance', 'no funds', 'not enough', 'low balance']
    return any(keyword in msg_lower for keyword in keywords)


def notify_admins_insufficient_funds(provider: str, error_message: str, order_id: int):
    """
    Send an email to super admins when a provider reports insufficient funds.
    This is non-critical so errors are logged but do not break the order response.
    """
    try:
        admin_emails = list(
            User.objects.filter(
                is_staff=True, is_active=True, admin_role='super_admin'
            )
            .exclude(email='')
            .values_list('email', flat=True)
        )

        if not admin_emails:
            logger.warning('No super admin emails configured for insufficient funds alert')
            return

        subject = f'[PriveBoost] Low Balance Alert — {provider}'
        html_body = render_to_string('emails/admin_provider_alert.html', {
            'provider': provider,
            'order_id': order_id,
            'error_message': error_message,
        })

        email = EmailMessage(
            subject=subject,
            body=html_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=admin_emails,
        )
        email.content_subtype = 'html'
        email.send(fail_silently=True)

    except Exception as e:
        # Log but don't raise — this should not break the order response
        logger.error(f'Failed to send insufficient funds alert: {e}')
