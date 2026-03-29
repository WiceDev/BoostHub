from django.contrib import admin
from .models import Ticket


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'subject', 'order_number', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('user__email', 'subject', 'order_number')
    readonly_fields = ('created_at', 'updated_at')
