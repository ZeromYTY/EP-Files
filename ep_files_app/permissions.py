"""Custom access permissions for files and admin operations."""
from rest_framework import permissions
from ep_files_app.services.permission_service import permission_service


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


class HasFileReadPermission(permissions.BasePermission):
    """
    Проверяет права на чтение файла (владелец или есть права доступа)
    """
    
    def has_object_permission(self, request, view, obj):
        # obj должен быть File
        return permission_service.can_read_file(request.user, obj)


class HasFileWritePermission(permissions.BasePermission):
    """
    Проверяет права на запись файла (владелец или есть права доступа)
    """
    
    def has_object_permission(self, request, view, obj):
        # obj должен быть File
        return permission_service.can_write_file(request.user, obj)


class HasFolderReadPermission(permissions.BasePermission):
    """
    Проверяет права на чтение папки (владелец или есть права доступа)
    """
    
    def has_object_permission(self, request, view, obj):
        # obj должен быть Folder
        return permission_service.can_read_folder(request.user, obj)


class HasFolderWritePermission(permissions.BasePermission):
    """
    Проверяет права на запись папки (владелец или есть права доступа)
    """
    
    def has_object_permission(self, request, view, obj):
        # obj должен быть Folder
        return permission_service.can_write_folder(request.user, obj)
