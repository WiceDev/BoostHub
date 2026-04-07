"""Email verification token utilities using Django's signing framework."""
from django.core import signing
from django.core.mail import EmailMessage
from django.conf import settings
from django.template.loader import render_to_string


SALT = 'email-verification'
MAX_AGE = 60 * 60 * 24  # 24 hours


def generate_verification_token(user_id: int) -> str:
    return signing.dumps(user_id, salt=SALT)


def verify_token(token: str) -> int | None:
    """Return user_id if valid, None otherwise."""
    try:
        return signing.loads(token, salt=SALT, max_age=MAX_AGE)
    except (signing.BadSignature, signing.SignatureExpired):
        return None


def send_verification_email(user, request=None):
    """Send a verification email to the user."""
    token = generate_verification_token(user.id)

    # Build the verification URL — points to the frontend route
    frontend_url = getattr(settings, 'FRONTEND_URL', '')
    if frontend_url:
        base = frontend_url.rstrip('/')
    elif request:
        # In dev, the Django request comes from :8000 but frontend is :8080
        host = request.get_host()
        if ':8000' in host:
            host = host.replace(':8000', ':8080')
        base = f"{request.scheme}://{host}"
    else:
        base = 'http://localhost:8080'

    verify_url = f"{base}/verify-email?token={token}"

    html_body = render_to_string('emails/verify_email.html', {
        'first_name': user.first_name or user.email.split('@')[0],
        'verification_link': verify_url,
    })

    email = EmailMessage(
        subject="Verify your email — PriveBoost",
        body=html_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    email.content_subtype = 'html'
    email.send(fail_silently=True)


def send_welcome_email(user):
    """Send a welcome email after a user's email is verified."""
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:8080')
    dashboard_url = f"{frontend_url.rstrip('/')}/dashboard"

    html_body = render_to_string('emails/welcome_email.html', {
        'first_name': user.first_name or user.email.split('@')[0],
        'dashboard_url': dashboard_url,
    })

    email = EmailMessage(
        subject="Welcome to PriveBoost 🎉 — You're all set!",
        body=html_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    email.content_subtype = 'html'
    email.send(fail_silently=True)
