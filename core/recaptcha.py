"""Google reCAPTCHA v3 verification."""
import requests
from django.conf import settings


def verify_recaptcha(token: str, action: str = 'login', threshold: float = 0.5) -> bool:
    """
    Verify a reCAPTCHA v3 token with Google.
    Returns True if valid, False otherwise.
    If no secret key is configured, returns True (allows development without keys).
    """
    secret = getattr(settings, 'RECAPTCHA_SECRET_KEY', '')
    if not secret:
        return True  # Skip verification in dev if not configured

    try:
        resp = requests.post(
            'https://www.google.com/recaptcha/api/siteverify',
            data={'secret': secret, 'response': token},
            timeout=5,
        )
        result = resp.json()
        return (
            result.get('success', False)
            and result.get('score', 0) >= threshold
            and result.get('action', '') == action
        )
    except Exception:
        return True  # Don't block users if Google is unreachable
