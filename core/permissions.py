"""
Permission classes and decorators for the admin role system.

- IsSuperAdmin: only super_admin users
- IsServiceAdmin: any staff user (super_admin OR service_admin)
- require_admin_permission(perm): decorator that checks the user has a specific permission
"""
from functools import wraps
from rest_framework.permissions import BasePermission
from rest_framework.response import Response


class IsSuperAdmin(BasePermission):
    """Only allow super_admin users."""
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_super_admin
        )


class IsServiceAdmin(BasePermission):
    """Allow any staff user (super_admin or service_admin)."""
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
        )


def require_admin_permission(permission):
    """
    Decorator for function-based API views.
    Checks that the logged-in staff user has the given admin permission.
    Super admins pass automatically; service admins need the permission in their list.
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped(request, *args, **kwargs):
            if not request.user.is_authenticated or not request.user.is_staff:
                return Response({'detail': 'Authentication required.'}, status=401)
            if not request.user.has_admin_permission(permission):
                return Response(
                    {'detail': 'You do not have permission to perform this action.'},
                    status=403,
                )
            return view_func(request, *args, **kwargs)
        return _wrapped
    return decorator
