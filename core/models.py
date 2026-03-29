from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class PlatformSettings(models.Model):
    """Singleton model for platform-wide settings configurable by admin."""

    boosting_markup_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=30.00,
        validators=[MinValueValidator(0), MaxValueValidator(500)],
        help_text="Markup percentage applied on top of RSS service costs (e.g. 30 = 30%)"
    )
    numbers_markup_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=30.00,
        validators=[MinValueValidator(0), MaxValueValidator(500)],
        help_text="Markup percentage applied on top of SMSPool costs (e.g. 30 = 30%)"
    )
    usd_to_ngn_rate = models.DecimalField(
        max_digits=10, decimal_places=2, default=1600.00,
        validators=[MinValueValidator(1)],
        help_text="USD to NGN exchange rate used for price conversions"
    )
    crypto_methods = models.JSONField(
        default=list, blank=True,
        help_text='Crypto payment methods: [{"id":"...","name":"USDT","network":"TRC20","address":"..."}]'
    )
    crypto_usd_rate = models.DecimalField(
        max_digits=10, decimal_places=2, default=1600.00,
        validators=[MinValueValidator(1)],
        help_text="USD to NGN rate applied specifically to crypto deposits"
    )

    # API key overrides — if set, these take precedence over .env values
    paystack_secret_key = models.CharField(max_length=255, blank=True, default='',
        help_text="Overrides PAYSTACK_SECRET_KEY in .env")
    paystack_public_key = models.CharField(max_length=255, blank=True, default='',
        help_text="Overrides PAYSTACK_PUBLIC_KEY in .env")
    rss_api_key = models.CharField(max_length=255, blank=True, default='',
        help_text="Overrides REAL_SIMPLE_SOCIAL_API_KEY in .env")
    smspool_api_key = models.CharField(max_length=255, blank=True, default='',
        help_text="Overrides SMS_POOL_API_KEY in .env")

    class Meta:
        verbose_name = "Platform Settings"
        verbose_name_plural = "Platform Settings"

    def __str__(self):
        return "Platform Settings"

    def save(self, *args, **kwargs):
        # Enforce singleton — always use pk=1
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        """Get or create the singleton settings instance."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @classmethod
    def get_api_key(cls, db_attr, settings_attr):
        """
        Resolve an API key: DB value takes precedence over .env.
        Result is cached for 5 minutes to avoid per-request DB hits.
        """
        from django.core.cache import cache
        cache_key = f'api_key:{db_attr}'
        cached = cache.get(cache_key)
        if cached is not None:
            return cached
        try:
            obj = cls.load()
            db_val = getattr(obj, db_attr, '').strip()
            if db_val:
                cache.set(cache_key, db_val, 300)
                return db_val
        except Exception:
            pass
        env_val = getattr(settings, settings_attr, '') or ''
        cache.set(cache_key, env_val, 300)
        return env_val

    @classmethod
    def clear_api_key_cache(cls, db_attr):
        from django.core.cache import cache
        cache.delete(f'api_key:{db_attr}')


class BannedIP(models.Model):
    ip_address = models.GenericIPAddressField(unique=True)
    reason = models.CharField(max_length=255, blank=True)
    banned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='banned_ips'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Banned: {self.ip_address}"


class IPLog(models.Model):
    ACTION_CHOICES = [
        ('login_ok', 'Login Success'),
        ('login_fail', 'Login Failed'),
        ('register', 'Registration'),
    ]
    ip_address = models.GenericIPAddressField(db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='ip_logs'
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    user_agent = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.ip_address} — {self.action} — {self.created_at:%Y-%m-%d %H:%M}"
