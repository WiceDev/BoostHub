from django.contrib import admin
from django.utils.html import format_html
from .models import UserPurchaseLog, CeleryTaskLog


class UserPurchaseLogAdmin(admin.ModelAdmin):
    """API logs from user purchases only."""
    list_display = ('created_at', 'get_user_id', 'provider', 'action', 'get_status', 'http_status', 'duration_ms', 'error_snippet')
    list_filter = ('provider', 'success', 'created_at')
    search_fields = ('endpoint', 'error_message', 'triggered_by')
    readonly_fields = ('created_at', 'provider', 'action', 'endpoint', 'request_data', 'response_data', 'http_status', 'success', 'error_message', 'duration_ms', 'triggered_by')
    ordering = ('-created_at',)

    def get_queryset(self, request):
        return super().get_queryset(request).filter(triggered_by__startswith='user:')

    def get_user_id(self, obj):
        """Extract and display user ID."""
        user_id = obj.triggered_by.split(':')[1] if ':' in obj.triggered_by else '?'
        return format_html('<span style="color: #0066cc; font-weight: bold;">👤 User {}</span>', user_id)
    get_user_id.short_description = 'User'

    fieldsets = (
        ('Request Details', {
            'fields': ('created_at', 'provider', 'action', 'endpoint', 'triggered_by', 'duration_ms')
        }),
        ('Data', {
            'fields': ('request_data', 'response_data'),
            'classes': ('collapse',)
        }),
        ('Result', {
            'fields': ('http_status', 'success', 'error_message')
        }),
    )

    def get_status(self, obj):
        """Display success/failure with color."""
        if obj.success:
            return format_html('<span style="color: #28a745; font-weight: bold;">✓ OK</span>')
        else:
            return format_html('<span style="color: #dc3545; font-weight: bold;">✗ FAILED</span>')
    get_status.short_description = 'Status'

    def error_snippet(self, obj):
        """Show first 100 chars of error message."""
        if not obj.error_message:
            return '—'
        snippet = obj.error_message[:100]
        if len(obj.error_message) > 100:
            snippet += '...'
        return format_html('<small style="color: #dc3545;">{}</small>', snippet)
    error_snippet.short_description = 'Error'


class CeleryTaskLogAdmin(admin.ModelAdmin):
    """API logs from background Celery tasks only."""
    list_display = ('created_at', 'get_task_name', 'provider', 'action', 'get_status', 'http_status', 'duration_ms', 'error_snippet')
    list_filter = ('provider', 'success', 'created_at')
    search_fields = ('endpoint', 'error_message', 'triggered_by')
    readonly_fields = ('created_at', 'provider', 'action', 'endpoint', 'request_data', 'response_data', 'http_status', 'success', 'error_message', 'duration_ms', 'triggered_by')
    ordering = ('-created_at',)

    def get_queryset(self, request):
        return super().get_queryset(request).filter(triggered_by__startswith='celery:')

    def get_task_name(self, obj):
        """Extract and display Celery task name."""
        task_name = obj.triggered_by.split(':', 1)[1] if ':' in obj.triggered_by else '?'
        return format_html('<span style="color: #666; font-style: italic;">⏱️ {}</span>', task_name)
    get_task_name.short_description = 'Task'

    def get_status(self, obj):
        """Display success/failure with color."""
        if obj.success:
            return format_html('<span style="color: #28a745; font-weight: bold;">✓ OK</span>')
        else:
            return format_html('<span style="color: #dc3545; font-weight: bold;">✗ FAILED</span>')
    get_status.short_description = 'Status'

    def error_snippet(self, obj):
        """Show first 100 chars of error message."""
        if not obj.error_message:
            return '—'
        snippet = obj.error_message[:100]
        if len(obj.error_message) > 100:
            snippet += '...'
        return format_html('<small style="color: #dc3545;">{}</small>', snippet)
    error_snippet.short_description = 'Error'


# Register both views separately
admin.site.register(UserPurchaseLog, UserPurchaseLogAdmin)
admin.site.register(CeleryTaskLog, CeleryTaskLogAdmin)
