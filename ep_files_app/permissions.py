"""
Кастомные права доступа для файлов
"""
from rest_framework import permissions


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
