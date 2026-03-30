from django.db import models
from django.conf import settings
from decimal import Decimal


class Wallet(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='wallet'
    )
    balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    currency = models.CharField(max_length=10, default='NGN')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    def __str__(self):
        return f"{self.user.email} - {self.balance}"
    def can_afford(self, amount):
        return self.balance >= Decimal(str(amount))
    def deduct(self, amount, description='Purchase'):
        amount = Decimal(str(amount))
        if not self.can_afford(amount):
            raise ValueError('Insufficient wallet balance.')
        self.balance -= amount
        self.save()
        Transaction.objects.create(
            wallet=self,
            amount=amount,
            transaction_type='debit',
            status='completed',
            description=description
        )
        return True
    def credit(self, amount, description='Deposit', reference='', transaction_type='credit'):
        amount = Decimal(str(amount))
        self.balance += amount
        self.save()
        Transaction.objects.create(
            wallet=self,
            amount=amount,
            transaction_type=transaction_type,
            status='completed',
            description=description,
            reference=reference
        )
        return True
class CryptoDeposit(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('rejected', 'Rejected'),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='crypto_deposits'
    )
    amount_usd = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    amount_ngn = models.DecimalField(max_digits=12, decimal_places=2)
    crypto_name = models.CharField(max_length=100)  # e.g. "USDT (TRC20)"
    transaction_hash = models.CharField(max_length=255, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} — {self.amount_ngn} NGN — {self.status}"


class Transaction(models.Model):
    TRANSACTION_TYPES = [
        ('credit', 'Credit'),
        ('debit', 'Debit'),
        ('refund', 'Refund'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    wallet = models.ForeignKey(
        Wallet, on_delete=models.CASCADE, related_name='transactions'
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    transaction_type = models.CharField(max_length=10, choices=TRANSACTION_TYPES)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    description = models.CharField(max_length=255, blank=True)
    reference = models.CharField(max_length=100, blank=True, unique=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['-created_at']
    def __str__(self):
        return f"{self.transaction_type} - {self.amount} ({self.status})"