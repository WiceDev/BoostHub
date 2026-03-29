import secrets
import string
from django.db import models
from django.contrib.auth.models import AbstractUser


def _generate_referral_code():
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(8))


class User(AbstractUser):
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    profile_picture = models.ImageField(
        upload_to='profiles/', blank=True, null=True
    )
    is_verified = models.BooleanField(default=False)
    date_of_birth = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # 2FA (TOTP — admin accounts only)
    totp_secret  = models.CharField(max_length=64, blank=True, default='')
    totp_enabled = models.BooleanField(default=False)

    # Referral system
    referral_code = models.CharField(max_length=12, unique=True, blank=True)
    referred_by = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='referrals'
    )
    referral_bonus_paid = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def save(self, *args, **kwargs):
        if not self.referral_code:
            code = _generate_referral_code()
            while User.objects.filter(referral_code=code).exists():
                code = _generate_referral_code()
            self.referral_code = code
        if self.is_staff:
            self.is_verified = True
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email

