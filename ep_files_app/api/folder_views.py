"""API-представления для создания, просмотра, перемещения и удаления папок."""
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

def add_folder_to_zip(zip_file, folder, current_path=""):
    files = File.objects.filter(folder_id=folder.id)
    for file_rec in files:
        if file_rec.file and os.path.exists(file_rec.file.path):
            archive_path = os.path.join(current_path, file_rec.name)
            zip_file.write(file_rec.file.path, archive_path)

    subfolders = Folder.objects.filter(parent_id=folder.id)
    for subfolder in subfolders:
        new_path = os.path.join(current_path, subfolder.name)
        add_folder_to_zip(zip_file, subfolder, new_path)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_folder(request, folder_id):
    try:
        folder_rec = Folder.objects.get(id=folder_id, owner=request.user)

        memory_file = io.BytesIO()
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            add_folder_to_zip(zip_file, folder_rec, folder_rec.name)

        memory_file.seek(0)

        response = FileResponse(memory_file, content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="{folder_rec.name}.zip"'
        return response

    except Folder.DoesNotExist:
        return Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as exc:
        return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def folder_tree(request):
    folders = Folder.objects.filter(owner=request.user).select_related("parent")
    data = [
        {
            "id": f.id,
            "name": f.name,
            "parent_id": f.parent_id,
            "path": f.get_full_path(),
            "size": f.get_total_size(),
            "created_at": f.created_at.isoformat(),
            "updated_at": f.updated_at.isoformat(),
        }
        for f in folders
    ]
    return Response({"folders": data})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_files(request):
    files = File.objects.filter(owner=request.user)

    user_fav_ids = set(FavoriteFile.objects.filter(user=request.user).values_list('file_id', flat=True))

    serializer = FileSerializer(files, many=True)
    data = serializer.data

    for file_data in data:
        file_data['is_favorite'] = file_data['id'] in user_fav_ids

    return Response(data)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def folder_create(request):
    name = request.data.get("name", "").strip()
    parent_id = request.data.get("parent_id")
    if not name:
        return Response({"error": "Folder name is required"}, status=status.HTTP_400_BAD_REQUEST)
    parent = None
    if parent_id:
        try:
            parent = Folder.objects.get(id=parent_id, owner=request.user)
        except Folder.DoesNotExist:
            return Response({"error": "Parent folder not found"}, status=status.HTTP_404_NOT_FOUND)
    folder = Folder.objects.create(name=name, owner=request.user, parent=parent)
    return Response({
        "id": folder.id,
        "name": folder.name,
        "parent_id": folder.parent_id,
        "path": folder.get_full_path(),
    }, status=status.HTTP_201_CREATED)

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def folder_rename(request, folder_id):

    try:
        folder = Folder.objects.get(id=folder_id, owner=request.user)
    except Folder.DoesNotExist:
        return Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)
    new_name = request.data.get("name", "").strip()
    if not new_name:
        return Response({"error": "New name is required"}, status=status.HTTP_400_BAD_REQUEST)
    folder.name = new_name
    folder.save(update_fields=["name", "updated_at"])
    return Response({"id": folder.id, "name": folder.name, "path": folder.get_full_path()})

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def folder_move(request, folder_id):
    try:
        folder = Folder.objects.get(id=folder_id, owner=request.user)
    except Folder.DoesNotExist:
        return Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)
    new_parent_id = request.data.get("parent_id")
    if new_parent_id:
        try:
            new_parent = Folder.objects.get(id=new_parent_id, owner=request.user)
        except Folder.DoesNotExist:
            return Response({"error": "Target folder not found"}, status=status.HTTP_404_NOT_FOUND)
        if new_parent.id == folder.id or new_parent.id in folder.get_all_descendant_ids():
            return Response({"error": "Cannot move folder into its own subtree"},
                            status=status.HTTP_400_BAD_REQUEST)
        folder.parent = new_parent
    else:
        folder.parent = None
    folder.save(update_fields=["parent", "updated_at"])
    return Response({"id": folder.id, "name": folder.name, "path": folder.get_full_path()})

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def folder_delete(request, folder_id):
    try:
        folder = Folder.objects.get(id=folder_id, owner=request.user)
    except Folder.DoesNotExist:
        return Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)
    folder.delete()
    return Response({"status": "deleted", "id": folder_id})
