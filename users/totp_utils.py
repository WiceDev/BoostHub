"""TOTP helpers for admin 2FA using pyotp."""
import pyotp

ISSUER = 'PriveBoost'


def generate_secret() -> str:
    return pyotp.random_base32()


def verify_code(secret: str, code: str) -> bool:
    """Accept current and one adjacent window (±30s drift tolerance)."""
    return pyotp.TOTP(secret).verify(code, valid_window=1)


def provisioning_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=ISSUER)
