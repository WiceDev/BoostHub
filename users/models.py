import secrets
import string
from django.db import models
from django.contrib.auth.models import AbstractUser


def _generate_referral_code():
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(8))


class User(AbstractUser):
    ADMIN_ROLE_CHOICES = [
        ('', 'Not Admin'),
        ('super_admin', 'Super Admin'),
        ('service_admin', 'Service Admin'),
    ]

    # Permissions that can be granted to service_admin users
    ADMIN_PERMISSION_CHOICES = [
        'manage_boosting',       # Add/edit boosting services
        'manage_numbers',        # Add/edit verification numbers
        'manage_accounts',       # Add/edit social media accounts
        'manage_gifts',          # Add/edit gift items
        'manage_webdev',         # Add/edit web dev portfolios
    ]

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

    # Admin role system
    admin_role = models.CharField(
        max_length=20, choices=ADMIN_ROLE_CHOICES, blank=True, default='',
        help_text='super_admin = full access, service_admin = limited by admin_permissions'
    )
    admin_permissions = models.JSONField(
        default=list, blank=True,
        help_text='List of permissions for service_admin, e.g. ["manage_gifts", "manage_accounts"]'
    )

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
            # Auto-assign service_admin to new staff users with no role set
            if not self.admin_role:
                self.admin_role = 'service_admin'
        super().save(*args, **kwargs)

    @property
    def is_super_admin(self):
        return self.is_staff and self.admin_role == 'super_admin'

    @property
    def is_service_admin(self):
        return self.is_staff and self.admin_role == 'service_admin'

    def has_admin_permission(self, permission):
        if self.is_super_admin:
            return True
        if self.is_service_admin:
            return permission in (self.admin_permissions or [])
        return False

    def __str__(self):
        return self.email

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email

