"""
Кастомные права доступа для файлов
"""
from rest_framework import permissions
from ep_files_app.services.permission_service import permission_service


class IsFileOwner(permissions.BasePermission):
    """
    Проверяет, что пользователь является владельцем файла
    """
    
    def has_object_permission(self, request, view, obj):
        # Владелец файла может делать всё
        return obj.owner == request.user


class IsFileOwnerOrReadOnly(permissions.BasePermission):
    """
    Владелец может редактировать, остальные только читать
    """
    
    def has_object_permission(self, request, view, obj):
        # Чтение разрешено всем
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Изменение только владельцу
        return obj.owner == request.user


class CanUploadFiles(permissions.BasePermission):
    """
    Проверяет, может ли пользователь загружать файлы
    """
    
    def has_permission(self, request, view):
        # Только авторизованные пользователи
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Проверяем, не заблокирован ли пользователь
        if hasattr(request.user, 'is_active') and not request.user.is_active:
            return False
        
        return True


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
