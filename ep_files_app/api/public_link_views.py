"""API-представления для включения, отключения и использования публичных ссылок."""
import mimetypes
import os
import secrets
from datetime import timedelta

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from ep_files_app.models.models import File, Folder

MAX_PUBLIC_LINK_MINUTES = 60 * 24 * 365


def _generate_unique_token():
    while True:
        token = secrets.token_urlsafe(32)

        file_exists = File.objects.filter(public_token=token).exists()
        folder_exists = Folder.objects.filter(public_token=token).exists()

        if not file_exists and not folder_exists:
            return token


def _build_public_url(request, path):
    return request.build_absolute_uri(path)


def _public_expiration_from_request(request):
    raw_minutes = request.data.get("public_expires_in_minutes")
    if raw_minutes in (None, "", "never"):
        return None, None

    try:
        minutes = int(raw_minutes)
    except (TypeError, ValueError):
        return None, Response(
            {"error": "public_expires_in_minutes must be an integer"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if minutes < 1 or minutes > MAX_PUBLIC_LINK_MINUTES:
        return None, Response(
            {"error": "public_expires_in_minutes is out of allowed range"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return timezone.now() + timedelta(minutes=minutes), None


def _is_public_link_active(resource):
    return resource.is_public and (
        resource.public_expires_at is None or resource.public_expires_at > timezone.now()
    )


def _get_active_public_resource(model, token):
    resource = get_object_or_404(model, public_token=token, is_public=True)
    if not _is_public_link_active(resource):
        resource.is_public = False
        resource.public_token = None
        resource.public_expires_at = None
        resource.save(update_fields=["is_public", "public_token", "public_expires_at"])
        return None
    return resource


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def enable_file_public_link(request, file_id):
    file_obj = get_object_or_404(File, id=file_id, owner=request.user)
    expires_at, error = _public_expiration_from_request(request)
    if error:
        return error

    if not file_obj.public_token:
        file_obj.public_token = _generate_unique_token()

    file_obj.is_public = True
    file_obj.public_expires_at = expires_at
    file_obj.save(update_fields=["public_token", "is_public", "public_expires_at"])

    public_path = f"/api/public/files/{file_obj.public_token}/"

    return Response({
        "status": "enabled",
        "file_id": file_obj.id,
        "file_name": file_obj.name,
        "public_token": file_obj.public_token,
        "public_expires_at": file_obj.public_expires_at.isoformat() if file_obj.public_expires_at else None,
        "public_url": _build_public_url(request, public_path),
    })


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def disable_file_public_link(request, file_id):
    file_obj = get_object_or_404(File, id=file_id, owner=request.user)

    file_obj.is_public = False
    file_obj.public_token = None
    file_obj.public_expires_at = None
    file_obj.save(update_fields=["public_token", "is_public", "public_expires_at"])

    return Response({
        "status": "disabled",
        "file_id": file_obj.id,
        "file_name": file_obj.name,
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def public_download_file(request, token):
    file_obj = _get_active_public_resource(File, token)
    if file_obj is None:
        return Response({"error": "Public link expired"}, status=status.HTTP_404_NOT_FOUND)

    if request.GET.get("meta") == "1":
        return Response({
            "id": file_obj.id,
            "name": file_obj.name,
            "size": file_obj.size,
            "public_token": file_obj.public_token,
            "public_expires_at": file_obj.public_expires_at.isoformat() if file_obj.public_expires_at else None,
            "download_url": request.build_absolute_uri(f"/api/public/files/{token}/"),
        })

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
    folder = get_object_or_404(Folder, id=folder_id, owner=request.user)
    expires_at, error = _public_expiration_from_request(request)
    if error:
        return error

    if not folder.public_token:
        folder.public_token = _generate_unique_token()

    folder.is_public = True
    folder.public_expires_at = expires_at
    folder.save(update_fields=["public_token", "is_public", "public_expires_at"])

    public_path = f"/api/public/folders/{folder.public_token}/"

    return Response({
        "status": "enabled",
        "folder_id": folder.id,
        "folder_name": folder.name,
        "public_token": folder.public_token,
        "public_expires_at": folder.public_expires_at.isoformat() if folder.public_expires_at else None,
        "public_url": _build_public_url(request, public_path),
    })


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def disable_folder_public_link(request, folder_id):
    folder = get_object_or_404(Folder, id=folder_id, owner=request.user)

    folder.is_public = False
    folder.public_token = None
    folder.public_expires_at = None
    folder.save(update_fields=["public_token", "is_public", "public_expires_at"])

    return Response({
        "status": "disabled",
        "folder_id": folder.id,
        "folder_name": folder.name,
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def public_folder_detail(request, token):
    folder = _get_active_public_resource(Folder, token)
    if folder is None:
        return Response({"error": "Public link expired"}, status=status.HTTP_404_NOT_FOUND)

    child_folders = Folder.objects.filter(parent=folder)
    files = File.objects.filter(folder=folder)

    return Response({
        "folder": {
            "id": folder.id,
            "name": folder.name,
            "path": folder.get_full_path(),
            "public_expires_at": folder.public_expires_at.isoformat() if folder.public_expires_at else None,
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
    folder = _get_active_public_resource(Folder, token)
    if folder is None:
        return Response({"error": "Public link expired"}, status=status.HTTP_404_NOT_FOUND)
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
