"""API-представления для работы с корзиной файлов и папок."""
import logging

from django.db.models import Q, Sum
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ep_files_app.models.models import File, Folder
from .serializers import FileSerializer

logger = logging.getLogger(__name__)


def permanently_delete_file(file_obj):
    """Удаляет запись файла и связанный файл из хранилища."""
    if file_obj.file:
        try:
            file_obj.file.delete(save=False)
        except Exception as exc:  # pylint: disable=broad-except
            logger.error("Error deleting physical file: %s", str(exc))
    file_obj.delete()


def folder_has_deleted_content(folder):
    """Проверяет, есть ли в удаленной папке видимое содержимое корзины."""
    if File.objects.filter(folder=folder, is_deleted=True).exists():
        return True
    return any(
        folder_has_deleted_content(child)
        for child in Folder.objects.filter(parent=folder, is_deleted=True)
    )


def deleted_folder_size(folder):
    """Считает размер удаленных файлов внутри папки и ее подпапок."""
    total = (
        File.objects.filter(folder=folder, is_deleted=True)
        .aggregate(total=Sum("size"))["total"] or 0
    )
    for child in Folder.objects.filter(parent=folder, is_deleted=True):
        total += deleted_folder_size(child)
    return total


def serialize_trash_folder(folder):
    """Возвращает данные удаленной папки для ответа корзины."""
    return {
        "id": folder.id,
        "type": "folder",
        "name": folder.name,
        "size": deleted_folder_size(folder),
        "deleted_at": folder.deleted_at,
        "parent_id": folder.parent_id,
    }


def serialize_trash_file(file_obj):
    """Возвращает данные удаленного файла для ответа корзины."""
    data = FileSerializer(file_obj).data
    data["type"] = "file"
    return data


def permanently_delete_folder(folder):
    """Удаляет папку, ее удаленные подпапки и файлы без восстановления."""
    for child in Folder.objects.filter(parent=folder, is_deleted=True):
        permanently_delete_folder(child)

    for file_obj in File.objects.filter(folder=folder, is_deleted=True):
        permanently_delete_file(file_obj)

    folder.delete()


def restore_folder_tree(folder):
    """Восстанавливает удаленную папку, вложенные папки и файлы."""
    folder.parent = folder.parent if folder.parent and not folder.parent.is_deleted else None
    folder.is_deleted = False
    folder.deleted_at = None
    folder.save(update_fields=["parent", "is_deleted", "deleted_at", "updated_at"])

    File.objects.filter(folder=folder, is_deleted=True).update(
        is_deleted=False,
        deleted_at=None,
    )

    for child in Folder.objects.filter(parent=folder, is_deleted=True):
        restore_folder_tree(child)


