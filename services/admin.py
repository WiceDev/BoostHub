from django.contrib import admin
from .models import Gift, BoostingService, SmmPanel


@admin.register(Gift)
class GiftAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'is_active', 'created_at')
    list_filter = ('category', 'is_active')
    search_fields = ('name',)


@admin.register(BoostingService)
class BoostingServiceAdmin(admin.ModelAdmin):
    list_display = ('name', 'platform', 'category', 'price_per_k', 'min_quantity', 'max_quantity', 'is_active')
    list_filter = ('platform', 'category', 'is_active')
    search_fields = ('name',)


@admin.register(SmmPanel)
class SmmPanelAdmin(admin.ModelAdmin):
    list_display = ('name', 'api_url', 'is_active')
