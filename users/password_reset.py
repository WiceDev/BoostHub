"""Password reset token utilities using Django's signing framework."""
from django.core import signing
from django.core.mail import EmailMessage
from django.conf import settings


SALT = 'password-reset'
MAX_AGE = 60 * 60  # 1 hour


def generate_reset_token(user_id: int) -> str:
    return signing.dumps(user_id, salt=SALT)


def verify_reset_token(token: str) -> int | None:
    """Return user_id if valid and not expired, None otherwise."""
    try:
        return signing.loads(token, salt=SALT, max_age=MAX_AGE)
    except (signing.BadSignature, signing.SignatureExpired):
        return None


def send_reset_email(user, request=None):
    """Send a password reset email to the user."""
    token = generate_reset_token(user.id)

    frontend_url = getattr(settings, 'FRONTEND_URL', '')
    if frontend_url:
        base = frontend_url.rstrip('/')
    elif request:
        host = request.get_host()
        if ':8000' in host:
            host = host.replace(':8000', ':8080')
        base = f"{request.scheme}://{host}"
    else:
        base = 'http://localhost:8080'

    reset_url = f"{base}/reset-password?token={token}"

    subject = "Reset your password — PriveBoost"
    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;">Reset Your Password</h1>
    </div>
    <div style="padding:32px;color:#333333;font-size:15px;line-height:1.7;">
      <p style="margin:0 0 16px;">Hi {user.first_name or user.username},</p>
      <p style="margin:0 0 24px;">We received a request to reset your password. Click the button below to choose a new one:</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="{reset_url}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:10px;font-weight:600;font-size:16px;">
          Reset Password
        </a>
      </div>
      <p style="margin:0 0 8px;color:#666;font-size:13px;">Or copy and paste this link into your browser:</p>
      <p style="margin:0 0 24px;word-break:break-all;color:#6366f1;font-size:13px;">{reset_url}</p>
      <p style="margin:0;color:#999;font-size:13px;">This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password won't change.</p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;color:#999;font-size:12px;">PriveBoost</p>
    </div>
  </div>
</body>
</html>"""

    email = EmailMessage(
        subject=subject,
        body=html_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    email.content_subtype = 'html'
    email.send(fail_silently=True)