def get_current_trash_folder(request):
    """Возвращает выбранную удаленную папку или ``None`` для корня корзины."""
    folder_id = request.GET.get("folder_id")
    if folder_id in (None, ""):
        return None
    return Folder.objects.get(id=folder_id, owner=request.user, is_deleted=True)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def trash_list(request):
    """Возвращает содержимое корзины пользователя."""
    try:
        current_folder = get_current_trash_folder(request)
    except (Folder.DoesNotExist, ValueError, TypeError):
        return Response({"error": "Folder not found in trash"}, status=status.HTTP_404_NOT_FOUND)

    if current_folder:
        folders = Folder.objects.filter(
            owner=request.user,
            parent=current_folder,
            is_deleted=True,
        ).order_by("name")
        files = File.objects.filter(
            owner=request.user,
            folder=current_folder,
            is_deleted=True,
        ).select_related("owner", "folder").order_by("name")
    else:
        folders = Folder.objects.filter(
            owner=request.user,
            is_deleted=True,
        ).filter(
            Q(parent__isnull=True) | Q(parent__is_deleted=False)
        ).order_by("-deleted_at", "name")
        files = File.objects.filter(
            owner=request.user,
            is_deleted=True,
        ).filter(
            Q(folder__isnull=True) | Q(folder__is_deleted=False)
        ).select_related("owner", "folder").order_by("-deleted_at", "name")

    folder_items = [
        serialize_trash_folder(folder)
        for folder in folders
        if folder_has_deleted_content(folder)
    ]
    file_items = [serialize_trash_file(file_obj) for file_obj in files]

    return Response({
        "current_folder": serialize_trash_folder(current_folder) if current_folder else None,
        "items": folder_items + file_items,
    })


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def trash_restore(request, file_id):
    """Восстанавливает удаленный файл из корзины."""
    try:
        file_obj = File.objects.get(id=file_id, owner=request.user, is_deleted=True)
    except File.DoesNotExist:
        return Response({"error": "File not found in trash"}, status=status.HTTP_404_NOT_FOUND)

    file_obj.is_deleted = False
    file_obj.deleted_at = None
    if file_obj.folder and file_obj.folder.is_deleted:
        file_obj.folder = None
    file_obj.save(update_fields=["folder", "is_deleted", "deleted_at"])
    logger.info("File restored from trash: %s by user %s", file_obj.name, request.user.email)
    return Response({
        "message": f'File "{file_obj.name}" restored successfully',
        "file": FileSerializer(file_obj).data,
    })


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def trash_delete(request, file_id):
    """Удаляет файл из корзины без возможности восстановления."""
    try:
        file_obj = File.objects.get(id=file_id, owner=request.user, is_deleted=True)
    except File.DoesNotExist:
        return Response({"error": "File not found in trash"}, status=status.HTTP_404_NOT_FOUND)

    filename = file_obj.name
    permanently_delete_file(file_obj)
    logger.info("File permanently deleted: %s by user %s", filename, request.user.email)
    return Response({"message": f'File "{filename}" permanently deleted'})


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def trash_restore_folder(request, folder_id):
    """Восстанавливает папку из корзины."""
    try:
        folder = Folder.objects.get(id=folder_id, owner=request.user, is_deleted=True)
    except Folder.DoesNotExist:
        return Response({"error": "Folder not found in trash"}, status=status.HTTP_404_NOT_FOUND)

    restore_folder_tree(folder)
    logger.info("Folder restored from trash: %s by user %s", folder.name, request.user.email)
    return Response({
        "message": f'Folder "{folder.name}" restored successfully',
        "folder": serialize_trash_folder(folder),
    })


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def trash_delete_folder(request, folder_id):
    """Удаляет папку из корзины без возможности восстановления."""
    try:
        folder = Folder.objects.get(id=folder_id, owner=request.user, is_deleted=True)
    except Folder.DoesNotExist:
        return Response({"error": "Folder not found in trash"}, status=status.HTTP_404_NOT_FOUND)

    folder_name = folder.name
    permanently_delete_folder(folder)
    logger.info("Folder permanently deleted: %s by user %s", folder_name, request.user.email)
    return Response({"message": f'Folder "{folder_name}" permanently deleted'})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def trash_clear(request):
    """Очищает корзину пользователя."""
    root_folders = list(
        Folder.objects.filter(owner=request.user, is_deleted=True).filter(
            Q(parent__isnull=True) | Q(parent__is_deleted=False)
        )
    )
    deleted_folders_count = len(root_folders)
    for folder in root_folders:
        permanently_delete_folder(folder)

    files = list(File.objects.filter(owner=request.user, is_deleted=True))
    deleted_files_count = len(files)
    for file_obj in files:
        permanently_delete_file(file_obj)
    logger.info(
        "Trash cleared by user %s, files deleted: %s, folders deleted: %s",
        request.user.email,
        deleted_files_count,
        deleted_folders_count,
    )
    return Response({
        "message": "Trash cleared successfully",
        "deleted_count": deleted_files_count,
        "deleted_folders_count": deleted_folders_count,
    })
