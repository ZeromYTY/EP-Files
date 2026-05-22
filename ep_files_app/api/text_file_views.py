"""API-представления для чтения и сохранения текстовых файлов во встроенном редакторе."""
import io
import html as html_module
import logging
import mimetypes
import os
import re
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

ALLOWED_TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js", ".py"]


def _sanitize_text_content(text: str) -> str:
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'\bon\w+\s*=\s*["\'][^"\']*["\']', '', text, flags=re.IGNORECASE)
    text = re.sub(r'javascript\s*:', '', text, flags=re.IGNORECASE)
    text = html_module.escape(text)
    return text


def get_editable_text_file(request, file_id):
    try:
        file_obj = File.objects.get(id=file_id)
    except File.DoesNotExist:
        return None, None, Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

    if file_obj.owner != request.user:
        return None, None, Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    ext = os.path.splitext(file_obj.name)[1].lower()
    if ext not in ALLOWED_TEXT_EXTENSIONS:
        return None, None, Response(
            {"error": f"Cannot edit binary file with extension '{ext}'"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return file_obj, ext, None


def content_for_storage(content, ext):
    if ext in {".txt", ".md", ".xml", ".html", ".css", ".js"}:
        return _sanitize_text_content(content)
    return content


def write_text_file(file_obj, content):
    encoded_content = content.encode("utf-8")
    file_obj.file.open("wb")
    file_obj.file.write(encoded_content)
    file_obj.file.close()
    file_obj.size = len(encoded_content)
    file_obj.save(update_fields=["size"])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_text_file(request, file_id):
    file_obj, ext, error = get_editable_text_file(request, file_id)
    if error:
        return error

    content = request.data.get("content")
    if content is None:
        return Response({"error": "Field 'content' is required"}, status=status.HTTP_400_BAD_REQUEST)

    sanitized_content = content_for_storage(content, ext)
    write_text_file(file_obj, sanitized_content)
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
    try:
        file_obj = File.objects.get(id=file_id)
    except File.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

    if file_obj.owner != request.user:
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    ext = os.path.splitext(file_obj.name)[1].lower()
    allowed_text_extensions = [".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js", ".py"]
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
