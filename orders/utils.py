import logging
from django.core.mail import EmailMessage
from django.conf import settings
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
    Send an email to all staff users when a provider reports insufficient funds.
    This is non-critical so errors are logged but do not break the order response.
    """
    try:
        # Get all active staff emails
        admin_emails = list(
            User.objects.filter(is_staff=True, is_active=True)
            .exclude(email='')
            .values_list('email', flat=True)
        )

        if not admin_emails:
            logger.warning('No admin emails configured for insufficient funds alert')
            return

        subject = '[WicePlatform] Provider Insufficient Funds Alert'
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #d32f2f;">Provider Insufficient Funds Alert</h2>
                <p><strong>Provider:</strong> {provider}</p>
                <p><strong>Order ID:</strong> {order_id}</p>
                <p><strong>Error Message:</strong></p>
                <p style="background-color: #f5f5f5; padding: 10px; border-left: 4px solid #d32f2f;">
                    {error_message}
                </p>
                <p style="color: #666; font-size: 12px; margin-top: 20px;">
                    This is an automated alert. Please check your {provider} account balance and top up funds if needed.
                </p>
            </body>
        </html>
        """

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
