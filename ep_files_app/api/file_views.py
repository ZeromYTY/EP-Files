"""API-представления для загрузки, скачивания, удаления, перемещения и просмотра файлов."""
import logging
import mimetypes
import os
from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db.models import Q, Sum
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ep_files_app.models.models import File, FileReport, Folder, ImagePreview, PreviewFactory
from ep_files_app.services.file_event_service import file_event_service
from ep_files_app.services.permission_service import permission_service
from ep_files_app.permissions import CanUploadFiles
from ep_files_app.validators import (
    sanitize_filename, validate_file_extension,
    validate_file_size, validate_filename,
)
from .serializers import FileSerializer

logger = logging.getLogger(__name__)


def format_size(bytes_count):
    size = float(bytes_count or 0)
    units = ("Б", "КБ", "МБ", "ГБ")
    index = 0
    while size >= 1024 and index < len(units) - 1:
        size /= 1024
        index += 1
    value = f"{size:.1f}" if size < 10 and index else f"{size:.0f}"
    return f"{value} {units[index]}"


def validate_uploaded_file(uploaded_file):
    """Валидирует загружаемый файл по имени, расширению и размеру."""
    for validator in (validate_filename, validate_file_extension, validate_file_size):
        try:
            validator(uploaded_file if validator is validate_file_size else uploaded_file.name)
        except ValidationError as exc:
            message = exc.messages[0] if hasattr(exc, "messages") else str(exc)
            return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
    return None


def get_upload_folder(request):
    """Получает папку для загрузки файла из запроса."""
    folder_id = request.data.get("folder_id")
    if not folder_id:
        return None, None
    try:
        folder = Folder.objects.get(id=folder_id, is_deleted=False)
    except Folder.DoesNotExist:
        return None, Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)

    if not permission_service.can_write_folder(request.user, folder):
        return None, Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    return folder, None


