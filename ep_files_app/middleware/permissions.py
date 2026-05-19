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
    """Middleware для сквозной автоматической проверки прав доступа к ресурсам файловой системы.

    Перехватывает входящие HTTP-запросы на этапе их обработки Django, сопоставляет запрошенные
    URL-адреса с регулярными выражениями защищаемых ресурсов (файлов и папок) и валидирует
    права аутентифицированного пользователя через ``PermissionService``. В случае отсутствия
    необходимых привилегий прерывает дальнейшее выполнение запроса и мгновенно возвращает
    структурированный ответ с кодом 403 Forbidden.

    Attributes:
        FILE_PATTERNS (list): Набор кортежей из регулярного выражения URL-адреса файла
            и требуемого уровня доступа (``'read'`` или ``'write'``).
        FOLDER_PATTERNS (list): Набор кортежей из регулярного выражения URL-адреса папки
            и требуемого уровня доступа (``'read'`` или ``'write'``).

    Methods:
        __init__(get_response): Сохраняет ссылку на следующий компонент в конвейере обработки.
        __call__(request): Точка входа middleware, управляющая жизненным циклом запроса.
        _check_permissions(request): Маршрутизирует запрос на основе URL-шаблонов.
        _check_file_permission(...): Выполняет проверку прав доступа на уровне файла.
        _check_folder_permission(...): Выполняет проверку прав доступа на уровне папки.
    """

    FILE_PATTERNS = [
        (r'^/api/files/(\d+)/download/$', 'read'),
        (r'^/api/files/(\d+)/$', 'write'),  # DELETE
        (r'^/api/files/(\d+)/detail/$', 'read'),
        (r'^/api/files/(\d+)/history/$', 'read'),
    ]
    
    FOLDER_PATTERNS = [
        (r'^/api/folders/(\d+)/rename/$', 'write'),
        (r'^/api/folders/(\d+)/move/$', 'write'),
        (r'^/api/folders/(\d+)/delete/$', 'write'),
    ]
    
    def __init__(self, get_response):
        """Инициализирует слой промежуточного ПО (middleware).

                Args:
                    get_response (callable): Следующий обработчик (middleware или view)
                        в цепочке выполнения Django.
                """
        self.get_response = get_response
    
    def __call__(self, request):
        """Основной метод обработки входящего HTTP-запроса.

                Проверяет, авторизован ли пользователь. Если да, запускает логику верификации
                прав. При обнаружении нарушений безопасности возвращает объект ошибки.
                При успешной проверке передает управление дальше по цепочке.

                Args:
                    request (HttpRequest): Объект текущего веб-запроса Django.

                Returns:
                    HttpResponse: Объект ``JsonResponse`` со статусом 403 при блокировке,
                    либо стандартный ответ ``HttpResponse`` от нижележащих слоев системы.
                """
        if request.user and request.user.is_authenticated:
            permission_check = self._check_permissions(request)
            if permission_check is not None:
                return permission_check
        
        response = self.get_response(request)
        return response
    
    def _check_permissions(self, request):
        """Идентифицирует запрашиваемый ресурс по URL-шаблонам и проверяет права на него.

        Итерируется по спискам регулярных выражений ``FILE_PATTERNS`` и ``FOLDER_PATTERNS``.
        Если путь совпадает с шаблоном, извлекает ID ресурса и передает его в
        соответствующий специализированный метод проверки.

        Args:
            request (HttpRequest): Объект текущего веб-запроса Django.

        Returns:
            Optional[JsonResponse]: Объект ``JsonResponse`` (403 Forbidden), если
            доступ к ресурсу строго запрещен, или ``None``, если проверка пройдена
            или URL не подлежит валидации.
        """
        path = request.path
        method = request.method

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
        """Осуществляет детальную верификацию прав доступа пользователя к конкретному файлу.

        Извлекает объект файла из БД. Если файл не найден, делегирует обработку слою View
        (возвращая None). Если метод запроса эквивалентен ``DELETE``, уровень доступа
        принудительно повышается до ``'write'``. При отказе в доступе фиксирует инцидент
        в логах и формирует JSON-ответ.

        Args:
            user (User): Экземпляр модели авторизованного пользователя.
            file_id (int): Идентификатор проверяемого файла.
            required_permission (str): Запрашиваемый тип операции (``'read'`` или ``'write'``).
            method (str): HTTP-метод текущего запроса (например, 'GET', 'DELETE').

        Returns:
            Optional[JsonResponse]: ``JsonResponse`` с описанием ошибки и кодом 403,
            если у пользователя нет прав на файл, иначе ``None``.
        """
        try:
            file = File.objects.get(id=file_id)
        except File.DoesNotExist:
            return None

        if method == 'DELETE':
            required_permission = 'write'

        if required_permission == 'read':
            has_permission = permission_service.can_read_file(user, file)
        else:
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
        """Осуществляет детальную верификацию прав доступа пользователя к конкретной папке.

        Извлекает объект директории из БД. Если она отсутствует, возвращает ``None``
        для последующей обработки стандартными механизмами Django (404 Not Found).
        При нехватке прав формирует предупреждение (warning) в системе логирования
        и блокирует запрос.

        Args:
            user (User): Экземпляр модели авторизованного пользователя.
            folder_id (int): Идентификатор проверяемой папки.
            required_permission (str): Запрашиваемый тип операции (``'read'`` или ``'write'``).

        Returns:
            Optional[JsonResponse]: ``JsonResponse`` с описанием ошибки и кодом 403,
            если у пользователя нет прав на папку, иначе ``None``.
        """
        try:
            folder = Folder.objects.get(id=folder_id)
        except Folder.DoesNotExist:
            return None

        if required_permission == 'read':
            has_permission = permission_service.can_read_folder(user, folder)
        else:
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
