"""API-представления для чтения и сохранения текстовых файлов во встроенном редакторе."""
import html as html_module
import logging
import os
import re

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ep_files_app.models.models import File
from ep_files_app.services.file_event_service import file_event_service

logger = logging.getLogger(__name__)

ALLOWED_TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js", ".py"]
TEXT_ENCODINGS = ["utf-8-sig", "utf-8", "cp1251", "latin-1"]


def _sanitize_text_content(text: str) -> str:
    """Очищает текстовое содержимое от опасных скриптов и тегов."""
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'\bon\w+\s*=\s*["\'][^"\']*["\']', '', text, flags=re.IGNORECASE)
    text = re.sub(r'javascript\s*:', '', text, flags=re.IGNORECASE)
    text = html_module.escape(text)
    return text


def get_editable_text_file(request, file_id):
    """Проверяет доступ к текстовому файлу для редактирования."""
    try:
        file_obj = File.objects.get(id=file_id)
    except File.DoesNotExist:
        return None, None, Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

    if not permission_service.can_write_file(request.user, file_obj):
        return None, None, Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    ext = os.path.splitext(file_obj.name)[1].lower()
    if ext not in ALLOWED_TEXT_EXTENSIONS:
        return None, None, Response(
            {"error": f"Cannot edit binary file with extension '{ext}'"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return file_obj, ext, None


def content_for_storage(content, ext):
    """Подготавливает содержимое для сохранения с учетом типа файла."""
    if ext in {".txt", ".md", ".xml", ".html", ".css", ".js"}:
        return _sanitize_text_content(content)
    return content


def decode_text_content(content):
    for encoding in TEXT_ENCODINGS:
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")


def write_text_file(file_obj, content):
    """Записывает текстовое содержимое в файл."""
    encoded_content = content.encode("utf-8")
    file_obj.file.open("wb")
    file_obj.file.write(encoded_content)
    file_obj.file.close()
    file_obj.size = len(encoded_content)
    file_obj.save(update_fields=["size"])


def validate_text_storage_limit(user, incoming_size, replaced_size):
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
@permission_classes([IsAuthenticated])
def save_text_file(request, file_id):
    file_obj, ext, error = get_editable_text_file(request, file_id)
    if error:
        return error

    content = request.data.get("content")
    if content is None:
        return Response({"error": "Field 'content' is required"}, status=status.HTTP_400_BAD_REQUEST)

    sanitized_content = content_for_storage(content, ext)
    encoded_size = len(sanitized_content.encode("utf-8"))
    storage_error = validate_text_storage_limit(file_obj.owner, encoded_size, file_obj.size or 0)
    if storage_error:
        return storage_error

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

    if not permission_service.can_read_file(request.user, file_obj):
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    ext = os.path.splitext(file_obj.name)[1].lower()
    allowed_text_extensions = [".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js", ".py"]
    if ext not in allowed_text_extensions:
        return Response(
            {"error": f"Cannot read binary file with extension '{ext}'"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with file_obj.file.open("rb") as f:
        content = decode_text_content(f.read())

    return Response({
        "file_id": file_obj.id,
        "file_name": file_obj.name,
        "content": content,
        "size": file_obj.size,
    })