def create_uploaded_file(uploaded_file, request, folder):
    """Создает объект файла и генерирует событие загрузки."""
    file_obj = File(
        name=sanitize_filename(uploaded_file.name),
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
    return file_obj


def validate_storage_limit(user, incoming_size, replaced_size=0):
    current_size = File.objects.filter(owner=user, is_deleted=False).aggregate(total=Sum("size"))["total"] or 0
    projected_size = current_size - replaced_size + incoming_size
    if projected_size > user.storage_limit:
        available_space = max(user.storage_limit - current_size, 0)
        return Response(
            {
                "error": (
                    f"Недостаточно места в хранилище. Доступно {format_size(available_space)}, "
                    f"а файл занимает {format_size(incoming_size)}."
                ),
                "code": "storage_limit_exceeded",
                "storage_limit": user.storage_limit,
                "total_size": current_size,
                "available_space": available_space,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    return None


@api_view(["POST"])
@permission_classes([IsAuthenticated, CanUploadFiles])
def upload_file(request):
    if request.method != "POST":
        return Response({"error": "Method not allowed"}, status=status.HTTP_405_METHOD_NOT_ALLOWED)
    try:
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"error": "File not provided"}, status=status.HTTP_400_BAD_REQUEST)

        validation_error = validate_uploaded_file(uploaded_file)
        if validation_error:
            return validation_error

        storage_error = validate_storage_limit(request.user, uploaded_file.size)
        if storage_error:
            return storage_error

        folder, folder_error = get_upload_folder(request)
        if folder_error:
            return folder_error

        file_obj = create_uploaded_file(uploaded_file, request, folder)
        logger.info("File uploaded: %s by user %s", file_obj.name, request.user.email)
        return Response({
            "message": "File uploaded successfully",
            "file": FileSerializer(file_obj).data,
        }, status=status.HTTP_201_CREATED)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("File upload error: %s", str(exc))
        return Response({"error": "Upload failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_files(request):
    files = permission_service.get_accessible_files(request.user)
    files = sorted(files, key=lambda file_obj: file_obj.date, reverse=True)
    data = FileSerializer(files, many=True).data
    for file_data, file_obj in zip(data, files):
        file_data["can_write"] = permission_service.can_write_file(request.user, file_obj)
    return Response(data)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_file(request, file_id):
    try:
        file_rec = File.objects.get(id=file_id, is_deleted=False)
        if not permission_service.can_read_file(request.user, file_rec):
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
    try:
        file_obj = File.objects.get(id=file_id, is_deleted=False)
        
        if request.method == "PATCH":
            if not permission_service.can_write_file(request.user, file_obj):
                return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)
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
        
        if file_obj.owner != request.user:
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

        filename = file_obj.name
        file_id_for_event = file_obj.id
        file_obj.is_deleted = True
        file_obj.deleted_at = timezone.now()
        file_obj.save(update_fields=["is_deleted", "deleted_at"])
        file_event_service.emit_delete_event(
            file_id=file_id_for_event,
            file_name=filename,
            user=request.user,
            ip_address=request.META.get("REMOTE_ADDR"),
        )
        logger.info("File moved to trash: %s by user %s", filename, request.user.email)
        return Response({"message": f'File "{filename}" moved to trash successfully'})
    except File.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)


def permanently_delete_file(file_obj):
    """Deletes a file record and its physical file from storage."""
    if file_obj.file:
        try:
            file_obj.file.delete(save=False)
        except Exception as exc:  # pylint: disable=broad-except
            logger.error("Error deleting physical file: %s", str(exc))
    file_obj.delete()


def folder_has_deleted_content(folder):
    if File.objects.filter(folder=folder, is_deleted=True).exists():
        return True
    return any(
        folder_has_deleted_content(child)
        for child in Folder.objects.filter(parent=folder, is_deleted=True)
    )


def deleted_folder_size(folder):
    total = File.objects.filter(folder=folder, is_deleted=True).aggregate(total=Sum("size"))["total"] or 0
    for child in Folder.objects.filter(parent=folder, is_deleted=True):
        total += deleted_folder_size(child)
    return total


def serialize_trash_folder(folder):
    return {
        "id": folder.id,
        "type": "folder",
        "name": folder.name,
        "size": deleted_folder_size(folder),
        "deleted_at": folder.deleted_at,
        "parent_id": folder.parent_id,
    }


def serialize_trash_file(file_obj):
    data = FileSerializer(file_obj).data
    data["type"] = "file"
    return data


def permanently_delete_folder(folder):
    for child in Folder.objects.filter(parent=folder, is_deleted=True):
        permanently_delete_folder(child)

    for file_obj in File.objects.filter(folder=folder, is_deleted=True):
        permanently_delete_file(file_obj)

    folder.delete()


def restore_folder_tree(folder):
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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def trash_list(request):
    folder_id = request.GET.get("folder_id")
    current_folder = None

    if folder_id not in (None, ""):
        try:
            current_folder = Folder.objects.get(id=folder_id, owner=request.user, is_deleted=True)
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

    folder_items = [serialize_trash_folder(folder) for folder in folders if folder_has_deleted_content(folder)]
    file_items = [serialize_trash_file(file_obj) for file_obj in files]

    return Response({
        "current_folder": serialize_trash_folder(current_folder) if current_folder else None,
        "items": folder_items + file_items,
    })


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def trash_restore(request, file_id):
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

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def file_move(request, file_id):
    try:
        file_obj = File.objects.get(id=file_id, is_deleted=False)
    except File.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

    if not permission_service.can_write_file(request.user, file_obj):
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    target_folder_id = request.data.get("folder_id")
    target_folder = None

    if target_folder_id not in (None, ""):
        try:
            target_folder = Folder.objects.get(id=target_folder_id, is_deleted=False)
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
    try:
        file_obj = File.objects.get(id=file_id, is_deleted=False)
        if not permission_service.can_read_file(request.user, file_obj):
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)
        data = FileSerializer(file_obj).data
        data["can_write"] = permission_service.can_write_file(request.user, file_obj)
        return Response(data)
    except File.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def report_file(request, file_id):
    try:
        file_obj = File.objects.get(id=file_id)
    except File.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

    if file_obj.owner_id == request.user.id:
        return Response({"error": "Cannot report your own file"}, status=status.HTTP_400_BAD_REQUEST)

    if not permission_service.can_read_file(request.user, file_obj):
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    reason = (request.data.get("reason") or "").strip()
    message = (request.data.get("message") or "").strip()
    if not reason:
        return Response({"error": "reason is required"}, status=status.HTTP_400_BAD_REQUEST)
    if len(reason) > 120:
        return Response({"error": "reason is too long"}, status=status.HTTP_400_BAD_REQUEST)
    if len(message) > 2000:
        return Response({"error": "message is too long"}, status=status.HTTP_400_BAD_REQUEST)

    report = FileReport.objects.create(
        file=file_obj,
        file_name=file_obj.name,
        file_owner_email=file_obj.owner.email if file_obj.owner else "",
        public_token=file_obj.public_token or "",
        reporter_email=request.user.email,
        reason=reason,
        message=message,
    )
    return Response({
        "status": "created",
        "report_id": report.id,
        "message": "Жалоба отправлена администратору.",
    }, status=status.HTTP_201_CREATED)

def file_preview(request, file_id):
    """Генерирует предпросмотр файла (изображение или текст)."""
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
def search_files(request):
    try:
        query = request.GET.get("q", "").strip()
        if not query:
            return Response({"error": "Search parameter 'q' is required"},
                            status=status.HTTP_400_BAD_REQUEST)
        files = File.objects.filter(
            owner=request.user,
            is_deleted=False,
            name__icontains=query,
        ).order_by("-date")
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
def user_storage_stats(request):
    try:
        user = request.user
        active_files = File.objects.filter(owner=user, is_deleted=False)
        total_files = active_files.count()
        total_size = active_files.aggregate(total=Sum("size"))["total"] or 0
        storage_limit = user.storage_limit
        usage_percent = (total_size / storage_limit * 100) if storage_limit > 0 else 0
        week_ago = timezone.now() - timedelta(days=7)
        recent_files = active_files.filter(date__gte=week_ago).count()
        file_types = {}
        for file in active_files:
            ext = os.path.splitext(file.name)[1].lower() or "no extension"
            file_types[ext] = file_types.get(ext, 0) + 1
        return Response({
            "total_files": total_files,
            "total_size": total_size,
            "storage_limit": storage_limit,
            "usage_percent": round(usage_percent, 2),
            "available_space": max(storage_limit - total_size, 0),
            "recent_files_count": recent_files,
            "file_types": file_types,
        })
    except Exception as exc:
        logger.error("Stats error: %s", str(exc))
        return Response({"error": "Failed to get stats"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
