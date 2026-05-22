"""API-представления для включения, отключения и использования публичных ссылок."""
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
    while True:
        token = secrets.token_urlsafe(32)

        file_exists = File.objects.filter(public_token=token).exists()
        folder_exists = Folder.objects.filter(public_token=token).exists()

        if not file_exists and not folder_exists:
            return token


def _build_public_url(request, path):
    return request.build_absolute_uri(path)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def enable_file_public_link(request, file_id):
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