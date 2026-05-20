"""Views for the EP Files API."""
import io
import logging
import mimetypes
import os
import zipfile
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.core.exceptions import ValidationError
from django.db.models import Count, Sum
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from ep_files_app.models.models import (
    File, FileOperationFacade, Folder,
    ImagePreview, PreviewFactory, User, FavoriteFile,
)
from ep_files_app.models.file_history import FileHistory
from ep_files_app.services.file_event_service import file_event_service
from ep_files_app.services.permission_service import permission_service
from ep_files_app.permissions import IsAdminUser, IsFileOwner, CanUploadFiles
from ep_files_app.validators import (
    sanitize_filename, validate_file_extension,
    validate_file_size, validate_filename,
)
from .serializers import FileSerializer, UserRegistrationSerializer, UserSerializer

logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    """API-представление для регистрации новых пользователей в системе.

    Наследуется от ``generics.CreateAPIView``, предоставляя готовый эндпоинт для
    обработки POST-запросов. Доступ к представлению открыт для всех пользователей
    без предварительной авторизации. При успешном создании аккаунта автоматически
    генерирует и возвращает пару JWT-токенов доступа.

    Attributes:
        queryset: Набор данных, содержащий все объекты модели :class:`User`.
        permission_classes (tuple): Разрешает анонимный доступ (``AllowAny``).
        serializer_class: Класс сериализатора :class:`UserRegistrationSerializer`.
    """

    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserRegistrationSerializer

    def create(self, request, *args, **kwargs):
        """Обрабатывает входящий запрос на регистрацию и возвращает JWT-токены.

        Выполняет валидацию переданных данных (email, пароль, имя). В случае успеха
        создает учетную запись, генерирует для нее ``access`` и ``refresh`` токены
        через библиотеку Simple JWT, а также сериализует созданный профиль.

        Args:
            request (Request): Объект POST-запроса Django REST Framework.
            *args: Дополнительные позиционные аргументы.
            **kwargs: Дополнительные именованные аргументы.

        Returns:
            Response: Объект ответа со статусом HTTP 201 Created и JSON-структурой:
                - token (str): Строковое представление JWT Access токена.
                - refresh (str): Строковое представление JWT Refresh токена.
                - user (dict): Сериализованные данные пользователя через :class:`UserSerializer`.

        Raises:
            ValidationError: Если входящие данные не прошли валидацию (например, email занят
                или пароль слишком короткий).

        Examples:
            >>> # Пример успешного ответа (Response.data):
            >>> {
            ...     "token": "eyJhbGciOiJIUzI1...",
            ...     "refresh": "eyJhbGciOiJIUzI1...",
            ...     "user": {
            ...         "id": 1,
            ...         "name": "Иван",
            ...         "email": "ivan@example.com",
            ...         "is_staff": False,
            ...         "is_superuser": False,
            ...         "is_active": True,
            ...         "date_joined": "2026-05-19T12:00:00Z"
            ...     }
            ... }
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        user = serializer.instance
        logger.info(
            "User registered: %s",
            user.email,
            extra={"user": user.email},
        )
        refresh = RefreshToken.for_user(user)
        data = {
            "token": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data,
        }
        headers = self.get_success_headers(serializer.data)
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)


class LoginView(APIView):
    """API-представление для аутентификации пользователей и выдачи JWT-токенов.

    Базируется на низкоуровневом классе ``APIView`` и обрабатывает POST-запросы
    с учетными данными. Позволяет анонимным пользователям войти в систему,
    если они предоставят корректную пару email и пароль.

    Attributes:
        permission_classes (tuple): Разрешает анонимный доступ (``AllowAny``).
    """

    permission_classes = (AllowAny,)

    def post(self, request):
        """Аутентифицирует пользователя по email и паролю, возвращая JWT-токены.

        Ищет пользователя в базе данных по указанному email. При совпадении хэша
        пароля с помощью функции ``check_password``, выпускает новую пару токенов
        (access и refresh) и собирает метаданные профиля. Если данные неверны,
        возвращает ошибку авторизации.

        Args:
            request (Request): Объект POST-запроса Django REST Framework,
                содержащий в ``request.data`` поля ``email`` и ``password``.

        Returns:
            Response: Объект ответа со статусом HTTP 200 OK и JSON-токенами при успехе.
            Response: Объект ответа со статусом HTTP 401 Unauthorized и JSON-ошибкой
                ``{"error": "Invalid credentials"}`` при неверных данных.

        Examples:
            >>> # Пример ответа при ошибке аутентификации (status=401):
            >>> {
            ...     "error": "Invalid credentials"
            ... }
        """
        email = request.data.get("email")
        password = request.data.get("password")
        user = User.objects.filter(email=email).first()
        if user and check_password(password, user.password_hash):
            logger.info(
                "User logged in: %s",
                user.email,
                extra={"user": user.email},
            )
            refresh = RefreshToken.for_user(user)
            return Response({
                "token": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
            })
        logger.warning(
            "Failed login attempt for email: %s",
            email,
            extra={"user": email or "anonymous"},
        )
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)


class MeView(APIView):
    """API-представление для получения информации о текущем авторизованном пользователе.

    Позволяет клиентскому приложению запрашивать данные профиля владельца
    используемого JWT-токена для инициализации сессии на фронтенде. Вход на данный
    эндпоинт строго ограничен для неавторизованных лиц.

    Attributes:
        permission_classes (tuple): Требует обязательную JWT-авторизацию (``IsAuthenticated``).
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        """Возвращает сериализованные данные текущего аутентифицированного пользователя.

        Извлекает объект пользователя из контекста запроса, куда он автоматически
        помещается прослойкой авторизации (Middleware/Authentication class).

        Args:
            request (Request): Объект GET-запроса Django REST Framework,
                содержащий экземпляр модели пользователя в ``request.user``.

        Returns:
            Response: Объект ответа со статусом HTTP 200 OK и JSON-структурой:
                - user (dict): Данные пользователя, обработанные через :class:`UserSerializer`.

        Examples:
            >>> # Запрос GET /api/auth/me/ с валидным Bearer токеном
            >>> # Возвращает (Response.data):
            >>> {
            ...     "user": {
            ...         "id": 1,
            ...         "name": "Иван",
            ...         "email": "ivan@example.com",
            ...         "is_staff": False,
            ...         "is_superuser": False,
            ...         "is_active": True,
            ...         "date_joined": "2026-05-19T12:00:00Z"
            ...     }
            ... }
    """
        return Response({"user": UserSerializer(request.user).data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def protected_test_view(request):
    """Тестовый эндпоинт для проверки работоспособности JWT-аутентификации.

    Используется клиентскими приложениями или системами мониторинга для верификации
    актуальности access-токена. Доступ к представлению разрешен только после успешной
    валидации заголовка авторизации.

    Args:
        request (Request): Объект входящего запроса Django REST Framework,
            содержащий объект авторизованного пользователя в ``request.user``.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK и JSON-структурой:
            - message (str): Текстовое подтверждение успешного доступа.

    Examples:
        >>> # Запрос GET /api/test/protected/ с валидным JWT-токеном в заголовках
        >>> # Возвращает (Response.data):
        >>> {
        ...     "message": "Access granted. JWT is working."
        ... }
    """

    return Response({"message": "Access granted. JWT is working."})


@api_view(["POST"])
@permission_classes([IsAuthenticated, CanUploadFiles])
def upload_file(request):
    """Загружает файл в систему с выполнением комплексных проверок безопасности.

    Выполняет многоуровневую валидацию входящего бинарного потока (имя файла, расширение,
    размер). Проверяет права владения на целевую папку, если указан ``folder_id``.
    Производит очистку имени файла от потенциально опасных символов (санитизацию),
    сохраняет объект в базу данных, генерирует системное событие аудита и логирует
    информацию о загрузке.

    Args:
        request (Request): Объект входящего запроса Django REST Framework. Ожидает
            передачу файла в ``request.FILES['file']`` и опциональный ``folder_id``
            в ``request.data``.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 201 Created при успехе:
            - message (str): Сообщение об успешной загрузке.
            - file (dict): Сериализованные данные сохраненного файла через :class:`FileSerializer`.
        Response: Объект ответа со статусом HTTP 400 Bad Request, если файл не передан
            или не прошел одну из валидаций (имя, расширение, размер).
        Response: Объект ответа со статусом HTTP 404 Not Found, если указанная папка
            не существует или не принадлежит текущему пользователю.
        Response: Объект ответа со статусом HTTP 405 Method Not Allowed, если тип запроса отличный от POST.
        Response: Объект ответа со статусом HTTP 500 Internal Server Error при критическом сбое.

    Raises:
        ValidationError: Ошибка валидации параметров файла (перехватывается внутри функции).
        Folder.DoesNotExist: Отсутствие целевой папки в БД (перехватывается внутри функции).
        Exception: Любая непредвиденная ошибка времени выполнения.

    Examples:
        >>> # Пример успешного JSON-ответа при загрузке (Response.data):
        >>> {
        ...     "message": "File uploaded successfully",
        ...     "file": {
        ...         "id": 154,
        ...         "name": "safe_document.pdf",
        ...         "size": 1048576,
        ...         "date": "2026-05-19T16:17:00Z",
        ...         "owner_email": "user@example.com",
        ...         "download_url": "/api/download/154/",
        ...         "folder": 7
        ...     }
        ... }
    """
    if request.method != "POST":
        return Response({"error": "Method not allowed"}, status=status.HTTP_405_METHOD_NOT_ALLOWED)
    try:
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"error": "File not provided"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_filename(uploaded_file.name)
        except ValidationError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_file_extension(uploaded_file.name)
        except ValidationError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_file_size(uploaded_file)
        except ValidationError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        
        folder = None
        folder_id = request.data.get("folder_id")
        if folder_id:
            try:
                folder = Folder.objects.get(id=folder_id, owner=request.user)
            except Folder.DoesNotExist:
                return Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)
        
        safe_filename = sanitize_filename(uploaded_file.name)
        file_obj = File(
            name=safe_filename,
            size=uploaded_file.size,
            owner=request.user,
            file=uploaded_file,
            folder=folder,
        )
        file_obj.save()
        file_event_service.emit_upload_event(
            file=file_obj,
            user=request.user,
            ip_address=request.META.get("REMOTE_ADDR"),
            details={"size": uploaded_file.size, "original_name": uploaded_file.name},
        )
        logger.info("File uploaded: %s by user %s", safe_filename, request.user.email)
        return Response({
            "message": "File uploaded successfully",
            "file": FileSerializer(file_obj).data,
        }, status=status.HTTP_201_CREATED)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("File upload error: %s", str(exc))
        return Response({"error": "Upload failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toggle_favorite(request, item_id):
    """Универсальное переключение (атомарное добавление/удаление) ресурса в список избранного.

    В зависимости от переданного параметра ``type`` в теле запроса, идентифицирует целевой
    объект как файл или папку. Проверяет права владения текущего пользователя над объектом.
    Если объект уже находится в избранном у данного пользователя, удаляет связь из таблицы
    :class:`FavoriteFile`. Если объект отсутствует в избранном — создает новую запись.

    Args:
        request (Request): Объект входящего запроса Django REST Framework. Ожидает
            параметр ``type`` ("file" или "folder") в ``request.data``. По умолчанию "file".
        item_id (int): Идентификатор (первичный ключ) переключаемого файла или папки.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK при успешном переключении:
            - is_favorite (bool): Текущий статус нахождения в избранном (True/False).
            - message (str): Текстовое уведомление о совершенном действии на русском языке.
        Response: Объект ответа со статусом HTTP 404 Not Found, если целевой файл или папка
            не существуют в базе данных либо не принадлежат авторизованному пользователю.

    Raises:
        Folder.DoesNotExist: Если передан тип "folder", но папка с таким ``item_id`` не найдена (перехватывается).
        File.DoesNotExist: Если передан тип "file", но файл с таким ``item_id`` не найден (перехватывается).

    Examples:
        >>> # Добавление папки в избранное (Response.data):
        >>> {
        ...     "is_favorite": True,
        ...     "message": "Папка добавлена в избранное"
        ... }
        >>> # Удаление файла из избранного (Response.data):
        >>> {
        ...     "is_favorite": False,
        ...     "message": "Файл удален из избранного"
        ... }
    """
    item_type = request.data.get("type", "file")

    if item_type == "folder":
        try:
            item_obj = Folder.objects.get(id=item_id, owner=request.user)
            fav_queryset = FavoriteFile.objects.filter(user=request.user, folder=item_obj)
            if fav_queryset.exists():
                fav_queryset.delete()
                return Response({"is_favorite": False, "message": "Папка удалена из избранного"})
            FavoriteFile.objects.create(user=request.user, folder=item_obj)
            return Response({"is_favorite": True, "message": "Папка добавлена в избранное"})
        except Folder.DoesNotExist:
            return Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)
    else:
        try:
            item_obj = File.objects.get(id=item_id, owner=request.user)
            fav_queryset = FavoriteFile.objects.filter(user=request.user, file=item_obj)
            if fav_queryset.exists():
                fav_queryset.delete()
                return Response({"is_favorite": False, "message": "Файл удален из избранного"})
            FavoriteFile.objects.create(user=request.user, file=item_obj)
            return Response({"is_favorite": True, "message": "Файл добавлен в избранное"})
        except File.DoesNotExist:
            return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_user_favorites(request):
    """Возвращает агрегированные списки и подробные метаданные всех избранных объектов пользователя.

    Формирует комплексную структуру данных для отображения в личном кабинете. Выполняет
    выборку из таблицы :class:`FavoriteFile` по текущему пользователю, разделяет сущности на
    плоские списки идентификаторов (для быстрой сверки состояний на фронтенде) и собирает
    детализированный массив объектов с именами, типами и размерами элементов.

    Args:
        request (Request): Объект входящего GET-запроса Django REST Framework,
            содержащий авторизованного пользователя в ``request.user``.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK и JSON-структурой:
            - file_ids (list[int]): Плоский список уникальных ID всех избранных файлов.
            - folder_ids (list[int]): Плоский список уникальных ID всех избранных папок.
            - items (list[dict]): Массив подробных объектов для рендеринга интерфейса. Каждый
              элемент содержит ключи ``id``, ``name``, ``type`` ("file"/"folder") и ``size``.

    Examples:
        >>> # Пример успешного ответа (Response.data):
        >>> {
        ...     "file_ids": [42, 105],
        ...     "folder_ids": [7],
        ...     "items": [
        ...         {"id": 42, "name": "report.pdf", "type": "file", "size": 1048576},
        ...         {"id": 7, "name": "Documents", "type": "folder", "size": 0}
        ...     ]
        ... }
    """
    favs = FavoriteFile.objects.filter(user=request.user)

    result = []
    for f in favs:
        if f.file:
            result.append({"id": f.file.id, "name": f.file.name, "type": "file", "size": f.file.size})
        elif f.folder:
            result.append({"id": f.folder.id, "name": f.folder.name, "type": "folder", "size": 0})

    return Response({
        "file_ids": list(favs.filter(file__isnull=False).values_list('file_id', flat=True)),
        "folder_ids": list(favs.filter(folder__isnull=False).values_list('folder_id', flat=True)),
        "items": result
    })


def add_folder_to_zip(zip_file, folder, current_path=""):
    """Рекурсивно собирает древовидную структуру папок и файлов из СУБД в ZIP-архив.

    Функция обходит базу данных сверху вниз, начиная с переданного объекта папки.
    На первом этапе извлекает все файлы, привязанные к текущему ``folder_id``, проверяет
    их физическое наличие на диске сервера и упаковывает в архив с сохранением относительного
    пути. На втором этапе находит все дочерние папки по ``parent_id`` и рекурсивно
    вызывает себя для погружения на следующий уровень вложенности.

    Args:
        zip_file (ZipFile): Открытый экземпляр класса :class:`zipfile.ZipFile` в режиме записи.
        folder (Folder): Экземпляр модели папки, выступающий текущим узлом рекурсивного обхода.
        current_path (str): Текущий относительный путь внутри формируемого ZIP-архива.
            Используется для сохранения корректной иерархии папок. По умолчанию "".

    Returns:
        None

    Raises:
        OSError: При возникновении ошибок чтения файлов с физического диска сервера.
        ValueError: При передаче некорректно инициализированного объекта архива.
    """
    files = File.objects.filter(folder_id=folder.id)
    for file_rec in files:
        if file_rec.file and os.path.exists(file_rec.file.path):
            archive_path = os.path.join(current_path, file_rec.name)
            zip_file.write(file_rec.file.path, archive_path)

    subfolders = Folder.objects.filter(parent_id=folder.id)
    for subfolder in subfolders:
        new_path = os.path.join(current_path, subfolder.name)
        add_folder_to_zip(zip_file, subfolder, new_path)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_folder(request, folder_id):
    """Архивирует указанную папку со всеми вложенными элементами и отдает ZIP-файл.

    Находит папку по её идентификатору и проверяет, является ли текущий пользователь
    её владельцем. Инициализирует виртуальный байтовый буфер памяти ``io.BytesIO``
    и упаковывает структуру директории в сжатый ZIP-архив с помощью вспомогательной
    функции ``add_folder_to_zip``. Перематывает указатель буфера в начало и возвращает
    бинарный поток клиенту.

    Args:
        request (Request): Объект входящего запроса Django REST Framework.
        folder_id (int): Идентификатор (первичный ключ) запрашиваемой папки.

    Returns:
        FileResponse: Потоковый ответ Django со статусом HTTP 200 OK, содержащий
            сформированный ZIP-архив, MIME-тип ``application/zip`` и корректный
            заголовок ``Content-Disposition``.
        Response: Объект ответа со статусом HTTP 404 Not Found, если папка не найдена
            или принадлежит другому пользователю.
        Response: Объект ответа со статусом HTTP 500 Internal Server Error при сбое
            в процессе архивации или чтения диска.

    Raises:
        Folder.DoesNotExist: Если папка с указанным идентификатором отсутствует (перехватывается).
        Exception: При любых непредвиденных ошибках ввода-вывода (перехватывается).

    Examples:
        >>> # Запрос GET /api/folders/7/download/
        >>> # Возвращает бинарный поток (FileResponse) с заголовками:
        >>> # Content-Disposition: attachment; filename="Vacation_Photos.zip"
        >>> # Content-Type: application/zip
    """
    try:
        folder_rec = Folder.objects.get(id=folder_id, owner=request.user)

        memory_file = io.BytesIO()
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            add_folder_to_zip(zip_file, folder_rec, folder_rec.name)

        memory_file.seek(0)

        response = FileResponse(memory_file, content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="{folder_rec.name}.zip"'
        return response

    except Folder.DoesNotExist:
        return Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as exc:
        return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_files(request):
    """Возвращает список всех личных файлов текущего авторизованного пользователя.

    Выполняет фильтрацию записей в таблице :class:`File` по полю ``owner``. Полученный
    набор данных сортируется по убыванию даты добавления/изменения (сначала новые).
    Данные преобразуются в JSON-формат через сериализатор.

    Args:
        request (Request): Объект входящего запроса Django REST Framework,
            содержащий экземпляр пользователя в ``request.user``.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK, содержащий
            массив сериализованных объектов файлов.

    Examples:
        >>> # Запрос GET /api/files/ (Response.data):
        >>> [
        ...     {
        ...         "id": 154,
        ...         "name": "presentation.pptx",
        ...         "size": 5242880,
        ...         "date": "2026-05-19T14:10:00Z",
        ...         "owner_email": "user@example.com",
        ...         "download_url": "/api/download/154/",
        ...         "folder": None
        ...     }
        ... ]
    """
    files = File.objects.filter(owner=request.user).order_by("-date")
    return Response(FileSerializer(files, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_file(request, file_id):
    """Инициирует процедуру прямого скачивания файла по его идентификатору.

    Ищет файл в системе. Проверяет права доступа: текущий пользователь должен являться
    прямым владельцем данного файла. Проверяет физическое присутствие файла в хранилище.
    Генерирует системное событие аудита скачивания, определяет MIME-тип на основе расширения
    и отправляет файл в виде бинарного потока.

    Args:
        request (Request): Объект входящего запроса Django REST Framework.
        file_id (int): Идентификатор (первичный ключ) запрашиваемого файла.

    Returns:
        FileResponse: Потоковый ответ Django, содержащий тело файла, заголовок
            ``Content-Disposition`` для автоматического сохранения и точный размер.
        Response: Объект ответа со статусом HTTP 403 Forbidden, если файл принадлежит
            другому пользователю.
        Response: Объект ответа со статусом HTTP 404 Not Found, если запись о файле
            отсутствует в БД или файл физически удален с диска сервера.
        Response: Объект ответа со статусом HTTP 500 Internal Server Error при сбое чтения.

    Raises:
        File.DoesNotExist: Если запись файла не найдена в базе данных (перехватывается).
        Exception: При критических ошибках файловой системы (перехватывается).

    Examples:
        >>> # Запрос GET /api/files/154/download/
        >>> # Возвращает бинарный поток (FileResponse) с заголовками:
        >>> # Content-Disposition: attachment; filename="presentation.pptx"
        >>> # Content-Length: 5242880
    """
    try:
        file_rec = File.objects.get(id=file_id)
        if file_rec.owner != request.user:
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)
        if not file_rec.file or not os.path.exists(file_rec.file.path):
            return Response({"error": "File not found on server"}, status=status.HTTP_404_NOT_FOUND)
        logger.info("File downloaded: %s by user %s", file_rec.name, request.user.email)
        file_event_service.emit_download_event(
            file=file_rec,
            user=request.user,
            ip_address=request.META.get("REMOTE_ADDR"),
        )
        file_handle = file_rec.file.open("rb")
        content_type, _ = mimetypes.guess_type(file_rec.name)
        if content_type is None:
            content_type = "application/octet-stream"
        response = FileResponse(file_handle, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{file_rec.name}"'
        response["Content-Length"] = file_rec.size
        return response
    except File.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Download error: %s", str(exc))
        return Response({"error": "Download failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["DELETE", "PATCH"])
@permission_classes([IsAuthenticated])
def delete_file(request, file_id):
    """Выполняет переименование или полное удаление файла в зависимости от метода HTTP.

    Обрабатывает два типа операций для сущности файла, предварительно проверяя права
    владения пользователя:
    1. **PATCH**: Изменяет имя файла. Очищает строку от пробельных символов, проверяет
       её заполненность и сохраняет обновленное поле ``name`` в базу данных.
    2. **DELETE**: Стирает файл. Физически удаляет бинарные данные из хранилища сервера,
       удаляет саму запись из базы данных и логирует событие удаления через сервис аудита.

    Args:
        request (Request): Объект входящего запроса Django REST Framework. Для метода
            PATCH ожидает новое имя в ``request.data.get('name')``.
        file_id (int): Идентификатор (первичный ключ) целевого файла.

    Returns:
        Response: При успешном PATCH-запросе — статус HTTP 200 OK и обновленные данные:
            ``{"message": "File renamed successfully", "file": {...}}``.
        Response: При успешном DELETE-запросе — статус HTTP 200 OK и текст подтверждения:
            ``{"message": 'File "name.ext" deleted successfully'}``.
        Response: Объект ответа со статусом HTTP 400 Bad Request (при PATCH), если передано
            пустое имя файла.
        Response: Объект ответа со статусом HTTP 403 Forbidden, если пользователь не является
            владельцем файла.
        Response: Объект ответа со статусом HTTP 404 Not Found, если файл не зарегистрирован.

    Raises:
        File.DoesNotExist: Если файл с указанным идентификатором не найден (перехватывается).

    Examples:
        >>> # Пример успешного переименования файла через PATCH (Response.data):
        >>> {
        ...     "message": "File renamed successfully",
        ...     "file": {"id": 154, "name": "new_name.pptx", "size": 5242880, ...}
        ... }
        >>> # Пример успешного удаления файла через DELETE (Response.data):
        >>> {
        ...     "message": 'File "new_name.pptx" deleted successfully'
        ... }
    """
    try:
        file_obj = File.objects.get(id=file_id)
        if file_obj.owner != request.user:
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)
        
        if request.method == "PATCH":
            new_name = request.data.get("name", "").strip()
            if not new_name:
                return Response({"error": "New name is required"}, status=status.HTTP_400_BAD_REQUEST)
            
            old_name = file_obj.name
            file_obj.name = new_name
            file_obj.save(update_fields=["name"])
            
            logger.info("File renamed: %s -> %s by user %s", old_name, new_name, request.user.email)
            return Response({
                "message": "File renamed successfully",
                "file": FileSerializer(file_obj).data
            })
        
        filename = file_obj.name
        file_id_for_event = file_obj.id
        if file_obj.file:
            try:
                file_obj.file.delete(save=False)
            except Exception as exc:  # pylint: disable=broad-except
                logger.error("Error deleting physical file: %s", str(exc))
        file_obj.delete()
        file_event_service.emit_delete_event(
            file_id=file_id_for_event,
            file_name=filename,
            user=request.user,
            ip_address=request.META.get("REMOTE_ADDR"),
        )
        logger.info("File deleted: %s by user %s", filename, request.user.email)
        return Response({"message": f'File "{filename}" deleted successfully'})
    except File.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def file_move(request, file_id):
    """Move a file to root or another folder."""
    try:
        file_obj = File.objects.get(id=file_id)
    except File.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

    if not permission_service.can_write_file(request.user, file_obj):
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    target_folder_id = request.data.get("folder_id")
    target_folder = None

    if target_folder_id not in (None, ""):
        try:
            target_folder = Folder.objects.get(id=target_folder_id)
        except (Folder.DoesNotExist, ValueError, TypeError):
            return Response({"error": "Target folder not found"}, status=status.HTTP_404_NOT_FOUND)

        if not permission_service.can_write_folder(request.user, target_folder):
            return Response(
                {"error": "Target folder access denied"},
                status=status.HTTP_403_FORBIDDEN,
            )

    old_path = file_obj.folder.get_full_path() if file_obj.folder else "Корень"
    file_obj.folder = target_folder
    file_obj.save(update_fields=["folder"])
    new_path = target_folder.get_full_path() if target_folder else "Корень"

    file_event_service.emit_move_event(
        file=file_obj,
        old_path=old_path,
        new_path=new_path,
        user=request.user,
        ip_address=request.META.get("REMOTE_ADDR"),
    )

    logger.info(
        "File moved: %s from %s to %s by user %s",
        file_obj.name,
        old_path,
        new_path,
        request.user.email,
    )

    return Response({
        "message": "File moved successfully",
        "file": FileSerializer(file_obj).data,
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def file_detail(request, file_id):
    """Возвращает детальную информацию и метаданные конкретного файла.

    Находит файл по идентификатору и строго проверяет, является ли текущий пользователь
    его владельцем. Если проверка пройдена, сериализует объект и отдает его параметры.

    Args:
        request (Request): Объект входящего запроса Django REST Framework.
        file_id (int): Идентификатор (первичный ключ) запрашиваемого файла.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK и JSON-структурой
            файла через :class:`FileSerializer`.
        Response: Объект ответа со статусом HTTP 403 Forbidden, если файл принадлежит
            другому пользователю.
        Response: Объект ответа со статусом HTTP 404 Not Found, если файл не зарегистрирован.

    Raises:
        File.DoesNotExist: Если запись файла отсутствует в базе данных (перехватывается).

    Examples:
        >>> # Запрос GET /api/files/154/ (Response.data):
        >>> {
        ...     "id": 154,
        ...     "name": "presentation.pptx",
        ...     "size": 5242880,
        ...     "date": "2026-05-19T14:10:00Z",
        ...     "owner_email": "user@example.com",
        ...     "download_url": "/api/download/154/",
        ...     "folder": None
        ... }
    """
    try:
        file_obj = File.objects.get(id=file_id)
        if file_obj.owner != request.user:
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)
        return Response(FileSerializer(file_obj).data)
    except File.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)


def file_preview(request, file_id):
    """Генерирует и возвращает контент предварительного просмотра (превью) файла.

    Использует шаблон проектирования «Фабрика» (:class:`PreviewFactory`) для подбора
    стратегии рендеринга на основе расширения файла. Считывает бинарные данные файла.
    Если стратегия относится к обработке изображений (``ImagePreview``), возвращает
    сжатый поток байтов с типом ``image/jpeg``. Для текстовых и остальных документов
    декодирует содержимое в строку и отдает текстовый ответ.

    Args:
        request (HttpRequest): Объект стандартного HTTP-запроса Django.
        file_id (int): Идентификатор (первичный ключ) запрашиваемого файла.

    Returns:
        HttpResponse: Ответ Django со статусом HTTP 200 OK, содержащий:
            - Бинарные данные картинки (MIME: ``image/jpeg``), если файл является изображением.
            - Текстовую строку (MIME: ``text/plain; charset=utf-8``) для документов.
        HttpResponse: Ответ со статусом HTTP 500 Internal Server Error, если в процессе
            обработки или конвертации изображения произошел внутренний сбой.

    Raises:
        Http404: Если файл с указанным идентификатором не найден в системе.
    """
    file = get_object_or_404(File, id=file_id)
    with file.file.open("rb") as f:
        data = f.read()
    strategy = PreviewFactory.get_strategy(file.name)
    preview = strategy.preview(data)
    if isinstance(strategy, ImagePreview):
        if not preview:
            return HttpResponse("Image processing error", status=500)
        return HttpResponse(preview, content_type="image/jpeg")
    if isinstance(preview, bytes):
        preview = preview.decode("utf-8", errors="replace")
    return HttpResponse(preview, content_type="text/plain; charset=utf-8")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_storage_stats(request):
    """Рассчитывает и возвращает комплексную статистику использования хранилища пользователем.

    Вычисляет общее количество загруженных файлов и суммарный занимаемый ими объем
    с помощью агрегатных функций ORM (``Sum``). Сопоставляет текущий объем с жестко
    заданным лимитом хранилища (100 МБ) и считает процент утилизации квоты. Дополнительно
    собирает счетчик файлов за последние 7 дней и группирует файлы по их расширениям
    для построения аналитических графиков.

    Args:
        request (Request): Объект входящего запроса Django REST Framework,
            содержащий экземпляр пользователя в ``request.user``.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK и JSON-структурой:
            - total_files (int): Общее число файлов пользователя в системе.
            - total_size (int): Суммарный вес всех файлов пользователя в байтах.
            - storage_limit (int): Максимально доступный лимит диска в байтах (104 857 600 B).
            - usage_percent (float): Процент заполненности диска, округленный до сотых.
            - available_space (int): Оставшееся свободное место на диске в байтах.
            - recent_files_count (int): Число файлов, загруженных за последние 7 суток.
            - file_types (dict): Словарь распределения расширений вида ``{".ext": count}``.
        Response: Объект ответа со статусом HTTP 500 Internal Server Error при ошибке вычислений.

    Raises:
        Exception: При сбоях агрегации данных или расчете временных интервалов (перехватывается).

    Examples:
        >>> # Запрос GET /api/storage/stats/ (Response.data):
        >>> {
        ...     "total_files": 12,
        ...     "total_size": 10485760,
        ...     "storage_limit": 104857600,
        ...     "usage_percent": 10.0,
        ...     "available_space": 94371840,
        ...     "recent_files_count": 3,
        ...     "file_types": {".pdf": 5, ".docx": 4, ".png": 3}
        ... }
    """
    try:
        user = request.user
        total_files = File.objects.filter(owner=user).count()
        total_size = File.objects.filter(owner=user).aggregate(total=Sum("size"))["total"] or 0
        storage_limit = 100 * 1024 * 1024
        usage_percent = (total_size / storage_limit * 100) if storage_limit > 0 else 0
        week_ago = timezone.now() - timedelta(days=7)
        recent_files = File.objects.filter(owner=user, date__gte=week_ago).count()
        file_types = {}
        for file in File.objects.filter(owner=user):
            ext = os.path.splitext(file.name)[1].lower() or "no extension"
            file_types[ext] = file_types.get(ext, 0) + 1
        return Response({
            "total_files": total_files,
            "total_size": total_size,
            "storage_limit": storage_limit,
            "usage_percent": round(usage_percent, 2),
            "available_space": storage_limit - total_size,
            "recent_files_count": recent_files,
            "file_types": file_types,
        })
    except Exception as exc:
        logger.error("Stats error: %s", str(exc))
        return Response({"error": "Failed to get stats"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def search_files(request):
    """Выполняет контекстный поиск по именам файлов текущего пользователя.

    Принимает GET-параметр ``q``. Регистронезависимо ищет вхождение подстроки (``__icontains``)
    в именах файлов, принадлежащих исключительно автору запроса. Результаты поиска
    сортируются по дате от самых свежих к более старым и возвращаются в виде массива.

    Args:
        request (Request): Объект входящего запроса Django REST Framework.
            Ожидает поисковый запрос в параметрах строки: ``request.GET.get('q')``.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK при успешном поиске:
            - query (str): Исходная строка поискового запроса после очистки пробелов.
            - count (int): Количество найденных файлов, соответствующих условию.
            - results (list[dict]): Массив сериализованных метаданных файлов.
        Response: Объект ответа со статусом HTTP 400 Bad Request, если параметр ``q``
            отсутствует или содержит пустую строку.
        Response: Объект ответа со статусом HTTP 500 Internal Server Error при ошибке БД.

    Raises:
        Exception: При любых непредвиденных сбоях СУБД во время фильтрации (перехватывается).

    Examples:
        >>> # Запрос GET /api/files/search/?q=report (Response.data):
        >>> {
        ...     "query": "report",
        ...     "count": 1,
        ...     "results": [{"id": 15, "name": "financial_report.xlsx", ...}]
        ... }
    """
    try:
        query = request.GET.get("q", "").strip()
        if not query:
            return Response({"error": "Search parameter 'q' is required"},
                            status=status.HTTP_400_BAD_REQUEST)
        files = File.objects.filter(owner=request.user, name__icontains=query).order_by("-date")
        return Response({
            "query": query,
            "count": files.count(),
            "results": FileSerializer(files, many=True).data,
        })
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Search error: %s", str(exc))
        return Response({"error": "Search failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def folder_tree(request):
    """Возвращает плоский список всех папок пользователя с метаданными иерархии.

    Выбирает все папки, принадлежащие пользователю. Оптимизирует SQL-запрос с помощью
    метода ``select_related('parent')`` для предотвращения проблемы N+1 при обращении
    к родительским узлам. Формирует расширенный массив с полными путями, общими объемами
    папок и временными метками в формате ISO 8601 для построения дерева на клиенте.

    Args:
        request (Request): Объект входящего запроса Django REST Framework,
            содержащий экземпляр пользователя в ``request.user``.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK и JSON-структурой:
            - folders (list[dict]): Массив папок, где каждый элемент содержит:
                - id (int): Первичный ключ папки.
                - name (str): Локальное имя папки.
                - parent_id (int|None): Идентификатор родительской папки.
                - path (str): Вычисляемый абсолютный путь в файловой системе приложения.
                - size (int): Суммарный объем папки с учетом вложенного содержимого в байтах.
                - created_at (str): Строка даты создания в формате ISO-8601.
                - updated_at (str): Строка даты модификации в формате ISO-8601.

    Examples:
        >>> # Запрос GET /api/folders/tree/ (Response.data):
        >>> {
        ...     "folders": [
        ...         {
        ...             "id": 7,
        ...             "name": "Photos",
        ...             "parent_id": None,
        ...             "path": "/Photos",
        ...             "size": 451200,
        ...             "created_at": "2026-05-19T12:00:00.000Z",
        ...             "updated_at": "2026-05-19T13:45:00.000Z"
        ...         }
        ...     ]
        ... }
    """
    folders = Folder.objects.filter(owner=request.user).select_related("parent")
    data = [
        {
            "id": f.id,
            "name": f.name,
            "parent_id": f.parent_id,
            "path": f.get_full_path(),
            "size": f.get_total_size(),
            "created_at": f.created_at.isoformat(),
            "updated_at": f.updated_at.isoformat(),
        }
        for f in folders
    ]
    return Response({"folders": data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_files(request):
    """Возвращает список файлов пользователя с динамической отметкой нахождения в избранном.

        Выбирает все файлы текущего пользователя. Для оптимизации и исключения проблемы N+1
        запросов к БД, одним запросом извлекает плоский список ID всех избранных файлов юзера,
        преобразуя его в структуру ``set`` для константного времени поиска (O(1)). Сериализует
        файлы и на лету внедряет логический флаг ``is_favorite`` для каждого элемента.

        Args:
            request (Request): Объект входящего запроса Django REST Framework,
                содержащий экземпляр пользователя в ``request.user``.

        Returns:
            Response: Объект ответа REST Framework со статусом HTTP 200 OK, содержащий
                массив сериализованных файлов, дополненных полем ``is_favorite`` (bool).

        Examples:
            >>> # Запрос GET /api/files/ (Response.data):
            >>> [
            ...     {
            ...         "id": 154,
            ...         "name": "photo.jpg",
            ...         "size": 2048,
            ...         "is_favorite": True,
            ...         ...
            ...     }
            ... ]
        """
    files = File.objects.filter(owner=request.user)

    user_fav_ids = set(FavoriteFile.objects.filter(user=request.user).values_list('file_id', flat=True))

    serializer = FileSerializer(files, many=True)
    data = serializer.data

    for file_data in data:
        file_data['is_favorite'] = file_data['id'] in user_fav_ids

    return Response(data)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def folder_create(request):
    """Создает новую папку в файловой структуре авторизованного пользователя.

    Извлекает имя папки и опциональный ``parent_id`` для создания вложенной структуры.
    Проверяет, что переданное имя не является пустым. Если указан идентификатор родительской
    папки, осуществляет валидацию его существования и прав владения текущим пользователем.

    Args:
        request (Request): Объект входящего запроса Django REST Framework. Ожидает
            параметры ``name`` (str) и опциональный ``parent_id`` (int|None) в ``request.data``.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 201 Created и JSON-данными:
            - id (int): Первичный ключ созданной папки.
            - name (str): Заданное имя папки после очистки пробелов.
            - parent_id (int|None): Идентификатор родительского узла.
            - path (str): Полный абсолютный путь папки в иерархии системы.
        Response: Объект ответа со статусом HTTP 400 Bad Request, если имя папки пустое.
        Response: Объект ответа со статусом HTTP 404 Not Found, если указанная родительская
            папка не существует или принадлежит другому аккаунту.

    Raises:
        Folder.DoesNotExist: Если передан невалидный ``parent_id`` (перехватывается).

    Examples:
        >>> # Успешное создание папки (Response.data):
        >>> {
        ...     "id": 8,
        ...     "name": "Work",
        ...     "parent_id": 7,
        ...     "path": "/Photos/Work"
        ... }
    """
    name = request.data.get("name", "").strip()
    parent_id = request.data.get("parent_id")
    if not name:
        return Response({"error": "Folder name is required"}, status=status.HTTP_400_BAD_REQUEST)
    parent = None
    if parent_id:
        try:
            parent = Folder.objects.get(id=parent_id, owner=request.user)
        except Folder.DoesNotExist:
            return Response({"error": "Parent folder not found"}, status=status.HTTP_404_NOT_FOUND)
    folder = Folder.objects.create(name=name, owner=request.user, parent=parent)
    return Response({
        "id": folder.id,
        "name": folder.name,
        "parent_id": folder.parent_id,
        "path": folder.get_full_path(),
    }, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def folder_rename(request, folder_id):
    """Переименовывает существующую папку пользователя по её идентификатору.

    Проверяет существование папки и права владения ею текущим пользователем. Валидирует
    новое имя: оно не должно быть пустым после удаления концевых пробелов. Перезаписывает
    поле ``name`` и фиксирует изменения в базе данных с автообновлением временной метки.

    Args:
        request (Request): Объект входящего запроса Django REST Framework,
            содержащий новое имя папки в ключе ``name`` внутри ``request.data``.
        folder_id (int): Идентификатор (первичный ключ) изменяемой папки.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK и JSON-данными:
            - id (int): Первичный ключ папки.
            - name (str): Новое имя папки.
            - path (str): Обновленный полный путь папки в иерархии.
        Response: Объект ответа со статусом HTTP 400 Bad Request, если новое имя пустое.
        Response: Объект ответа со статусом HTTP 404 Not Found, если папка не найдена.

    Raises:
        Folder.DoesNotExist: Если папка с указанным ``folder_id`` не зарегистрирована (перехватывается).
    """

    try:
        folder = Folder.objects.get(id=folder_id, owner=request.user)
    except Folder.DoesNotExist:
        return Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)
    new_name = request.data.get("name", "").strip()
    if not new_name:
        return Response({"error": "New name is required"}, status=status.HTTP_400_BAD_REQUEST)
    folder.name = new_name
    folder.save(update_fields=["name", "updated_at"])
    return Response({"id": folder.id, "name": folder.name, "path": folder.get_full_path()})


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def folder_move(request, folder_id):
    """Перемещает папку в другой родительский узел (изменяет положение в дереве).

    Ищет целевую папку и проверяет права владения. Анализирует параметр ``parent_id``:
    - Если ``parent_id`` равен ``None`` или отсутствует, папка переносится в корень диска.
    - Если ``parent_id`` указан, проверяется существование новой родительской директории.
    Внедрена защита от циклической вложенности: запрещено перемещать папку саму в себя
    или в поддерево своих собственных дочерних папок (проверка через ``get_all_descendant_ids()``).

    Args:
        request (Request): Объект входящего запроса Django REST Framework,
            содержащий новый ID родителя в ключе ``parent_id`` внутри ``request.data``.
        folder_id (int): Идентификатор перемещаемой папки.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK и JSON-данными:
            - id (int): Первичный ключ папки.
            - name (str): Имя папки.
            - path (str): Новый абсолютный путь папки после перемещения.
        Response: Объект ответа со статусом HTTP 400 Bad Request при попытке нарушения
            целостности дерева (перемещение в свое поддерево).
        Response: Объект ответа со статусом HTTP 404 Not Found, если перемещаемая или
            целевая папка не найдены/не принадлежат пользователю.

    Raises:
        Folder.DoesNotExist: Если папка или целевой узел отсутствуют в БД (перехватывается).
    """
    try:
        folder = Folder.objects.get(id=folder_id, owner=request.user)
    except Folder.DoesNotExist:
        return Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)
    new_parent_id = request.data.get("parent_id")
    if new_parent_id:
        try:
            new_parent = Folder.objects.get(id=new_parent_id, owner=request.user)
        except Folder.DoesNotExist:
            return Response({"error": "Target folder not found"}, status=status.HTTP_404_NOT_FOUND)
        if new_parent.id == folder.id or new_parent.id in folder.get_all_descendant_ids():
            return Response({"error": "Cannot move folder into its own subtree"},
                            status=status.HTTP_400_BAD_REQUEST)
        folder.parent = new_parent
    else:
        folder.parent = None
    folder.save(update_fields=["parent", "updated_at"])
    return Response({"id": folder.id, "name": folder.name, "path": folder.get_full_path()})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def folder_delete(request, folder_id):
    """Безвозвратно удаляет папку и все её каскадное содержимое из системы.

    Проверяет права владения папкой. При вызове метода ``delete()`` на уровне модели
    срабатывает каскадное удаление (зависит от настроек ORM), уничтожающее все
    вложенные подпапки и записи файлов из базы данных.

    Args:
        request (Request): Объект входящего запроса Django REST Framework.
        folder_id (int): Идентификатор удаляемой папки.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK и JSON-структурой:
            - status (str): Статус выполнения операции ("deleted").
            - id (int): Идентификатор удаленной папки.
        Response: Объект ответа со статусом HTTP 404 Not Found, если папка не найдена.

    Raises:
        Folder.DoesNotExist: Если папка с указанным ID не существует (перехватывается).
    """
    try:
        folder = Folder.objects.get(id=folder_id, owner=request.user)
    except Folder.DoesNotExist:
        return Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)
    folder.delete()
    return Response({"status": "deleted", "id": folder_id})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def file_history(request, file_id):
    """Возвращает полную хронологическую историю изменений и событий для конкретного файла.

    Находит файл и проверяет, что запрашивающий пользователь является его легитимным
    владельцем. Извлекает связанные записи аудита из таблицы :class:`FileHistory`,
    сортируя их от самых свежих к более старым (по убыванию ``timestamp``). Преобразует
    выборку в JSON через специализированный сериализатор истории.

    Args:
        request (Request): Объект входящего запроса Django REST Framework.
        file_id (int): Идентификатор файла, для которого запрашивается аудит.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK и JSON-структурой:
            - file_id (int): Идентификатор исследуемого файла.
            - file_name (str): Текущее имя файла в системе.
            - history (list[dict]): Массив объектов истории изменений (события, IP, старые/новые значения).
        Response: Объект ответа со статусом HTTP 403 Forbidden при отсутствии прав на файл.
        Response: Объект ответа со статусом HTTP 404 Not Found, если файл не найден.

    Raises:
        File.DoesNotExist: Если файл с указанным ID отсутствует в СУБД (перехватывается).
    """
    try:
        file_obj = File.objects.get(id=file_id)
        if file_obj.owner != request.user:
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)
        history = FileHistory.objects.filter(file=file_obj).order_by("-timestamp")
        from .serializers import FileHistorySerializer
        return Response({
            "file_id": file_id,
            "file_name": file_obj.name,
            "history": FileHistorySerializer(history, many=True).data,
        })
    except File.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_activity_history(request):
    """Возвращает полную историю действий текущего пользователя с фильтрацией и пагинацией.

    Извлекает все записи журнала событий :class:`FileHistory` для файлов, которые
    принадлежат авторизованному пользователю. Поддерживает динамическое сужение
    выборки через GET-параметры фильтрации по типу события и временному интервалу,
    а также ограничивает размер итогового массива (срез базы данных).

    Args:
        request (Request): Объект входящего запроса Django REST Framework.
            Поддерживает следующие GET-параметры в строке запроса:
            - event_type (str|None): Код конкретного типа события для фильтрации.
            - days (str|int|None): Глубина выборки в днях относительно текущего момента.
            - limit (str|int|None): Максимальное количество записей. По умолчанию 50.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK и JSON-данными:
            - count (int): Фактическое количество возвращенных записей в массиве.
            - history (list[dict]): Массив объектов истории изменений,
              сериализованных через :class:`FileHistorySerializer`.

    Examples:
        >>> # Запрос GET /api/history/?event_type=upload&days=7&limit=2 (Response.data):
        >>> {
        ...     "count": 2,
        ...     "history": [
        ...         {"id": 10, "event_type": "upload", "timestamp": "2026-05-19T10:00:00Z", ...},
        ...         {"id": 9, "event_type": "upload", "timestamp": "2026-05-18T11:20:00Z", ...}
        ...     ]
        ... }
    """
    user_files = File.objects.filter(owner=request.user)
    history = FileHistory.objects.filter(file__in=user_files).order_by("-timestamp")
    event_type = request.GET.get("event_type")
    if event_type:
        history = history.filter(event_type=event_type)
    days = request.GET.get("days")
    if days:
        try:
            since = timezone.now() - timedelta(days=int(days))
            history = history.filter(timestamp__gte=since)
        except ValueError:
            pass
    limit = int(request.GET.get("limit", 50))
    history = history[:limit]
    from .serializers import FileHistorySerializer
    return Response({
        "count": len(history),
        "history": FileHistorySerializer(history, many=True).data,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recent_activity(request):
    """Возвращает сокращенный список из 10 последних событий активности пользователя.

    Упрощенный эндпоинт для вывода хроники последних действий на главной странице
    личного кабинета (Dashboard). Выбирает записи журнала :class:`FileHistory`, связанные
    с файлами текущего пользователя, сортирует их по убыванию времени возникновения
    и ограничивает результат жестким срезом.

    Args:
        request (Request): Объект входящего запроса Django REST Framework,
            содержащий экземпляр пользователя в ``request.user``.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK, содержащий
            массив из максимум 10 сериализованных объектов журнала аудит-логов.
    """
    user_files = File.objects.filter(owner=request.user)
    history = FileHistory.objects.filter(file__in=user_files).order_by("-timestamp")[:10]
    from .serializers import FileHistorySerializer
    return Response(FileHistorySerializer(history, many=True).data)

@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_list_users(request):
    """Возвращает администраторам список всех пользователей с агрегированной статистикой.

    Доступен исключительно пользователям с флагами ``is_staff`` или ``is_superuser``.
    Выгружает всех зарегистрированных пользователей системы, сортируя их по дате
    создания аккаунта. Для каждого пользователя в цикле вычисляет общее количество
    загруженных файлов и их суммарный физический объем на диске (в байтах) с помощью
    агрегационных функций ORM (``Count``, ``Sum``).

    Args:
        request (Request): Объект входящего запроса авторизованного администратора.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK и JSON-данными:
            - users (list[dict]): Массив профилей пользователей. Каждый элемент включает
              базовые системные флаги, дату регистрации и ключи ``file_count`` и ``total_size``.
            - total (int): Общее количество учетных записей в системе.

    Examples:
        >>> # Запрос GET /api/admin/users/ (Response.data):
        >>> {
        ...     "users": [
        ...         {
        ...             "id": 1,
        ...             "email": "admin@example.com",
        ...             "name": "Root",
        ...             "is_active": True,
        ...             "is_staff": True,
        ...             "date_joined": "2026-01-01T00:00:00Z",
        ...             "file_count": 5,
        ...             "total_size": 2548500
        ...         }
        ...     ],
        ...     "total": 1
        ... }
    """
    users = User.objects.all().order_by("date_joined")
    data = []
    for user in users:
        file_stats = File.objects.filter(owner=user).aggregate(
            count=Count("id"), total_size=Sum("size")
        )
        data.append({
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "is_active": user.is_active,
            "is_staff": user.is_staff,
            "date_joined": user.date_joined.isoformat(),
            "file_count": file_stats["count"] or 0,
            "total_size": file_stats["total_size"] or 0,
        })
    return Response({"users": data, "total": len(data)})


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_stats(request):
    """Генерирует сводную глобальную статистику по всей платформе для панели администратора.

    Вычисляет общие системные метрики: суммарное число файлов, совокупный объем дискового
    пространства, занятый терабайтами/байтами данных (переводится также в мегабайты),
    общее число зарегистрированных аккаунтов, а также разделение пользователей на активных
    и заблокированных (неактивных) в данный момент.

    Args:
        request (Request): Объект входящего запроса авторизованного администратора.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK и JSON-структурой:
            - total_users (int): Общее число учетных записей в системе.
            - active_users (int): Число пользователей с флагом ``is_active=True``.
            - blocked_users (int): Число пользователей с флагом ``is_active=False``.
            - total_files (int): Общее число файлов, загруженных на платформу всеми юзерами.
            - total_size_bytes (int): Суммарный объем файлов на сервере в байтах.
            - total_size_mb (float): Суммарный объем файлов в мегабайтах с округлением до сотых.
    """
    total_files = File.objects.count()
    total_size = File.objects.aggregate(total=Sum("size"))["total"] or 0
    total_users = User.objects.count()
    active_users = User.objects.filter(is_active=True).count()
    return Response({
        "total_users": total_users,
        "active_users": active_users,
        "blocked_users": total_users - active_users,
        "total_files": total_files,
        "total_size_bytes": total_size,
        "total_size_mb": round(total_size / (1024 * 1024), 2),
    })


@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_block_user(request, user_id):
    """Блокирует учетную запись пользователя (устанавливает флаг активности в False).

    Запрещает пользователю авторизацию на платформе и доступ к API. Предусмотрена
    строгая валидация: администратор не может заблокировать собственную учетную запись,
    под которой он выполняет запрос. Факт блокировки фиксируется в системных логах
    уровня ``warning``.

    Args:
        request (Request): Объект входящего запроса администратора.
        user_id (int): Идентификатор пользователя, которого необходимо заблокировать.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK при успехе:
            - status (str): Статус выполнения ("blocked").
            - user_id (int): Идентификатор заблокированного пользователя.
            - email (str): Электронная почта заблокированного пользователя.
        Response: Объект ответа со статусом HTTP 400 Bad Request при попытке самоблокировки.
        Response: Объект ответа со статусом HTTP 404 Not Found, если пользователь не найден.

    Raises:
        User.DoesNotExist: Если пользователь с указанным ``user_id`` отсутствует в БД (перехватывается).
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
    if user.id == request.user.id:
        return Response({"error": "Cannot block yourself"}, status=status.HTTP_400_BAD_REQUEST)
    user.is_active = False
    user.save(update_fields=["is_active"])
    logger.warning("Admin %s blocked user %s (id=%d)", request.user.email, user.email, user.id)
    return Response({"status": "blocked", "user_id": user_id, "email": user.email})


@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_unblock_user(request, user_id):
    """Разблокирует ранее ограниченную учетную запись пользователя (is_active = True).

    Восстанавливает пользователю полноценный доступ к возможностям платформы и авторизации.
    Действие регистрируется в системном логе уровня ``info``.

    Args:
        request (Request): Объект входящего запроса администратора.
        user_id (int): Идентификатор пользователя, которого необходимо разблокировать.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK при успехе:
            - status (str): Статус выполнения ("unblocked").
            - user_id (int): Идентификатор измененного профиля.
            - email (str): Электронная почта пользователя.
        Response: Объект ответа со статусом HTTP 404 Not Found, если пользователь не найден.

    Raises:
        User.DoesNotExist: Если пользователь с указанным ``user_id`` отсутствует в БД (перехватывается).
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
    user.is_active = True
    user.save(update_fields=["is_active"])
    logger.info("Admin %s unblocked user %s (id=%d)", request.user.email, user.email, user.id)
    return Response({"status": "unblocked", "user_id": user_id, "email": user.email})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_delete_user(request, user_id):
    """Полностью и безвозвратно удаляет пользователя и все связанные файлы с диска.

    Реализует процедуру каскадной очистки данных. Сначала находит целевого пользователя.
    Запрещает администратору удалять самого себя. Перед удалением профиля из базы данных
    пробегает по циклу всех файлов, принадлежащих пользователю, и инициирует удаление
    бинарных объектов с физического накопителя сервера (ошибки удаления файлов логируются,
    но не прерывают процесс). После этого стирает запись пользователя. Операция логируется
    как критическая (``warning``).

    Args:
        request (Request): Объект входящего запроса администратора.
        user_id (int): Идентификатор удаляемого пользователя.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK при успешном удалении:
            - status (str): Статус выполнения операции ("deleted").
            - email (str): Email удаленного пользователя.
            - files_deleted (int): Количество физически удаленных файлов из хранилища.
        Response: Объект ответа со статусом HTTP 400 Bad Request при попытке удаления себя.
        Response: Объект ответа со статусом HTTP 404 Not Found, если пользователь не найден.

    Raises:
        User.DoesNotExist: Если пользователь с указанным ``user_id`` отсутствует в БД (перехватывается).
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
    if user.id == request.user.id:
        return Response({"error": "Cannot delete yourself"}, status=status.HTTP_400_BAD_REQUEST)
    email = user.email
    file_count = File.objects.filter(owner=user).count()
    for f in File.objects.filter(owner=user):
        try:
            f.file.delete(save=False)
        except Exception as exc:
            logger.error("Error deleting file during user deletion: %s", str(exc))
    user.delete()
    logger.warning(
        "Admin %s deleted user %s with %d file(s)",
        request.user.email, email, file_count,
    )
    return Response({
        "status": "deleted",
        "email": email,
        "files_deleted": file_count,
    })


import html as html_module
import re


def _sanitize_text_content(text: str) -> str:
    """Очищает текстовое содержимое от потенциально опасных HTML-тегов и JavaScript-кода.

    Применяется для предотвращения XSS-атак (Cross-Site Scripting) при сохранении
    файлов через встроенный веб-редактор. Функция последовательно удаляет теги
    ``<script>``, инлайновые обработчики событий (например, ``onclick``, ``onload``)
    и псевдопротоколы ``javascript:``, после чего экранирует оставшиеся спецсимволы
    HTML.

    Args:
        text (str): Исходная необработанная строка текста из текстового редактора.

    Returns:
        str: Безопасная текстовая строка, очищенная и экранированная модулем html.

    Examples:
        >>> _sanitize_text_content("<script>alert('XSS')</script> Hello")
        ' Hello'
        >>> _sanitize_text_content("<div onclick='evil()'>Text</div>")
        '&lt;div &gt;Text&lt;/div&gt;'
    """
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'\bon\w+\s*=\s*["\'][^"\']*["\']', '', text, flags=re.IGNORECASE)
    text = re.sub(r'javascript\s*:', '', text, flags=re.IGNORECASE)
    text = html_module.escape(text)
    return text


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_text_file(request, file_id):
    """Сохраняет измененный текстовый контент из встроенного веб-редактора обратно в файл.

    Проверяет существование файла и права владения им текущим пользователем. Контролирует
    расширение файла, разрешая редактирование только для явных текстовых форматов.
    Пропускает входящий текст через фильтр очистки ``_sanitize_text_content``,
    перезаписывает физический файл на диске в кодировке UTF-8, обновляет его размер
    в базе данных и инициирует системное событие для логов аудита.

    Args:
        request (Request): Объект входящего запроса Django REST Framework. Ожидает
            строковое содержимое в ключе ``request.data.get('content')``.
        file_id (int): Идентификатор (первичный ключ) редактируемого текстового файла.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK при успехе:
            - status (str): Статус завершения операции ("saved").
            - file_id (int): Идентификатор сохраненного файла.
            - file_name (str): Имя файла.
            - size (int): Новый размер файла в байтах после сохранения.
            - sanitized (bool): Флаг, указывающий, был ли текст изменен в процессе
              очистки от вредоносного кода (True/False).
        Response: Объект ответа со статусом HTTP 400 Bad Request, если файл является
            бинарным или если поле ``content`` не передано в теле запроса.
        Response: Объект ответа со статусом HTTP 403 Forbidden, если файл принадлежит
            другому пользователю.
        Response: Объект ответа со статусом HTTP 404 Not Found, если файл не найден в БД.

    Raises:
        File.DoesNotExist: Если файл с указанным идентификатором отсутствует (перехватывается).

    Examples:
        >>> # Пример успешного ответа при сохранении текста (Response.data):
        >>> {
        ...     "status": "saved",
        ...     "file_id": 42,
        ...     "file_name": "notes.md",
        ...     "size": 128,
        ...     "sanitized": False
        ... }
    """
    try:
        file_obj = File.objects.get(id=file_id)
    except File.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

    if file_obj.owner != request.user:
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    ext = os.path.splitext(file_obj.name)[1].lower()
    allowed_text_extensions = [".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js"]
    if ext not in allowed_text_extensions:
        return Response(
            {"error": f"Cannot edit binary file with extension '{ext}'"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    content = request.data.get("content")
    if content is None:
        return Response({"error": "Field 'content' is required"}, status=status.HTTP_400_BAD_REQUEST)

    sanitized_content = _sanitize_text_content(content)

    file_obj.file.open("wb")
    file_obj.file.write(sanitized_content.encode("utf-8"))
    file_obj.file.close()

    file_obj.size = len(sanitized_content.encode("utf-8"))
    file_obj.save(update_fields=["size"])

    file_event_service.emit_upload_event(
        file=file_obj,
        user=request.user,
        ip_address=request.META.get("REMOTE_ADDR"),
        details={"action": "text_editor_save", "size": file_obj.size},
    )
    logger.info(
        "Text file saved via editor: %s by user %s",
        file_obj.name, request.user.email,
    )

    return Response({
        "status": "saved",
        "file_id": file_obj.id,
        "file_name": file_obj.name,
        "size": file_obj.size,
        "sanitized": sanitized_content != content,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def read_text_file(request, file_id):
    """Считывает и возвращает текстовое содержимое файла для инициализации веб-редактора.

    Проверяет существование файла и права доступа авторизованного пользователя.
    Убеждается, что запрашиваемый ресурс относится к разрешенному списку текстовых
    расширений. Считывает бинарные данные с диска, декодирует их в строку UTF-8
    (с заменой невалидных байтов безопасными символами) и отдает текстовый контент.

    Args:
        request (Request): Объект входящего GET-запроса Django REST Framework.
        file_id (int): Идентификатор (первичный ключ) запрашиваемого текстового файла.

    Returns:
        Response: Объект ответа REST Framework со статусом HTTP 200 OK и JSON-структурой:
            - file_id (int): Идентификатор прочитанного файла.
            - file_name (str): Имя файла.
            - content (str): Полное текстовое содержимое файла в кодировке UTF-8.
            - size (int): Текущий физический размер файла в байтах.
        Response: Объект ответа со статусом HTTP 400 Bad Request, если файл является
            бинарным и не предназначен для редактирования.
        Response: Объект ответа со статусом HTTP 403 Forbidden, если текущий пользователь
            не является владельцем файла.
        Response: Объект ответа со статусом HTTP 404 Not Found, если файл не зарегистрирован.

    Raises:
        File.DoesNotExist: Если запись файла отсутствует в базе данных (перехватывается).

    Examples:
        >>> # Запрос GET /api/files/42/read/ (Response.data):
        >>> {
        ...     "file_id": 42,
        ...     "file_name": "notes.md",
        ...     "content": "# My Notes\\nThis is a text content.",
        ...     "size": 33
        ... }
    """
    try:
        file_obj = File.objects.get(id=file_id)
    except File.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

    if file_obj.owner != request.user:
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    ext = os.path.splitext(file_obj.name)[1].lower()
    allowed_text_extensions = [".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js"]
    if ext not in allowed_text_extensions:
        return Response(
            {"error": f"Cannot read binary file with extension '{ext}'"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with file_obj.file.open("rb") as f:
        content = f.read().decode("utf-8", errors="replace")

    return Response({
        "file_id": file_obj.id,
        "file_name": file_obj.name,
        "content": content,
        "size": file_obj.size,
    })