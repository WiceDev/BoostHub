import logging
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from django.core.mail import EmailMessage
from django.conf import settings
from django.template.loader import render_to_string
from core.email_utils import _get_admin_emails
from core.sanitizers import sanitize_text, MAX_SHORT_TEXT, MAX_LONG_TEXT

logger = logging.getLogger(__name__)


class ContactFormThrottle(AnonRateThrottle):
    rate = '5/hour'


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([ContactFormThrottle])
def api_contact(request):
    """Handle contact form submissions from the landing page."""
    name = sanitize_text(request.data.get('name', ''), max_length=MAX_SHORT_TEXT)
    email = request.data.get('email', '').strip().lower()
    message = sanitize_text(request.data.get('message', ''), max_length=MAX_LONG_TEXT)

    if not name or not email or not message:
        return Response({'detail': 'Name, email, and message are required.'}, status=400)

    if '@' not in email or '.' not in email:
        return Response({'detail': 'Please enter a valid email address.'}, status=400)

    admin_emails = _get_admin_emails()
    if not admin_emails:
        logger.error('Contact form: no super admin emails configured')
        return Response({'detail': 'Message sent successfully.'})

    html_body = render_to_string('emails/admin_contact_form.html', {
        'sender_name': name,
        'sender_email': email,
        'message': message,
    })

    try:
        msg = EmailMessage(
            subject=f'[PriveBoost] Contact Form — {name}',
            body=html_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=admin_emails,
            reply_to=[email],
        )
        msg.content_subtype = 'html'
        msg.send(fail_silently=False)
    except Exception as e:
        logger.error(f'Contact form email failed: {e}')
        return Response(
            {'detail': 'Unable to send your message right now. Please try again later.'},
            status=503,
        )

    return Response({'detail': 'Message sent successfully.'})
