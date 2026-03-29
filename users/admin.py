from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = [
        'email', 'username', 'first_name',
        'last_name', 'is_verified', 'date_joined'
    ]
    list_filter = ['is_verified', 'is_staff', 'is_active']
    search_fields = ['email', 'username', 'first_name', 'last_name']
    ordering = ['-date_joined']
    fieldsets = UserAdmin.fieldsets + (
        ('Extra Info', {
            'fields': ('phone', 'profile_picture', 'is_verified', 'date_of_birth')
        }),
    )
