"""
Сервис для централизованной проверки прав доступа
"""
import logging
from typing import Optional, List
from django.db.models import Q
from ep_files_app.models import Permission, File, Folder, User

logger = logging.getLogger(__name__)


class PermissionService:
    """Централизованный сервис для проверки и управления правами доступа.

    Инфраструктурный компонент системы, реализующий бизнес-логику разграничения
    прав пользователей (ACL) на уровне файлов и папок. Инкапсулирует в себе
    алгоритмы наследования разрешений по древовидной структуре каталогов,
    операции создания, обновления и отзыва индивидуальных прав доступа, а также
    методы генерации списков доступных ресурсов для конкретных пользователей.

    Все методы класса спроектированы как статические (``@staticmethod``) и не требуют
    инициализации экземпляра сервиса для своей работы.

    Methods:
        can_read_file(user, file): Проверяет права на чтение конкретного файла.
        can_write_file(user, file): Проверяет права на изменение конкретного файла.
        can_read_folder(user, folder): Проверяет права на просмотр конкретной папки.
        can_write_folder(user, folder): Проверяет права на изменение конкретной папки.
        grant_permission(granted_by, user, ...): Выдает или обновляет права доступа на ресурс.
        revoke_permission(user, file, folder): Аннулирует права доступа к ресурсу.
        get_user_permissions(user): Собирает все индивидуальные права пользователя.
        get_resource_permissions(file, folder): Находит все выданные права на ресурс.
        get_accessible_files(user): Возвращает список доступных пользователю файлов.
        get_accessible_folders(user): Возвращает список доступных пользователю папок.
    """
    
    @staticmethod
    def can_read_file(user: User, file: File) -> bool:
        """Проверяет наличие у пользователя прав на чтение (просмотр) файла.

        Разрешение предоставляется, если выполняется хотя бы одно из условий:
        1. Пользователь является прямым владельцем файла.
        2. Существует прямая запись прав доступа для данного файла с типом READ или READ_WRITE.
        3. Пользователь наследует права на чтение от родительских папок, в которых расположен файл.

        Args:
            user (User): Экземпляр модели пользователя, чьи права проверяются.
            file (File): Экземпляр модели файла, к которому запрашивается доступ.

        Returns:
            bool: True, если доступ на чтение разрешен, иначе False.

        Examples:
            >>> is_allowed = PermissionService.can_read_file(current_user, target_file)
        """
        if file.owner == user:
            return True

        if Permission.objects.filter(
            user=user,
            file=file,
            permission_type__in=[Permission.READ, Permission.READ_WRITE]
        ).exists():
            return True

        if file.folder:
            return PermissionService._check_inherited_permissions(
                user=user,
                folder=file.folder,
                permission_type=Permission.READ
            )
        
        return False
    
    @staticmethod
    def can_write_file(user: User, file: File) -> bool:
        """Проверяет наличие у пользователя прав на изменение (запись/удаление) файла.

        Разрешение предоставляется, если выполняется хотя бы одно из условий:
        1. Пользователь является прямым владельцем файла.
        2. Существует прямая запись прав доступа для данного файла с типом READ_WRITE.
        3. Пользователь наследует права на запись от родительских папок, в которых расположен файл.

        Args:
            user (User): Экземпляр модели пользователя, чьи права проверяются.
            file (File): Экземпляр модели файла, к которому запрашивается доступ на модификацию.

        Returns:
            bool: True, если доступ на запись разрешен, иначе False.

        Examples:
            >>> is_allowed = PermissionService.can_write_file(current_user, target_file)
        """
        if file.owner == user:
            return True

        if Permission.objects.filter(
            user=user,
            file=file,
            permission_type=Permission.READ_WRITE
        ).exists():
            return True

        if file.folder:
            return PermissionService._check_inherited_permissions(
                user=user,
                folder=file.folder,
                permission_type=Permission.READ_WRITE
            )
        
        return False
    
    @staticmethod
    def can_read_folder(user: User, folder: Folder) -> bool:
        """Проверяет наличие у пользователя прав на чтение (просмотр содержимого) папки.

        Разрешение предоставляется, если выполняется хотя бы одно из условий:
        1. Пользователь является прямым владельцем папки.
        2. Существует прямая запись прав доступа для данной папки с типом READ или READ_WRITE.
        3. Пользователь наследует права на чтение от вышестоящих (родительских) директорий.

        Args:
            user (User): Экземпляр модели пользователя, чьи права проверяются.
            folder (Folder): Экземпляр модели папки, к которой запрашивается доступ.

        Returns:
            bool: True, если доступ на чтение папки разрешен, иначе False.

        Examples:
            >>> is_allowed = PermissionService.can_read_folder(current_user, target_folder)
        """
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
        """Проверяет наличие у пользователя прав на изменение папки.

        Разрешение предоставляется, если выполняется хотя бы одно из условий:
        1. Пользователь является владельцем папки.
        2. Существует прямая запись прав доступа для данной папки с типом READ_WRITE.
        3. Пользователь наследует права на запись от вышестоящих (родительских) директорий.

        Args:
            user (User): Экземпляр модели пользователя, чьи права проверяются.
            folder (Folder): Экземпляр модели папки, для которой запрашивается доступ на запись.

        Returns:
            bool: True, если доступ на изменение папки разрешен, иначе False.

        Examples:
            >>> is_allowed = PermissionService.can_write_folder(current_user, target_folder)
        """
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
        """Рекурсивно проверяет наследуемые права доступа вверх по дереву каталогов.

        Итерируется от текущей папки к её родителям (parent) до корня файловой системы.
        Если на каком-либо уровне обнаруживается запись прав с флагом ``inherit=True``,
        функция валидирует соответствие типа найденного разрешения запрашиваемому.

        Args:
            user (User): Экземпляр модели пользователя, чьи права проверяются.
            folder (Folder): Начальная папка (родитель ресурса), с которой запускается обход дерева.
            permission_type (str): Запрашиваемый уровень прав (``Permission.READ`` или ``Permission.READ_WRITE``).

        Returns:
            bool: True, если найдено наследуемое правило, покрывающее запрашиваемый тип прав. Иначе False.

        Note:
            При поиске прав уровня ``Permission.READ_WRITE`` тип найденного правила обязан строго
            соответствовать ``Permission.READ_WRITE``. Для ``Permission.READ`` достаточно любого правила.
        """
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
        """Выдает или обновляет права доступа пользователя к определенному ресурсу.

        Использует атомарную операцию создания или обновления (update_or_create) для связки
        пользователя с файлом или папкой. По окончании операции записывает событие в системный лог.

        Args:
            granted_by (User): Пользователь, делегирующий права (обычно владелец ресурса).
            user (User): Пользователь, которому предоставляются права.
            file (File, optional): Экземпляр целевого файла, если права выдаются на файл.
            folder (Folder, optional): Экземпляр целевой папки, если права выдаются на папку.
            permission_type (str, optional): Тип прав (``READ`` или ``READ_WRITE``). По умолчанию ``Permission.READ``.
            inherit (bool, optional): Флаг наследования прав на вложенные элементы (актуально для папок). По умолчанию True.

        Returns:
            Permission: Созданный или обновленный экземпляр модели Permission.

        Raises:
            ValidationError: Если параметры распределения прав нарушают бизнес-логику БД.

        Examples:
            >>> perm = PermissionService.grant_permission(owner_user, guest_user, folder=target_folder)
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
        """Полностью отзывает (удаляет) права доступа пользователя к указанному ресурсу.

        Формирует динамический запрос фильтрации на основе переданных аргументов (файл и/или папка)
        и удаляет соответствующие записи из таблицы разрешений.

        Args:
            user (User): Пользователь, у которого аннулируются права.
            file (File, optional): Целевой файл, доступ к которому необходимо закрыть.
            folder (Folder, optional): Целевая папка, доступ к которой необходимо закрыть.

        Returns:
            bool: True, если была удалена хотя бы одна запись прав доступа. False, если прав не существовало.

        Examples:
            >>> was_revoked = PermissionService.revoke_permission(guest_user, file=target_file)
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
        """Возвращает полный список всех индивидуальных прав доступа, выданных пользователю.

        Оптимизирует запрос к базе данных с помощью ``select_related`` для предзагрузки
        связанных сущностей (файлы, папки, инициаторы прав), минимизируя проблему N+1.

        Args:
            user (User): Пользователь, для которого собирается статистика разрешений.

        Returns:
            List[Permission]: Список объектов прав доступа, привязанных к данному пользователю.

        Examples:
            >>> active_perms = PermissionService.get_user_permissions(current_user)
        """
        return list(Permission.objects.filter(user=user).select_related(
            'file', 'folder', 'granted_by'
        ))
    
    @staticmethod
    def get_resource_permissions(
        file: Optional[File] = None,
        folder: Optional[Folder] = None
    ) -> List[Permission]:
        """Возвращает список всех действующих прав доступа, привязанных к конкретному ресурсу.

        Позволяет узнать, какие пользователи обладают доступом к файлу или папке. Объединяет условия
        поиска через оператор OR (``|``), если переданы оба параметра, и оптимизирует связи.

        Args:
            file (File, optional): Файл, для которого запрашивается аудит разрешений.
            folder (Folder, optional): Папка, для которой запрашивается аудит разрешений.

        Returns:
            List[Permission]: Список объектов прав доступа, действующих для данного ресурса.

        Examples:
            >>> resource_perms = PermissionService.get_resource_permissions(file=target_file)
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
        """Возвращает полный список файлов, доступных пользователю для чтения или изменения.

        Формирует выборку на основе двух критериев: прямое владение файлом
        и наличие явных индивидуальных разрешений в таблице ``Permission``.
        Результаты объединяются на уровне базы данных с исключением дубликатов.

        Args:
            user (User): Экземпляр модели пользователя, для которого запрашивается
                список доступных файлов.

        Returns:
            List[File]: Список уникальных объектов файлов, к которым пользователь
            имеет легитимный доступ.

        Examples:
            >>> files = PermissionService.get_accessible_files(current_user)

        Note:
            Данный метод учитывает только собственные файлы и файлы с прямыми правами.
            Файлы, доступные исключительно по наследованию от папок, в эту выборку
            не попадают.
        """
        owned_files = File.objects.filter(owner=user)

        permitted_file_ids = Permission.objects.filter(
            user=user,
            file__isnull=False
        ).values_list('file_id', flat=True)
        
        permitted_files = File.objects.filter(id__in=permitted_file_ids)

        all_files = (owned_files | permitted_files).distinct()
        
        return list(all_files)
    
    @staticmethod
    def get_accessible_folders(user: User) -> List[Folder]:
        """Возвращает полный список папок, доступных пользователю для просмотра или изменения.

        Формирует выборку на основе двух критериев: прямое владение папкой
        и наличие явных индивидуальных разрешений в таблице ``Permission``.
        Объединение множеств выполняется через OR-запрос (``|``) с вызовом ``distinct()``.

        Args:
            user (User): Экземпляр модели пользователя, для которого запрашивается
                список доступных папок.

        Returns:
            List[Folder]: Список уникальных объектов папок, к которым пользователь
            имеет легитимный доступ.

        Examples:
            >>> folders = PermissionService.get_accessible_folders(current_user)

        Note:
            Метод возвращает папки, на которые у пользователя есть явные права.
            Вложенные папки, доступные только за счет флага наследования (inherit),
            не включаются в итоговый список.
        """
        owned_folders = Folder.objects.filter(owner=user)

        permitted_folder_ids = Permission.objects.filter(
            user=user,
            folder__isnull=False
        ).values_list('folder_id', flat=True)
        
        permitted_folders = Folder.objects.filter(id__in=permitted_folder_ids)

        all_folders = (owned_folders | permitted_folders).distinct()
        
        return list(all_folders)


# Глобальный экземпляр сервиса
permission_service = PermissionService()
