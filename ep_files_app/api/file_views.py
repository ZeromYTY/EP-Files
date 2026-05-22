"""API-представления для загрузки, скачивания, удаления, перемещения и просмотра файлов."""
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


def validate_uploaded_file(uploaded_file):
    for validator in (validate_filename, validate_file_extension, validate_file_size):
        try:
            validator(uploaded_file if validator is validate_file_size else uploaded_file.name)
        except ValidationError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return None


def get_upload_folder(request):
    folder_id = request.data.get("folder_id")
    if not folder_id:
        return None, None
    try:
        return Folder.objects.get(id=folder_id, owner=request.user), None
    except Folder.DoesNotExist:
        return None, Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)


def create_uploaded_file(uploaded_file, request, folder):
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
    current_size = File.objects.filter(owner=user).aggregate(total=Sum("size"))["total"] or 0
    projected_size = current_size - replaced_size + incoming_size
    if projected_size > user.storage_limit:
        return Response(
            {
                "error": "Недостаточно места в хранилище.",
                "code": "storage_limit_exceeded",
                "storage_limit": user.storage_limit,
                "total_size": current_size,
                "available_space": max(user.storage_limit - current_size, 0),
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
    files = File.objects.filter(owner=request.user).order_by("-date")
    return Response(FileSerializer(files, many=True).data)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_file(request, file_id):
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
    try:
        file_obj = File.objects.get(id=file_id)
        if file_obj.owner != request.user:
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)
        return Response(FileSerializer(file_obj).data)
    except File.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

def file_preview(request, file_id):
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
def user_storage_stats(request):
    try:
        user = request.user
        total_files = File.objects.filter(owner=user).count()
        total_size = File.objects.filter(owner=user).aggregate(total=Sum("size"))["total"] or 0
        storage_limit = user.storage_limit
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
            "available_space": max(storage_limit - total_size, 0),
            "recent_files_count": recent_files,
            "file_types": file_types,
        })
    except Exception as exc:
        logger.error("Stats error: %s", str(exc))
        return Response({"error": "Failed to get stats"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
