from django.db import models


class BoostingServiceSnapshot(models.Model):
    """Boosting services synced from RSS SMM panel. Admin controls which are visible to users."""
    external_id = models.IntegerField(unique=True, db_index=True)
    name = models.CharField(max_length=500)
    service_type = models.CharField(max_length=100, blank=True)
    category = models.CharField(max_length=100, blank=True)
    platform = models.CharField(max_length=100, blank=True)
    # Raw API cost — markup is applied at serve time from current PlatformSettings
    cost_per_k_ngn = models.DecimalField(max_digits=12, decimal_places=4)
    min_quantity = models.IntegerField(default=10)
    max_quantity = models.IntegerField(default=10000)
    refill = models.BooleanField(default=False)
    cancel = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True, db_index=True)
    last_synced = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['platform', 'category', 'name']
        verbose_name = 'Boosting Service'
        verbose_name_plural = 'Boosting Services'

    def __str__(self):
        return f"[{self.platform}] {self.name} (#{self.external_id})"


class SMSCountrySnapshot(models.Model):
    """SMS countries synced from SMSPool. Admin controls which are available to users."""
    external_id = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=200)
    short_name = models.CharField(max_length=10, blank=True)
    dial_code = models.CharField(max_length=10, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    last_synced = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'SMS Country'
        verbose_name_plural = 'SMS Countries'

    def __str__(self):
        return f"{self.name} ({self.short_name})"


class SMSServiceSnapshot(models.Model):
    """SMS services synced from SMSPool. Admin controls which are available to users."""
    external_id = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=500)
    short_name = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    last_synced = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'SMS Service'
        verbose_name_plural = 'SMS Services'

    def __str__(self):
        return self.name
