"""Custom access permissions for files and admin operations."""
from rest_framework import permissions


class IsFileOwner(permissions.BasePermission):
    """Check that the user is the owner of the file."""

    def has_object_permission(self, request, view, obj):
        """Return True if the user owns the object."""
        return obj.owner == request.user


class IsFileOwnerOrReadOnly(permissions.BasePermission):
    """Owner can edit, others can only read."""

    def has_object_permission(self, request, view, obj):
        """Return True for safe methods or if user is owner."""
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.owner == request.user


class CanUploadFiles(permissions.BasePermission):
    """Check that the user is allowed to upload files."""

    def has_permission(self, request, view):
        """Return True if user is authenticated and active."""
        if not request.user or not request.user.is_authenticated:
            return False
        if hasattr(request.user, "is_active") and not request.user.is_active:
            return False
        return True


class IsAdminUser(permissions.BasePermission):
    """Allow access only to users with is_staff or is_superuser flag."""

    def has_permission(self, request, view):
        """Return True if user is authenticated and is an admin."""
        if not request.user or not request.user.is_authenticated:
            return False
        return bool(request.user.is_staff or request.user.is_superuser)