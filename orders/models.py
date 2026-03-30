from django.db import models
from django.conf import settings
from decimal import Decimal


class Order(models.Model):
    SERVICE_TYPES = [
        ('social_account', 'Social Media Account'),
        ('phone_number', 'Phone Number Verification'),
        ('smm_boost', 'SMM Boosting'),
        ('website_template', 'Website Template'),
        ('gift', 'Gift Delivery'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('in_transit', 'In Transit'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
        ('cancelled', 'Cancelled'),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='orders'
    )
    service_type = models.CharField(max_length=30, choices=SERVICE_TYPES)
    service_name = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    # API cost at time of purchase — profit = amount - cost_price
    # Null for historical orders placed before this field existed
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='pending'
    )
    # External API data
    external_order_id = models.CharField(max_length=255, blank=True)
    external_data = models.JSONField(default=dict, blank=True)
    # Result delivered to user
    result = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    # Tracking info (for gift / physical deliveries)
    tracking_code = models.CharField(max_length=255, blank=True)
    tracking_url = models.URLField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Order #{self.id} - {self.service_name} ({self.status})"

    def mark_completed(self, result=''):
        self.status = 'completed'
        self.result = result
        self.save()

    def mark_failed(self, notes=''):
        self.status = 'failed'
        self.notes = notes
        self.save()
        self.refund()

    def refund(self):
        if self.status != 'refunded':
            self.user.wallet.credit(
                amount=self.amount,
                description=f'Refund for Order #{self.id} - {self.service_name}',
                reference=f'REFUND-{self.id}',
                transaction_type='refund'
            )
            self.status = 'refunded'
            self.save()
