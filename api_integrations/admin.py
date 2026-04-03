from django.contrib import admin
from django.utils.html import format_html
from .models import APICallLog


class SourceFilter(admin.SimpleListFilter):
    """Filter API logs by source: User purchases vs Background tasks."""
    title = 'Source'
    parameter_name = 'source'

    def lookups(self, request, model_admin):
        return [
            ('user', 'User Purchases'),
            ('celery', 'Background Tasks (Celery)'),
        ]

    def queryset(self, request, queryset):
        if self.value() == 'user':
            return queryset.filter(triggered_by__startswith='user:')
        if self.value() == 'celery':
            return queryset.filter(triggered_by__startswith='celery:')
        return queryset


@admin.register(APICallLog)
class APICallLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'get_source', 'provider', 'action', 'get_status', 'http_status', 'duration_ms', 'error_snippet')
    list_filter = (SourceFilter, 'provider', 'success', 'created_at')
    search_fields = ('endpoint', 'error_message', 'triggered_by')
    readonly_fields = ('created_at', 'provider', 'action', 'endpoint', 'request_data', 'response_data', 'http_status', 'success', 'error_message', 'duration_ms', 'triggered_by')
    ordering = ('-created_at',)

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

    def get_source(self, obj):
        """Display source as User Purchase or Background Task."""
        if obj.triggered_by.startswith('user:'):
            user_id = obj.triggered_by.split(':')[1]
            return format_html(
                '<span style="color: #0066cc; font-weight: bold;">👤 User Purchase</span> (ID: {})',
                user_id
            )
        elif obj.triggered_by.startswith('celery:'):
            task_name = obj.triggered_by.split(':', 1)[1]
            return format_html(
                '<span style="color: #666; font-style: italic;">⏱️ Background Task</span><br><small style="color: #999;">{}</small>',
                task_name
            )
        else:
            return format_html('<span style="color: #999;">—</span>')
    get_source.short_description = 'Source'

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
