"""
Сервис для централизованной проверки прав доступа
"""
import logging
from typing import Optional, List
from django.db.models import Q
from ep_files_app.models import Permission, File, Folder, User

logger = logging.getLogger(__name__)


class PermissionService:
    """
    Централизованный сервис для проверки и управления правами доступа
    """
    
    @staticmethod
    def can_read_file(user: User, file: File) -> bool:
        """
        Проверить, может ли пользователь читать файл
        
        Args:
            user: Пользователь
            file: Файл
            
        Returns:
            True если есть права на чтение
        """
        # Владелец всегда может читать
        if file.owner == user:
            return True
        
        # Проверяем прямые права на файл
        if Permission.objects.filter(
            user=user,
            file=file,
            permission_type__in=[Permission.READ, Permission.READ_WRITE]
        ).exists():
            return True
        
        # Проверяем наследуемые права от родительских папок
        if file.folder:
            return PermissionService._check_inherited_permissions(
                user=user,
                folder=file.folder,
                permission_type=Permission.READ
            )
        
        return False
    
    @staticmethod
    def can_write_file(user: User, file: File) -> bool:
        """
        Проверить, может ли пользователь изменять файл
        
        Args:
            user: Пользователь
            file: Файл
            
        Returns:
            True если есть права на запись
        """
        # Владелец всегда может изменять
        if file.owner == user:
            return True
        
        # Проверяем прямые права на файл
        if Permission.objects.filter(
            user=user,
            file=file,
            permission_type=Permission.READ_WRITE
        ).exists():
            return True
        
        # Проверяем наследуемые права от родительских папок
        if file.folder:
            return PermissionService._check_inherited_permissions(
                user=user,
                folder=file.folder,
                permission_type=Permission.READ_WRITE
            )
        
        return False
    
    @staticmethod
    def can_read_folder(user: User, folder: Folder) -> bool:
        """
        Проверить, может ли пользователь читать папку
        
        Args:
            user: Пользователь
            folder: Папка
            
        Returns:
            True если есть права на чтение
        """
        # Владелец всегда может читать
        if folder.owner == user:
            return True
        
        # Проверяем прямые права на папку
        if Permission.objects.filter(
            user=user,
            folder=folder,
            permission_type__in=[Permission.READ, Permission.READ_WRITE]
        ).exists():
            return True
        
        # Проверяем наследуемые права от родительских папок
        if folder.parent:
            return PermissionService._check_inherited_permissions(
                user=user,
                folder=folder.parent,
                permission_type=Permission.READ
            )
        
        return False
    
    @staticmethod
    def can_write_folder(user: User, folder: Folder) -> bool:
        """
        Проверить, может ли пользователь изменять папку
        
        Args:
            user: Пользователь
            folder: Папка
            
        Returns:
            True если есть права на запись
        """
        # Владелец всегда может изменять
        if folder.owner == user:
            return True
        
        # Проверяем прямые права на папку
        if Permission.objects.filter(
            user=user,
            folder=folder,
            permission_type=Permission.READ_WRITE
        ).exists():
            return True
        
        # Проверяем наследуемые права от родительских папок
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
        """
        Проверить наследуемые права от родительских папок
        
        Args:
            user: Пользователь
            folder: Папка для проверки
            permission_type: Тип прав (READ или READ_WRITE)
            
        Returns:
            True если есть наследуемые права
        """
        current_folder = folder
        
        while current_folder:
            # Проверяем права на текущую папку с наследованием
            permission = Permission.objects.filter(
                user=user,
                folder=current_folder,
                inherit=True
            ).first()
            
            if permission:
                # Если нужны права на запись, проверяем что они есть
                if permission_type == Permission.READ_WRITE:
                    return permission.permission_type == Permission.READ_WRITE
                # Для чтения достаточно любых прав
                return True
            
            # Переходим к родительской папке
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
        """
        Выдать права доступа
        
        Args:
            granted_by: Пользователь, выдающий права (должен быть владельцем)
            user: Пользователь, получающий права
            file: Файл (если права на файл)
            folder: Папка (если права на папку)
            permission_type: Тип прав (READ или READ_WRITE)
            inherit: Наследовать права на вложенные элементы
            
        Returns:
            Созданное право доступа
            
        Raises:
            ValidationError: Если права не могут быть выданы
        """
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
        """
        Отозвать права доступа
        
        Args:
            user: Пользователь, у которого отзываются права
            file: Файл (если права на файл)
            folder: Папка (если права на папку)
            
        Returns:
            True если права были отозваны
        """
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
        """
        Получить все права доступа пользователя
        
        Args:
            user: Пользователь
            
        Returns:
            Список прав доступа
        """
        return list(Permission.objects.filter(user=user).select_related(
            'file', 'folder', 'granted_by'
        ))
    
    @staticmethod
    def get_resource_permissions(
        file: Optional[File] = None,
        folder: Optional[Folder] = None
    ) -> List[Permission]:
        """
        Получить все права доступа к ресурсу
        
        Args:
            file: Файл
            folder: Папка
            
        Returns:
            Список прав доступа
        """
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
        """
        Получить все файлы, к которым у пользователя есть доступ
        
        Args:
            user: Пользователь
            
        Returns:
            Список файлов
        """
        # Файлы, которыми владеет пользователь
        owned_files = File.objects.filter(owner=user)
        
        # Файлы, на которые есть прямые права
        permitted_file_ids = Permission.objects.filter(
            user=user,
            file__isnull=False
        ).values_list('file_id', flat=True)
        
        permitted_files = File.objects.filter(id__in=permitted_file_ids)
        
        # Объединяем и убираем дубликаты
        all_files = (owned_files | permitted_files).distinct()
        
        return list(all_files)
    
    @staticmethod
    def get_accessible_folders(user: User) -> List[Folder]:
        """
        Получить все папки, к которым у пользователя есть доступ
        
        Args:
            user: Пользователь
            
        Returns:
            Список папок
        """
        # Папки, которыми владеет пользователь
        owned_folders = Folder.objects.filter(owner=user)
        
        # Папки, на которые есть прямые права
        permitted_folder_ids = Permission.objects.filter(
            user=user,
            folder__isnull=False
        ).values_list('folder_id', flat=True)
        
        permitted_folders = Folder.objects.filter(id__in=permitted_folder_ids)
        
        # Объединяем и убираем дубликаты
        all_folders = (owned_folders | permitted_folders).distinct()
        
        return list(all_folders)


# Глобальный экземпляр сервиса
permission_service = PermissionService()
