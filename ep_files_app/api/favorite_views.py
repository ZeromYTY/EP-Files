"""API-представления для работы с избранными файлами и папками."""
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

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toggle_favorite(request, item_id):
    item_type = request.data.get("type", "file")

    if item_type == "folder":
        try:
            item_obj = Folder.objects.get(id=item_id, owner=request.user)
            fav_queryset = FavoriteFile.objects.filter(user=request.user, folder=item_obj)
            if fav_queryset.exists():
                fav_queryset.delete()
                return Response({"is_favorite": False, "message": "Папка удалена из избранного"})
            FavoriteFile.objects.create(user=request.user, folder=item_obj)
            return Response({"is_favorite": True, "message": "Папка добавлена в избранное"})
        except Folder.DoesNotExist:
            return Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)
    else:
        try:
            item_obj = File.objects.get(id=item_id, owner=request.user)
            fav_queryset = FavoriteFile.objects.filter(user=request.user, file=item_obj)
            if fav_queryset.exists():
                fav_queryset.delete()
                return Response({"is_favorite": False, "message": "Файл удален из избранного"})
            FavoriteFile.objects.create(user=request.user, file=item_obj)
            return Response({"is_favorite": True, "message": "Файл добавлен в избранное"})
        except File.DoesNotExist:
            return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_user_favorites(request):
    favs = FavoriteFile.objects.filter(user=request.user)

    result = []
    for f in favs:
        if f.file:
            result.append({"id": f.file.id, "name": f.file.name, "type": "file", "size": f.file.size})
        elif f.folder:
            result.append({"id": f.folder.id, "name": f.folder.name, "type": "folder", "size": 0})

    return Response({
        "file_ids": list(favs.filter(file__isnull=False).values_list('file_id', flat=True)),
        "folder_ids": list(favs.filter(folder__isnull=False).values_list('folder_id', flat=True)),
        "items": result
    })
