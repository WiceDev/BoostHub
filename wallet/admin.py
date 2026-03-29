from django.contrib import admin
from .models import Wallet, Transaction


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ['user', 'balance', 'currency', 'created_at']
    search_fields = ['user__email', 'user__username']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = [
        'wallet', 'transaction_type', 'amount',
        'status', 'description', 'created_at'
    ]
    list_filter = ['transaction_type', 'status']
    search_fields = ['wallet__user__email', 'reference']
    readonly_fields = ['created_at']
