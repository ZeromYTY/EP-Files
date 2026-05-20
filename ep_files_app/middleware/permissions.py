"""
Middleware для централизованной проверки прав доступа
"""
import logging
import re
from django.http import JsonResponse
from django.urls import resolve
from ep_files_app.models import File, Folder
from ep_files_app.services.permission_service import permission_service

logger = logging.getLogger(__name__)


class PermissionCheckMiddleware:
    """
    Middleware для автоматической проверки прав доступа к файлам и папкам
    """
    
    # Паттерны URL, требующие проверки прав
    FILE_PATTERNS = [
        (r'^/api/files/(\d+)/download/$', 'read'),
        (r'^/api/files/(\d+)/$', 'write'),  # DELETE/PATCH rename
        (r'^/api/files/(\d+)/move/$', 'write'),
        (r'^/api/files/(\d+)/detail/$', 'read'),
        (r'^/api/files/(\d+)/history/$', 'read'),
    ]
    
    FOLDER_PATTERNS = [
        (r'^/api/folders/(\d+)/rename/$', 'write'),
        (r'^/api/folders/(\d+)/move/$', 'write'),
        (r'^/api/folders/(\d+)/delete/$', 'write'),
    ]
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Проверяем права доступа перед обработкой запроса
        if request.user and request.user.is_authenticated:
            permission_check = self._check_permissions(request)
            if permission_check is not None:
                return permission_check
        
        response = self.get_response(request)
        return response
    
    def _check_permissions(self, request):
        """
        Проверить права доступа для текущего запроса
        
        Returns:
            JsonResponse с ошибкой если доступ запрещен, иначе None
        """
        path = request.path
        method = request.method
        
        # Проверяем файлы
        for pattern, required_permission in self.FILE_PATTERNS:
            match = re.match(pattern, path)
            if match:
                file_id = int(match.group(1))
                return self._check_file_permission(
                    request.user,
                    file_id,
                    required_permission,
                    method
                )
        
        # Проверяем папки
        for pattern, required_permission in self.FOLDER_PATTERNS:
            match = re.match(pattern, path)
            if match:
                folder_id = int(match.group(1))
                return self._check_folder_permission(
                    request.user,
                    folder_id,
                    required_permission
                )
        
        return None
    
    def _check_file_permission(self, user, file_id, required_permission, method):
        """
        Проверить права доступа к файлу
        """
        try:
            file = File.objects.get(id=file_id)
        except File.DoesNotExist:
            # Файл не найден - пусть view обработает
            return None
        
        # Определяем требуемые права на основе метода
        if method == 'DELETE':
            required_permission = 'write'
        
        # Проверяем права
        if required_permission == 'read':
            has_permission = permission_service.can_read_file(user, file)
        else:  # write
            has_permission = permission_service.can_write_file(user, file)
        
        if not has_permission:
            logger.warning(
                f"Access denied: {user.email} tried to {required_permission} "
                f"file {file.name} (id={file_id})"
            )
            return JsonResponse(
                {
                    'error': 'У вас нет прав доступа к этому файлу',
                    'required_permission': required_permission,
                    'resource_type': 'file',
                    'resource_id': file_id
                },
                status=403
            )
        
        return None
    
    def _check_folder_permission(self, user, folder_id, required_permission):
        """
        Проверить права доступа к папке
        """
        try:
            folder = Folder.objects.get(id=folder_id)
        except Folder.DoesNotExist:
            # Папка не найдена - пусть view обработает
            return None
        
        # Проверяем права
        if required_permission == 'read':
            has_permission = permission_service.can_read_folder(user, folder)
        else:  # write
            has_permission = permission_service.can_write_folder(user, folder)
        
        if not has_permission:
            logger.warning(
                f"Access denied: {user.email} tried to {required_permission} "
                f"folder {folder.name} (id={folder_id})"
            )
            return JsonResponse(
                {
                    'error': 'У вас нет прав доступа к этой папке',
                    'required_permission': required_permission,
                    'resource_type': 'folder',
                    'resource_id': folder_id
                },
                status=403
            )
        
        return None
