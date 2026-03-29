from django.contrib import admin
from .models import Order


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'user', 'service_name', 'service_type',
        'amount', 'status', 'created_at'
    ]
    list_filter = ['status', 'service_type']
    search_fields = ['user__email', 'service_name', 'external_order_id']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    actions = ['mark_completed', 'mark_failed', 'process_refunds']

    def mark_completed(self, request, queryset):
        for order in queryset:
            order.mark_completed()
        self.message_user(request, f"{queryset.count()} orders marked as completed.")

    mark_completed.short_description = 'Mark selected orders as completed'

    def mark_failed(self, request, queryset):
        for order in queryset:
            order.mark_failed(notes='Marked failed by admin')
        self.message_user(request, f"{queryset.count()} orders marked as failed.")

    mark_failed.short_description = 'Mark selected orders as failed and refund'

    def process_refunds(self, request, queryset):
        for order in queryset.filter(status='failed'):
            order.refund()
        self.message_user(request, 'Refunds processed for failed orders.')

    process_refunds.short_description = 'Process refunds for failed orders'
