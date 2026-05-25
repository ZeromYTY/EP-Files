"""Сервисная логика проверки, выдачи и отзыва прав доступа."""
import logging
from typing import Optional, List
from django.db.models import Q
from ep_files_app.models import Permission, File, Folder, User

logger = logging.getLogger(__name__)


class PermissionService:
    """Сервис проверки, выдачи и отзыва прав доступа."""
    
    @staticmethod
    def can_read_file(user: User, file: File) -> bool:
        """Проверяет право пользователя на чтение файла."""
        if file.owner == user:
            return True

        if Permission.objects.filter(
            user=user,
            file=file,
            permission_type__in=[Permission.READ, Permission.READ_WRITE]
        ).exists():
            return True

        if file.folder:
            if file.folder.owner == user:
                return True
            return PermissionService._check_inherited_permissions(
                user=user,
                folder=file.folder,
                permission_type=Permission.READ
            )
        
        return False
    
    @staticmethod
    def can_write_file(user: User, file: File) -> bool:
        """Проверяет право пользователя на редактирование файла."""
        if file.owner == user:
            return True

        if Permission.objects.filter(
            user=user,
            file=file,
            permission_type=Permission.READ_WRITE
        ).exists():
            return True

        if file.folder:
            if file.folder.owner == user:
                return True
            return PermissionService._check_inherited_permissions(
                user=user,
                folder=file.folder,
                permission_type=Permission.READ_WRITE
            )
        
        return False
    
    @staticmethod
    def can_read_folder(user: User, folder: Folder) -> bool:
        """Проверяет право пользователя на чтение папки."""
        if folder.owner == user:
            return True

        if Permission.objects.filter(
            user=user,
            folder=folder,
            permission_type__in=[Permission.READ, Permission.READ_WRITE]
        ).exists():
            return True
        if folder.parent:
            return PermissionService._check_inherited_permissions(
                user=user,
                folder=folder.parent,
                permission_type=Permission.READ
            )
        
        return False

    @staticmethod
    def can_write_folder(user: User, folder: Folder) -> bool:
        """Проверяет право пользователя на редактирование папки."""
        if folder.owner == user:
            return True

        if Permission.objects.filter(
            user=user,
            folder=folder,
            permission_type=Permission.READ_WRITE
        ).exists():
            return True

        if folder.parent:
            return PermissionService._check_inherited_permissions(
                user=user,
                folder=folder.parent,
                permission_type=Permission.READ_WRITE
            )
        
        return False
    
    @staticmethod
    def _check_inherited_permissions(
        user: User,
        folder: Folder,
        permission_type: str
    ) -> bool:
        """Проверяет права, унаследованные от родительских папок."""
        current_folder = folder
        
        while current_folder:
            permission = Permission.objects.filter(
                user=user,
                folder=current_folder,
                inherit=True
            ).first()
            
            if permission:
                if permission_type == Permission.READ_WRITE:
                    return permission.permission_type == Permission.READ_WRITE
                return True

            current_folder = current_folder.parent
        
        return False
    
    @staticmethod
    def grant_permission(
        granted_by: User,
        user: User,
        file: Optional[File] = None,
        folder: Optional[Folder] = None,
        permission_type: str = Permission.READ,
        inherit: bool = True
    ) -> Permission:
        """Выдает пользователю право доступа к ресурсу."""
        permission, created = Permission.objects.update_or_create(
            user=user,
            file=file,
            folder=folder,
            defaults={
                'granted_by': granted_by,
                'permission_type': permission_type,
                'inherit': inherit,
            }
        )
        
        action = 'создано' if created else 'обновлено'
        resource = file.name if file else folder.name
        logger.info(
            f"Право доступа {action}: {user.email} -> {resource} "
            f"({permission_type}) by {granted_by.email}"
        )
        
        return permission
    
    @staticmethod
    def revoke_permission(
        user: User,
        file: Optional[File] = None,
        folder: Optional[Folder] = None
    ) -> bool:
        """Отзывает право доступа пользователя к ресурсу."""
        query = Q(user=user)
        
        if file:
            query &= Q(file=file)
        if folder:
            query &= Q(folder=folder)
        
        deleted_count, _ = Permission.objects.filter(query).delete()
        
        if deleted_count > 0:
            resource = file.name if file else folder.name
            logger.info(
                f"Права доступа отозваны: {user.email} -> {resource}"
            )
            return True
        
        return False
    
    @staticmethod
    def get_user_permissions(user: User) -> List[Permission]:
        """Возвращает список всех прав доступа пользователя."""
        return list(Permission.objects.filter(user=user).select_related(
            'file', 'folder', 'granted_by'
        ))
    
    @staticmethod
    def get_resource_permissions(
        file: Optional[File] = None,
        folder: Optional[Folder] = None
    ) -> List[Permission]:
        """Возвращает список прав доступа к ресурсу."""
        query = Q()
        
        if file:
            query |= Q(file=file)
        if folder:
            query |= Q(folder=folder)
        
        return list(Permission.objects.filter(query).select_related(
            'user', 'granted_by'
        ))

    @staticmethod
    def get_accessible_files(user: User) -> List[File]:
        """Возвращает список файлов, доступных пользователю."""
        return [
            file_obj
            for file_obj in File.objects.select_related("owner", "folder").filter(is_deleted=False)
            if PermissionService.can_read_file(user, file_obj)
        ]
    
    @staticmethod
    def get_accessible_folders(user: User) -> List[Folder]:
        """Возвращает список папок, доступных пользователю."""
        return [
            folder
            for folder in Folder.objects.select_related("owner", "parent").all()
            if PermissionService.can_read_folder(user, folder)
        ]


# Глобальный экземпляр сервиса
permission_service = PermissionService()
