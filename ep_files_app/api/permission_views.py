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
    """
    Выдать права доступа к файлу
    
    POST /api/files/{file_id}/permissions/grant/
    Body: {
        "user_email": "user@example.com",
        "permission_type": "read" | "read_write",
        "inherit": true
    }
    """
    try:
        # Получаем файл
        try:
            file = File.objects.get(id=file_id)
        except File.DoesNotExist:
            return Response(
                {"error": "Файл не найден"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Проверяем, что текущий пользователь - владелец
        if file.owner != request.user:
            return Response(
                {"error": "Только владелец файла может выдавать права"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Получаем данные из запроса
        user_email = request.data.get('user_email')
        permission_type = request.data.get('permission_type', Permission.READ)
        inherit = request.data.get('inherit', True)
        
        if not user_email:
            return Response(
                {"error": "Необходимо указать user_email"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Получаем пользователя
        try:
            target_user = User.objects.get(email=user_email)
        except User.DoesNotExist:
            return Response(
                {"error": f"Пользователь {user_email} не найден"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Нельзя выдать права самому себе
        if target_user == request.user:
            return Response(
                {"error": "Нельзя выдать права самому себе"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Выдаем права
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
    """
    Выдать права доступа к папке
    
    POST /api/folders/{folder_id}/permissions/grant/
    Body: {
        "user_email": "user@example.com",
        "permission_type": "read" | "read_write",
        "inherit": true
    }
    """
    try:
        # Получаем папку
        try:
            folder = Folder.objects.get(id=folder_id)
        except Folder.DoesNotExist:
            return Response(
                {"error": "Папка не найдена"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Проверяем, что текущий пользователь - владелец
        if folder.owner != request.user:
            return Response(
                {"error": "Только владелец папки может выдавать права"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Получаем данные из запроса
        user_email = request.data.get('user_email')
        permission_type = request.data.get('permission_type', Permission.READ)
        inherit = request.data.get('inherit', True)
        
        if not user_email:
            return Response(
                {"error": "Необходимо указать user_email"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Получаем пользователя
        try:
            target_user = User.objects.get(email=user_email)
        except User.DoesNotExist:
            return Response(
                {"error": f"Пользователь {user_email} не найден"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Нельзя выдать права самому себе
        if target_user == request.user:
            return Response(
                {"error": "Нельзя выдать права самому себе"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Выдаем права
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
    """
    Отозвать права доступа к файлу
    
    DELETE /api/files/{file_id}/permissions/revoke/
    Body: {
        "user_email": "user@example.com"
    }
    """
    try:
        # Получаем файл
        try:
            file = File.objects.get(id=file_id)
        except File.DoesNotExist:
            return Response(
                {"error": "Файл не найден"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Проверяем, что текущий пользователь - владелец
        if file.owner != request.user:
            return Response(
                {"error": "Только владелец файла может отзывать права"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Получаем email пользователя
        user_email = request.data.get('user_email')
        if not user_email:
            return Response(
                {"error": "Необходимо указать user_email"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Получаем пользователя
        try:
            target_user = User.objects.get(email=user_email)
        except User.DoesNotExist:
            return Response(
                {"error": f"Пользователь {user_email} не найден"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Отзываем права
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
    """
    Отозвать права доступа к папке
    
    DELETE /api/folders/{folder_id}/permissions/revoke/
    Body: {
        "user_email": "user@example.com"
    }
    """
    try:
        # Получаем папку
        try:
            folder = Folder.objects.get(id=folder_id)
        except Folder.DoesNotExist:
            return Response(
                {"error": "Папка не найдена"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Проверяем, что текущий пользователь - владелец
        if folder.owner != request.user:
            return Response(
                {"error": "Только владелец папки может отзывать права"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Получаем email пользователя
        user_email = request.data.get('user_email')
        if not user_email:
            return Response(
                {"error": "Необходимо указать user_email"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Получаем пользователя
        try:
            target_user = User.objects.get(email=user_email)
        except User.DoesNotExist:
            return Response(
                {"error": f"Пользователь {user_email} не найден"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Отзываем права
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
    """
    Получить список всех прав доступа к файлу
    
    GET /api/files/{file_id}/permissions/
    """
    try:
        # Получаем файл
        try:
            file = File.objects.get(id=file_id)
        except File.DoesNotExist:
            return Response(
                {"error": "Файл не найден"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Проверяем, что текущий пользователь - владелец
        if file.owner != request.user:
            return Response(
                {"error": "Только владелец файла может просматривать права"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Получаем все права
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
    """
    Получить список всех прав доступа к папке
    
    GET /api/folders/{folder_id}/permissions/
    """
    try:
        # Получаем папку
        try:
            folder = Folder.objects.get(id=folder_id)
        except Folder.DoesNotExist:
            return Response(
                {"error": "Папка не найдена"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Проверяем, что текущий пользователь - владелец
        if folder.owner != request.user:
            return Response(
                {"error": "Только владелец папки может просматривать права"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Получаем все права
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
    """
    Получить все права доступа текущего пользователя
    
    GET /api/permissions/my/
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
    """
    Получить все файлы, к которым у пользователя есть доступ
    
    GET /api/files/accessible/
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
    """
    Получить все папки, к которым у пользователя есть доступ
    
    GET /api/folders/accessible/
    """
    try:
        folders = permission_service.get_accessible_folders(request.user)
        
        # Простая сериализация папок
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
