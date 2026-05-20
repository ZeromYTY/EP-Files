"""API views for public file and folder links."""
import mimetypes
import os
import secrets

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from ep_files_app.models.models import File, Folder


def _generate_unique_token():
    """Генерирует криптографически стойкий уникальный токен для файлов и папок.

    Выполняет генерацию случайного URL-безопасного токена в бесконечном цикле.
    На каждой итерации проверяет отсутствие коллизий в таблицах баз данных
    моделей :class:`File` и :class:`Folder`. Цикл завершается, когда сгенерированный
    токен гарантированно оказывается уникальным для всей системы.

    Args:
        None

    Returns:
        str: Сгенерированный уникальный токен длиной 32 байта, закодированный в Base64.

    Examples:
        >>> token = _generate_unique_token()
        >>> len(token) > 32
        True
        >>> isinstance(token, str)
        True
    """
    while True:
        token = secrets.token_urlsafe(32)

        file_exists = File.objects.filter(public_token=token).exists()
        folder_exists = Folder.objects.filter(public_token=token).exists()

        if not file_exists and not folder_exists:
            return token


def _build_public_url(request, path):
    """Строит абсолютный публичный URL-адрес на основе текущего веб-запроса.

    Использует внутренние механизмы Django для извлечения протокола (HTTP/HTTPS),
    хоста и порта из объекта запроса, после чего объединяет их с переданным
    относительным путем для формирования полноценной внешней ссылки.

    Args:
        request (Request): Объект входящего запроса Django REST Framework.
        path (str): Относительный путь API (например, '/api/public/files/abc123_abc/').

    Returns:
        str: Полный абсолютный URI для доступа к ресурсу из внешней сети.

    Examples:
        >>> from rest_framework.test import APIRequestFactory
        >>> factory = APIRequestFactory()
        >>> request = factory.get('/')
        >>> _build_public_url(request, '/api/test/')
        'http://testserver/api/test/'
    """
    return request.build_absolute_uri(path)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def enable_file_public_link(request, file_id):
    """Включает публичный доступ к файлу по уникальной ссылке.

    Находит файл по идентификатору и проверяет, принадлежит ли он текущему
    авторизованному пользователю. Если у файла еще нет публичного токена,
    вызывает функцию ``_generate_unique_token``. Устанавливает флаг ``is_public``
    в состояние ``True`` и точечно обновляет эти поля в базе данных.

    Args:
        request (Request): Объект входящего запроса Django REST Framework,
            содержащий авторизованного пользователя в ``request.user``.
        file_id (int): Идентификатор (первичный ключ) запрашиваемого файла.

    Returns:
        Response: Объект ответа REST Framework с JSON-данными, содержащими:
            - status (str): Статус операции ("enabled").
            - file_id (int): Идентификатор измененного файла.
            - file_name (str): Оригинальное имя файла.
            - public_token (str): Сгенерированный или существующий токен доступа.
            - public_url (str): Полная абсолютная ссылка для скачивания файла.

    Raises:
        Http404: Если файл с указанным ``file_id`` не найден в базе данных
            или он не принадлежит пользователю ``request.user``.

    Examples:
        >>> # Пример успешного JSON-ответа (Response.data):
        >>> {
        ...     "status": "enabled",
        ...     "file_id": 42,
        ...     "file_name": "document.pdf",
        ...     "public_token": "gX9_8fX...",
        ...     "public_url": "https://example.com..."
        ... }
    """
    file_obj = get_object_or_404(File, id=file_id, owner=request.user)

    if not file_obj.public_token:
        file_obj.public_token = _generate_unique_token()

    file_obj.is_public = True
    file_obj.save(update_fields=["public_token", "is_public"])

    public_path = f"/api/public/files/{file_obj.public_token}/"

    return Response({
        "status": "enabled",
        "file_id": file_obj.id,
        "file_name": file_obj.name,
        "public_token": file_obj.public_token,
        "public_url": _build_public_url(request, public_path),
    })


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def disable_file_public_link(request, file_id):
    """Отключает публичный доступ к файлу и аннулирует ссылку.

    Проверяет существование файла и права владения им текущим пользователем.
    Сбрасывает флаг ``is_public`` в ``False``, а поле ``public_token`` устанавливает
    в ``None``. Изменения сохраняются в базу данных, делая файл недоступным
    по всем ранее сгенерированным публичным ссылкам.

    Args:
        request (Request): Объект входящего запроса Django REST Framework,
            содержащий авторизованного пользователя в ``request.user``.
        file_id (int): Идентификатор (первичный ключ) запрашиваемого файла.

    Returns:
        Response: Объект ответа REST Framework с JSON-данными, содержащими:
            - status (str): Статус операции ("disabled").
            - file_id (int): Идентификатор измененного файла.
            - file_name (str): Оригинальное имя файла.

    Raises:
        Http404: Если файл с указанным ``file_id`` не найден или принадлежит
            другому пользователю.

    Examples:
        >>> # Пример успешного JSON-ответа (Response.data):
        >>> {
        ...     "status": "disabled",
        ...     "file_id": 42,
        ...     "file_name": "document.pdf"
        ... }
    """
    file_obj = get_object_or_404(File, id=file_id, owner=request.user)

    file_obj.is_public = False
    file_obj.public_token = None
    file_obj.save(update_fields=["public_token", "is_public"])

    return Response({
        "status": "disabled",
        "file_id": file_obj.id,
        "file_name": file_obj.name,
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def public_download_file(request, token):
    """Позволяет скачать файл по публичному токену без прохождения авторизации.

    Ищет в базе данных файл, у которого поле ``public_token`` совпадает с переданным
    значением, а флаг ``is_public`` равен ``True``. Выполняет проверку физического
    наличия файла в хранилище сервера. Определяет MIME-тип файла на основе его расширения,
    после чего инициирует потоковую отдачу файла клиенту в виде вложения (attachment).

    Args:
        request (Request): Объект анонимного или авторизованного запроса.
        token (str): Уникальный публичный токен доступа к файлу.

    Returns:
        FileResponse: Потоковый ответ Django, содержащий бинарное тело файла,
            заголовки ``Content-Disposition`` (с именем файла) и ``Content-Length``.
        Response: Ответ со статусом HTTP 404 и сообщением об ошибке, если файл
            записан в БД, но физически отсутствует на диске.

    Raises:
        Http404: Если активный публичный файл с таким токеном не зарегистрирован в системе.

    Examples:
        >>> # Запрос GET /api/public/files/some_valid_token/
        >>> # Возвращает бинарный поток файла (FileResponse) с заголовками:
        >>> # Content-Disposition: attachment; filename="document.pdf"
        >>> # Content-Type: application/pdf
    """
    file_obj = get_object_or_404(File, public_token=token, is_public=True)

    if not file_obj.file or not os.path.exists(file_obj.file.path):
        return Response(
            {"error": "File not found on server"},
            status=status.HTTP_404_NOT_FOUND,
        )

    file_handle = file_obj.file.open("rb")
    content_type, _ = mimetypes.guess_type(file_obj.name)

    if content_type is None:
        content_type = "application/octet-stream"

    response = FileResponse(file_handle, content_type=content_type)
    response["Content-Disposition"] = f'attachment; filename="{file_obj.name}"'
    response["Content-Length"] = file_obj.size

    return response


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def enable_folder_public_link(request, folder_id):
    """Включает публичный доступ к папке и всему её содержимому по ссылке.

    Проверяет права владения текущего пользователя над указанной папкой. При
    отсутствии токена генерирует новый через ``_generate_unique_token``. Выставляет
    признак публичности ``is_public = True`` и сохраняет изменения в базу данных.
    Формирует абсолютную ссылку на просмотр содержимого этой папки.

    Args:
        request (Request): Объект входящего запроса Django REST Framework,
            содержащий авторизованного пользователя в ``request.user``.
        folder_id (int): Идентификатор (первичный ключ) запрашиваемой папки.

    Returns:
        Response: Объект ответа REST Framework с JSON-данными, содержащими:
            - status (str): Статус операции ("enabled").
            - folder_id (int): Идентификатор измененной папки.
            - folder_name (str): Оригинальное название папки.
            - public_token (str): Уникальный токен доступа к папке.
            - public_url (str): Полная абсолютная ссылка на просмотр содержимого.

    Raises:
        Http404: Если папка с указанным ``folder_id`` не найдена или не принадлежит
            текущему пользователю.

    Examples:
        >>> # Пример успешного JSON-ответа (Response.data):
        >>> {
        ...     "status": "enabled",
        ...     "folder_id": 7,
        ...     "folder_name": "Vacation_Photos",
        ...     "public_token": "zY5_2pQ...",
        ...     "public_url": "https://example.com..."
        ... }
    """
    folder = get_object_or_404(Folder, id=folder_id, owner=request.user)

    if not folder.public_token:
        folder.public_token = _generate_unique_token()

    folder.is_public = True
    folder.save(update_fields=["public_token", "is_public"])

    public_path = f"/api/public/folders/{folder.public_token}/"

    return Response({
        "status": "enabled",
        "folder_id": folder.id,
        "folder_name": folder.name,
        "public_token": folder.public_token,
        "public_url": _build_public_url(request, public_path),
    })


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def disable_folder_public_link(request, folder_id):
    """Отключает публичный доступ к папке, закрывая просмотр её содержимого.

    Проверяет права владения папкой. Переводит флаг ``is_public`` в состояние ``False``
    и стирает значение ``public_token`` (устанавливает в ``None``), обновляя запись в БД.
    После этого любые анонимные запросы к этой папки и вложенным файлам начнут возвращать 404.

    Args:
        request (Request): Объект входящего запроса Django REST Framework,
            содержащий авторизованного пользователя в ``request.user``.
        folder_id (int): Идентификатор (первичный ключ) запрашиваемой папки.

    Returns:
        Response: Объект ответа REST Framework с JSON-данными, содержащими:
            - status (str): Статус операции ("disabled").
            - folder_id (int): Идентификатор измененной папки.
            - folder_name (str): Оригинальное название папки.

    Raises:
        Http404: Если папка не существует или принадлежит другому пользователю.

    Examples:
        >>> # Пример успешного JSON-ответа (Response.data):
        >>> {
        ...     "status": "disabled",
        ...     "folder_id": 7,
        ...     "folder_name": "Vacation_Photos"
        ... }
    """
    folder = get_object_or_404(Folder, id=folder_id, owner=request.user)

    folder.is_public = False
    folder.public_token = None
    folder.save(update_fields=["public_token", "is_public"])

    return Response({
        "status": "disabled",
        "folder_id": folder.id,
        "folder_name": folder.name,
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def public_folder_detail(request, token):
    """Возвращает метаданные и структуру содержимого публичной папки по токену.

    Предоставляет анонимный доступ к информации о папке. Получает саму папку,
    находит все дочерние папки первого уровня (где ``parent=folder``) и все файлы,
    привязанные непосредственно к этой папке. Для каждого файла динамически строит
    абсолютный URL-адрес для его последующего скачивания через публичный эндпоинт папки.

    Args:
        request (Request): Объект анонимного или авторизованного запроса.
        token (str): Уникальный публичный токен доступа к папке.

    Returns:
        Response: Объект ответа REST Framework со сложной JSON-структурой:
            - folder (dict): Основные данные папки (id, name, full_path).
            - folders (list[dict]): Список вложенных папок (id, name).
            - files (list[dict]): Список файлов в папке (id, name, size, download_url).

    Raises:
        Http404: Если открытая папка с указанным токеном не найдена.

    Examples:
        >>> # Пример успешного JSON-ответа (Response.data):
        >>> {
        ...     "folder": {"id": 7, "name": "Shared", "path": "/Shared"},
        ...     "folders": [{"id": 12, "name": "Documents"}],
        ...     "files": [{
        ...         "id": 101,
        ...         "name": "report.xlsx",
        ...         "size": 2048,
        ...         "download_url": "http://testserver/api/public/folders/tok123/files/101/"
        ...     }]
    ... }
    """
    folder = get_object_or_404(Folder, public_token=token, is_public=True)

    child_folders = Folder.objects.filter(parent=folder)
    files = File.objects.filter(folder=folder)

    return Response({
        "folder": {
            "id": folder.id,
            "name": folder.name,
            "path": folder.get_full_path(),
        },
        "folders": [
            {
                "id": child.id,
                "name": child.name,
            }
            for child in child_folders
        ],
        "files": [
            {
                "id": file_obj.id,
                "name": file_obj.name,
                "size": file_obj.size,
                "download_url": request.build_absolute_uri(
                    f"/api/public/folders/{token}/files/{file_obj.id}/"
                ),
            }
            for file_obj in files
        ],
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def public_folder_file_download(request, token, file_id):
    """Скачивает конкретный файл, находящийся внутри публичной папки.

    Сначала находит валидную публичную папку по её токену. Затем ищет запрашиваемый
    файл по ``file_id``, строго проверяя, что он привязан к этой папке. Проверяет
    наличие файла на диске сервера, считывает его MIME-тип и отдает файл клиенту
    в виде потока байтов с заголовками для автоматического скачивания.

    Args:
        request (Request): Объект анонимного или авторизованного запроса.
        token (str): Уникальный публичный токен доступа к родительской папке.
        file_id (int): Идентификатор (первичный ключ) запрашиваемого файла.

    Returns:
        FileResponse: Потоковый ответ Django, содержащий тело файла и метаданные скачивания.
        Response: Ответ со статусом HTTP 404, если файл отсутствует на сервере физически.

    Raises:
        Http404: Если папка не найдена, не является публичной, либо если файл с указанным
            ``file_id`` отсутствует или не принадлежит данной папке.

    Examples:
        >>> # Запрос GET /api/public/folders/valid_token/files/101/
        >>> # Возвращает бинарный поток файла (FileResponse) с заголовками:
        >>> # Content-Disposition: attachment; filename="report.xlsx"
        >>> # Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    """
    folder = get_object_or_404(Folder, public_token=token, is_public=True)
    file_obj = get_object_or_404(File, id=file_id, folder=folder)

    if not file_obj.file or not os.path.exists(file_obj.file.path):
        return Response(
            {"error": "File not found on server"},
            status=status.HTTP_404_NOT_FOUND,
        )

    file_handle = file_obj.file.open("rb")
    content_type, _ = mimetypes.guess_type(file_obj.name)

    if content_type is None:
        content_type = "application/octet-stream"

    response = FileResponse(file_handle, content_type=content_type)
    response["Content-Disposition"] = f'attachment; filename="{file_obj.name}"'
    response["Content-Length"] = file_obj.size

    return response