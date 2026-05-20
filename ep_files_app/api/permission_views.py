"""
API views для управления правами доступа
"""
import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.core.exceptions import ValidationError

from ep_files_app.models import Permission, File, Folder, User
from ep_files_app.services.permission_service import permission_service
from .serializers import PermissionSerializer

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def grant_file_permission(request, file_id):
    """Обработчик API для делегирования прав доступа к конкретному файлу.

    Принимает POST-запрос, выполняет каскадную валидацию контекста (наличие файла,
    проверка авторства запрашивающего, существование целевого пользователя), исключает
    попытки назначения прав самому себе и делегирует создание записи в ``PermissionService``.

    Args:
        request (Request): Объект входящего запроса Django REST Framework, содержащий
            данные авторизованного пользователя в ``request.user`` и payload в ``request.data``.
        file_id (int): Идентификатор (ID) файла, на который делегируются права.

    Returns:
        Response: Объект ``Response`` DRF, содержащий:
        - Статус 201 и тело с сериализованными данными нового права при успехе.
        - Статус 400 при синтаксических ошибках или нарушениях бизнес-логики.
        - Статус 403, если операцию пытается выполнить не владелец файла.
        - Статус 404, если файл или целевой пользователь не зарегистрированы.
        - Статус 500 при непредвиденных системных сбоях.

    Note:
        Эндпоинт защищен декоратором ``@permission_classes([IsAuthenticated])``,
        что гарантирует доступ к нему только авторизованных пользователей.
    """
    try:
        try:
            file = File.objects.get(id=file_id)
        except File.DoesNotExist:
            return Response(
                {"error": "Файл не найден"},
                status=status.HTTP_404_NOT_FOUND
            )

        if file.owner != request.user:
            return Response(
                {"error": "Только владелец файла может выдавать права"},
                status=status.HTTP_403_FORBIDDEN
            )

        user_email = request.data.get('user_email')
        permission_type = request.data.get('permission_type', Permission.READ)
        inherit = request.data.get('inherit', True)
        
        if not user_email:
            return Response(
                {"error": "Необходимо указать user_email"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            target_user = User.objects.get(email=user_email)
        except User.DoesNotExist:
            return Response(
                {"error": f"Пользователь {user_email} не найден"},
                status=status.HTTP_404_NOT_FOUND
            )

        if target_user == request.user:
            return Response(
                {"error": "Нельзя выдать права самому себе"},
                status=status.HTTP_400_BAD_REQUEST
            )

        permission = permission_service.grant_permission(
            granted_by=request.user,
            user=target_user,
            file=file,
            permission_type=permission_type,
            inherit=inherit
        )
        
        return Response(
            {
                "message": "Права доступа выданы",
                "permission": PermissionSerializer(permission).data
            },
            status=status.HTTP_201_CREATED
        )
        
    except ValidationError as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error granting file permission: {str(e)}")
        return Response(
            {"error": "Ошибка при выдаче прав"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def grant_folder_permission(request, folder_id):
    """Обработчик API для делегирования прав доступа к конкретной папке (директории).

    Принимает POST-запрос, осуществляет последовательную валидацию контекста
    (существование каталога, проверка прав владения у инициатора, наличие целевого
    пользователя), предотвращает цикличное назначение прав самому себе и регистрирует
    правило доступа, включая флаг каскадного наследования (inherit), через ``PermissionService``.

    Args:
        request (Request): Объект входящего запроса Django REST Framework, содержащий
            данные авторизованного пользователя в ``request.user`` и payload в ``request.data``.
        folder_id (int): Идентификатор (ID) папки, на которую делегируются права.

    Returns:
        Response: Объект ``Response`` DRF, содержащий:
        - Статус 201 и сериализованное тело созданного/обновленного правила при успехе.
        - Статус 400 при некорректных параметрах тела или нарушениях бизнес-логики.
        - Статус 403, если операцию запрашивает не прямой владелец папки.
        - Статус 404, если папка или целевой пользователь не зарегистрированы.
        - Статус 500 при возникновении критических системных исключений.

    Note:
        Эндпоинт защищен декоратором ``@permission_classes([IsAuthenticated])``,
        что исключает доступ со стороны неавторизованных клиентов.
    """
    try:
        try:
            folder = Folder.objects.get(id=folder_id)
        except Folder.DoesNotExist:
            return Response(
                {"error": "Папка не найдена"},
                status=status.HTTP_404_NOT_FOUND
            )

        if folder.owner != request.user:
            return Response(
                {"error": "Только владелец папки может выдавать права"},
                status=status.HTTP_403_FORBIDDEN
            )

        user_email = request.data.get('user_email')
        permission_type = request.data.get('permission_type', Permission.READ)
        inherit = request.data.get('inherit', True)
        
        if not user_email:
            return Response(
                {"error": "Необходимо указать user_email"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            target_user = User.objects.get(email=user_email)
        except User.DoesNotExist:
            return Response(
                {"error": f"Пользователь {user_email} не найден"},
                status=status.HTTP_404_NOT_FOUND
            )

        if target_user == request.user:
            return Response(
                {"error": "Нельзя выдать права самому себе"},
                status=status.HTTP_400_BAD_REQUEST
            )

        permission = permission_service.grant_permission(
            granted_by=request.user,
            user=target_user,
            folder=folder,
            permission_type=permission_type,
            inherit=inherit
        )
        
        return Response(
            {
                "message": "Права доступа выданы",
                "permission": PermissionSerializer(permission).data
            },
            status=status.HTTP_201_CREATED
        )
        
    except ValidationError as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error granting folder permission: {str(e)}")
        return Response(
            {"error": "Ошибка при выдаче прав"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def revoke_file_permission(request, file_id):
    """Обработчик API для отзыва индивидуальных прав доступа к конкретному файлу.

    Принимает DELETE-запрос, выполняет комплексную валидацию контекста (наличие ресурса,
    проверка прав владения у запрашивающего лица, верификация существования указанного
    в теле запроса пользователя) и инициирует удаление соответствующих записей
    разрешений через ``PermissionService``.

    Args:
        request (Request): Объект входящего запроса Django REST Framework, содержащий
            данные авторизованного пользователя в ``request.user`` и payload в ``request.data``.
        file_id (int): Идентификатор (ID) файла, права на который подлежат аннулированию.

    Returns:
        Response: Объект ``Response`` DRF, содержащий:
        - Статус 200 с подтверждающим текстовым сообщением при успешном отзыве прав.
        - Статус 400 при отсутствии обязательного параметра ``user_email`` в теле запроса.
        - Статус 403, если операцию пытается выполнить не владелец файла.
        - Статус 404, если файл, целевой пользователь или сама запись права не обнаружены.
        - Статус 500 при возникновении непредвиденных системных исключений на стороне сервера.

    Note:
        Эндпоинт защищен декоратором ``@permission_classes([IsAuthenticated])``,
        что исключает возможность его вызова анонимными клиентами.
    """
    try:
        try:
            file = File.objects.get(id=file_id)
        except File.DoesNotExist:
            return Response(
                {"error": "Файл не найден"},
                status=status.HTTP_404_NOT_FOUND
            )

        if file.owner != request.user:
            return Response(
                {"error": "Только владелец файла может отзывать права"},
                status=status.HTTP_403_FORBIDDEN
            )

        user_email = request.data.get('user_email')
        if not user_email:
            return Response(
                {"error": "Необходимо указать user_email"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            target_user = User.objects.get(email=user_email)
        except User.DoesNotExist:
            return Response(
                {"error": f"Пользователь {user_email} не найден"},
                status=status.HTTP_404_NOT_FOUND
            )

        revoked = permission_service.revoke_permission(
            user=target_user,
            file=file
        )
        
        if revoked:
            return Response(
                {"message": "Права доступа отозваны"},
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                {"error": "Права доступа не найдены"},
                status=status.HTTP_404_NOT_FOUND
            )
        
    except Exception as e:
        logger.error(f"Error revoking file permission: {str(e)}")
        return Response(
            {"error": "Ошибка при отзыве прав"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def revoke_folder_permission(request, folder_id):
    """Обработчик API для отзыва индивидуальных прав доступа к конкретной папке (директории).

    Принимает DELETE-запрос, выполняет комплексную валидацию контекста (наличие каталога,
    проверка прав владения у запрашивающего лица, верификация существования указанного
    в теле запроса пользователя) и инициирует аннулирование (удаление) записей
    разрешений на данную папку через ``PermissionService``.

    Args:
        request (Request): Объект входящего запроса Django REST Framework, содержащий
            данные авторизованного пользователя в ``request.user`` и payload в ``request.data``.
        folder_id (int): Идентификатор (ID) папки, права на которую подлежат аннулированию.

    Returns:
        Response: Объект ``Response`` DRF, содержащий:
        - Статус 200 с подтверждающим текстовым сообщением при успешном отзыве прав.
        - Статус 400 при отсутствии обязательного параметра ``user_email`` в теле запроса.
        - Статус 403, если операцию пытается выполнить не владелец папки.
        - Статус 404, если папка, целевой пользователь или сама запись права не обнаружены.
        - Статус 500 при возникновении непредвиденных системных исключений на стороне сервера.

    Note:
        Эндпоинт защищен декоратором ``@permission_classes([IsAuthenticated])``,
        что исключает возможность его вызова анонимными клиентами.
    """
    try:
        try:
            folder = Folder.objects.get(id=folder_id)
        except Folder.DoesNotExist:
            return Response(
                {"error": "Папка не найдена"},
                status=status.HTTP_404_NOT_FOUND
            )

        if folder.owner != request.user:
            return Response(
                {"error": "Только владелец папки может отзывать права"},
                status=status.HTTP_403_FORBIDDEN
            )

        user_email = request.data.get('user_email')
        if not user_email:
            return Response(
                {"error": "Необходимо указать user_email"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            target_user = User.objects.get(email=user_email)
        except User.DoesNotExist:
            return Response(
                {"error": f"Пользователь {user_email} не найден"},
                status=status.HTTP_404_NOT_FOUND
            )

        revoked = permission_service.revoke_permission(
            user=target_user,
            folder=folder
        )
        
        if revoked:
            return Response(
                {"message": "Права доступа отозваны"},
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                {"error": "Права доступа не найдены"},
                status=status.HTTP_404_NOT_FOUND
            )
        
    except Exception as e:
        logger.error(f"Error revoking folder permission: {str(e)}")
        return Response(
            {"error": "Ошибка при отзыве прав"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_file_permissions(request, file_id):
    """Обработчик API для получения списка всех выданных прав доступа к конкретному файлу.

    Принимает GET-запрос, проверяет существование целевого файла и валидирует права
    запрашивающего лица (доступ разрешен только владельцу файла). При успешной проверке
    собирает все активные записи разрешений через ``PermissionService`` и возвращает их
    в сериализованном виде.

    Args:
        request (Request): Объект входящего запроса Django REST Framework, содержащий
            данные авторизованного пользователя в ``request.user``.
        file_id (int): Идентификатор (ID) файла, список прав которого запрашивается.

    Returns:
        Response: Объект ``Response`` DRF, содержащий:
        - Статус 200 и структуру с ID файла, его именем и массивом выданных разрешений при успехе.
        - Статус 403, если операцию пытается выполнить не владелец файла.
        - Статус 404, если указанный файл не найден в системе.
        - Статус 500 при возникновении непредвиденных системных исключений на стороне сервера.

    Note:
        Эндпоинт защищен декоратором ``@permission_classes([IsAuthenticated])``,
        что исключает возможность его вызова анонимными клиентами.
    """

    try:
        try:
            file = File.objects.get(id=file_id)
        except File.DoesNotExist:
            return Response(
                {"error": "Файл не найден"},
                status=status.HTTP_404_NOT_FOUND
            )

        if file.owner != request.user:
            return Response(
                {"error": "Только владелец файла может просматривать права"},
                status=status.HTTP_403_FORBIDDEN
            )

        permissions = permission_service.get_resource_permissions(file=file)
        
        return Response({
            "file_id": file_id,
            "file_name": file.name,
            "permissions": PermissionSerializer(permissions, many=True).data
        })
        
    except Exception as e:
        logger.error(f"Error listing file permissions: {str(e)}")
        return Response(
            {"error": "Ошибка при получении прав"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_folder_permissions(request, folder_id):
    """Обработчик API для получения списка всех выданных прав доступа к конкретной папке.

    Принимает GET-запрос, проверяет существование целевой папки и валидирует права
    запрашивающего лица (доступ разрешен только владельцу папки). При успешной проверке
    собирает все активные записи разрешений через ``PermissionService`` и возвращает их
    в сериализованном виде.

    Args:
        request (Request): Объект входящего запроса Django REST Framework, содержащий
            данные авторизованного пользователя в ``request.user``.
        folder_id (int): Идентификатор (ID) папки, список прав которой запрашивается.

    Returns:
        Response: Объект ``Response`` DRF, содержащий:
        - Статус 200 и структуру с ID папки, ее именем и массивом выданных разрешений при успехе.
        - Статус 403, если операцию пытается выполнить не владелец папки.
        - Статус 404, если указанная папка не найдена в системе.
        - Статус 500 при возникновении непредвиденных системных исключений на стороне сервера.

    Note:
        Эндпоинт защищен декоратором ``@permission_classes([IsAuthenticated])``,
        что исключает возможность его вызова анонимными клиентами.
    """
    try:
        try:
            folder = Folder.objects.get(id=folder_id)
        except Folder.DoesNotExist:
            return Response(
                {"error": "Папка не найдена"},
                status=status.HTTP_404_NOT_FOUND
            )

        if folder.owner != request.user:
            return Response(
                {"error": "Только владелец папки может просматривать права"},
                status=status.HTTP_403_FORBIDDEN
            )

        permissions = permission_service.get_resource_permissions(folder=folder)
        
        return Response({
            "folder_id": folder_id,
            "folder_name": folder.name,
            "permissions": PermissionSerializer(permissions, many=True).data
        })
        
    except Exception as e:
        logger.error(f"Error listing folder permissions: {str(e)}")
        return Response(
            {"error": "Ошибка при получении прав"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_permissions(request):
    """Обработчик API для получения списка всех индивидуальных прав доступа текущего пользователя.

    Принимает GET-запрос от аутентифицированного клиента, запрашивает через ``PermissionService``
    все назначенные ему персональные правила авторизации (на файлы и папки) и возвращает
    их в виде сериализованного массива с указанием общего количества записей.

    Args:
        request (Request): Объект входящего запроса Django REST Framework, содержащий
            данные авторизованного пользователя в ``request.user``.

    Returns:
        Response: Объект ``Response`` DRF, содержащий:
        - Статус 200 и структуру с количеством прав (count) и массивом сериализованных объектов.
        - Статус 500 при возникновении непредвиденных системных исключений на стороне сервера.

    Note:
        Эндпоинт защищен декоратором ``@permission_classes([IsAuthenticated])``,
        что исключает возможность его вызова анонимными клиентами.
    """
    try:
        permissions = permission_service.get_user_permissions(request.user)
        
        return Response({
            "count": len(permissions),
            "permissions": PermissionSerializer(permissions, many=True).data
        })
        
    except Exception as e:
        logger.error(f"Error getting user permissions: {str(e)}")
        return Response(
            {"error": "Ошибка при получении прав"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def accessible_files(request):
    """Обработчик API для получения списка всех файлов, к которым у пользователя есть доступ.

       Принимает GET-запрос, определяет перечень файлов, находящихся в легитимном доступе
       у запрашивающего лица (включая как собственные файлы, так и ресурсы с делегированными
       прямыми правами), сериализует их и возвращает клиенту.

       Args:
           request (Request): Объект входящего запроса Django REST Framework, содержащий
               данные авторизованного пользователя в ``request.user``.

       Returns:
           Response: Объект ``Response`` DRF, содержащий:
           - Статус 200 и структуру с количеством файлов (count) и массивом их сериализованных данных.
           - Статус 500 при возникновении непредвиденных системных исключений на стороне сервера.

       Note:
           Проверка доступности ресурсов осуществляется на уровне базы данных, минимизируя
           нагрузку на сервер при работе с большими объемами метаданных файловой системы.
       """
    try:
        from .serializers import FileSerializer
        
        files = permission_service.get_accessible_files(request.user)
        
        return Response({
            "count": len(files),
            "files": FileSerializer(files, many=True).data
        })
        
    except Exception as e:
        logger.error(f"Error getting accessible files: {str(e)}")
        return Response(
            {"error": "Ошибка при получении файлов"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def accessible_folders(request):
    """Обработчик API для получения списка всех папок, к которым у пользователя есть доступ.

    Принимает GET-запрос, собирает перечень доступных папок (собственные папки и каталоги
    с прямыми правами доступа) через ``PermissionService``. Вместо полноценного сериализатора
    выполняет быструю сборку плоского словаря (dict) с вычислением абсолютного пути
    в дереве каталогов.

    Args:
        request (Request): Объект входящего запроса Django REST Framework, содержащий
            данные авторизованного пользователя в ``request.user``.

    Returns:
        Response: Объект ``Response`` DRF, содержащий:
        - Статус 200 и JSON-структуру с количеством папок (count) и массивом деталей
          каждой директории (id, name, path, owner_email, created_at).
        - Статус 500 при возникновении непредвиденных системных исключений на стороне сервера.
    """
    try:
        folders = permission_service.get_accessible_folders(request.user)

        folders_data = [
            {
                "id": f.id,
                "name": f.name,
                "path": f.get_full_path(),
                "owner_email": f.owner.email,
                "created_at": f.created_at.isoformat(),
            }
            for f in folders
        ]
        
        return Response({
            "count": len(folders),
            "folders": folders_data
        })
        
    except Exception as e:
        logger.error(f"Error getting accessible folders: {str(e)}")
        return Response(
            {"error": "Ошибка при получении папок"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
