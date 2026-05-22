"""API-представления для выдачи, отзыва и просмотра прав доступа."""
import logging

from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ep_files_app.models import File, Folder, Permission, User
from ep_files_app.services.permission_service import permission_service
from .serializers import PermissionSerializer

logger = logging.getLogger(__name__)

WRITABLE_FILE_EXTENSIONS = {".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js", ".py"}


def error_response(message, http_status):
    return Response({"error": message}, status=http_status)


def is_text_resource(resource):
    if not isinstance(resource, File):
        return True
    import os

    return os.path.splitext(resource.name)[1].lower() in WRITABLE_FILE_EXTENSIONS


def get_owned_resource(model, resource_id, request_user, names, action):
    try:
        resource = model.objects.get(id=resource_id)
    except model.DoesNotExist:
        return None, error_response(f"{names['title']} не найдена" if model is Folder else "Файл не найден", status.HTTP_404_NOT_FOUND)

    if resource.owner != request_user:
        return None, error_response(
            f"Только владелец {names['genitive']} может {action} права",
            status.HTTP_403_FORBIDDEN,
        )
    return resource, None


def get_target_user(request):
    user_email = request.data.get("user_email")
    if not user_email:
        return None, error_response("Необходимо указать user_email", status.HTTP_400_BAD_REQUEST)

    try:
        target_user = User.objects.get(email=user_email)
    except User.DoesNotExist:
        return None, error_response(f"Пользователь {user_email} не найден", status.HTTP_404_NOT_FOUND)

    if target_user == request.user:
        return None, error_response("Нельзя выдать права самому себе", status.HTTP_400_BAD_REQUEST)
    return target_user, None


def serialize_permission_response(permission):
    return Response(
        {"message": "Права доступа выданы", "permission": PermissionSerializer(permission).data},
        status=status.HTTP_201_CREATED,
    )


def handle_grant_error(error, resource_name):
    if isinstance(error, ValidationError):
        return error_response(str(error), status.HTTP_400_BAD_REQUEST)
    logger.error("Error granting %s permission: %s", resource_name, str(error))
    return error_response("Ошибка при выдаче прав", status.HTTP_500_INTERNAL_SERVER_ERROR)


def grant_resource_permission(request, model, resource_id, names, resource_arg):
    try:
        resource, error = get_owned_resource(model, resource_id, request.user, names, "выдавать")
        if error:
            return error

        target_user, error = get_target_user(request)
        if error:
            return error

        permission_type = request.data.get("permission_type", Permission.READ)
        if permission_type == Permission.READ_WRITE and not is_text_resource(resource):
            return error_response(
                "Права на запись можно выдать только для текстовых файлов.",
                status.HTTP_400_BAD_REQUEST,
            )

        permission = permission_service.grant_permission(
            granted_by=request.user,
            user=target_user,
            permission_type=permission_type,
            inherit=request.data.get("inherit", True),
            **{resource_arg: resource},
        )
        return serialize_permission_response(permission)
    except Exception as error:
        return handle_grant_error(error, resource_arg)


def revoke_resource_permission(request, model, resource_id, names, resource_arg):
    try:
        resource, error = get_owned_resource(model, resource_id, request.user, names, "отзывать")
        if error:
            return error

        target_user, error = get_target_user_for_revoke(request)
        if error:
            return error

        revoked = permission_service.revoke_permission(user=target_user, **{resource_arg: resource})
        if revoked:
            return Response({"message": "Права доступа отозваны"}, status=status.HTTP_200_OK)
        return error_response("Права доступа не найдены", status.HTTP_404_NOT_FOUND)
    except Exception as error:
        logger.error("Error revoking %s permission: %s", resource_arg, str(error))
        return error_response("Ошибка при отзыве прав", status.HTTP_500_INTERNAL_SERVER_ERROR)


def get_target_user_for_revoke(request):
    user_email = request.data.get("user_email")
    if not user_email:
        return None, error_response("Необходимо указать user_email", status.HTTP_400_BAD_REQUEST)

    try:
        return User.objects.get(email=user_email), None
    except User.DoesNotExist:
        return None, error_response(f"Пользователь {user_email} не найден", status.HTTP_404_NOT_FOUND)


def list_resource_permissions(request, model, resource_id, names, resource_arg):
    try:
        resource, error = get_owned_resource(model, resource_id, request.user, names, "просматривать")
        if error:
            return error

        permissions = permission_service.get_resource_permissions(**{resource_arg: resource})
        return Response({
            f"{resource_arg}_id": resource_id,
            f"{resource_arg}_name": resource.name,
            "permissions": PermissionSerializer(permissions, many=True).data,
        })
    except Exception as error:
        logger.error("Error listing %s permissions: %s", resource_arg, str(error))
        return error_response("Ошибка при получении прав", status.HTTP_500_INTERNAL_SERVER_ERROR)


FILE_NAMES = {"title": "Файл", "genitive": "файла"}
FOLDER_NAMES = {"title": "Папка", "genitive": "папки"}


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def grant_file_permission(request, file_id):
    return grant_resource_permission(request, File, file_id, FILE_NAMES, "file")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def grant_folder_permission(request, folder_id):
    return grant_resource_permission(request, Folder, folder_id, FOLDER_NAMES, "folder")


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def revoke_file_permission(request, file_id):
    return revoke_resource_permission(request, File, file_id, FILE_NAMES, "file")


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def revoke_folder_permission(request, folder_id):
    return revoke_resource_permission(request, Folder, folder_id, FOLDER_NAMES, "folder")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_file_permissions(request, file_id):
    return list_resource_permissions(request, File, file_id, FILE_NAMES, "file")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_folder_permissions(request, folder_id):
    return list_resource_permissions(request, Folder, folder_id, FOLDER_NAMES, "folder")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_permissions(request):
    try:
        permissions = permission_service.get_user_permissions(request.user)
        return Response({
            "count": len(permissions),
            "permissions": PermissionSerializer(permissions, many=True).data,
        })
    except Exception as error:
        logger.error("Error getting user permissions: %s", str(error))
        return error_response("Ошибка при получении прав", status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def accessible_files(request):
    try:
        from .serializers import FileSerializer

        files = permission_service.get_accessible_files(request.user)
        return Response({"count": len(files), "files": FileSerializer(files, many=True).data})
    except Exception as error:
        logger.error("Error getting accessible files: %s", str(error))
        return error_response("Ошибка при получении файлов", status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def accessible_folders(request):
    try:
        folders = permission_service.get_accessible_folders(request.user)
        folders_data = [
            {
                "id": folder.id,
                "name": folder.name,
                "path": folder.get_full_path(),
                "owner_email": folder.owner.email,
                "created_at": folder.created_at.isoformat(),
            }
            for folder in folders
        ]
        return Response({"count": len(folders), "folders": folders_data})
    except Exception as error:
        logger.error("Error getting accessible folders: %s", str(error))
        return error_response("Ошибка при получении папок", status.HTTP_500_INTERNAL_SERVER_ERROR)
