"""API-представления для просмотра истории действий с файлами."""
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

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def file_history(request, file_id):
    try:
        file_obj = File.objects.get(id=file_id)
        if file_obj.owner != request.user:
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)
        history = FileHistory.objects.filter(file=file_obj).order_by("-timestamp")
        from .serializers import FileHistorySerializer
        return Response({
            "file_id": file_id,
            "file_name": file_obj.name,
            "history": FileHistorySerializer(history, many=True).data,
        })
    except File.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_activity_history(request):
    user_files = File.objects.filter(owner=request.user)
    history = FileHistory.objects.filter(file__in=user_files).order_by("-timestamp")
    event_type = request.GET.get("event_type")
    if event_type:
        history = history.filter(event_type=event_type)
    days = request.GET.get("days")
    if days:
        try:
            since = timezone.now() - timedelta(days=int(days))
            history = history.filter(timestamp__gte=since)
        except ValueError:
            pass
    limit = int(request.GET.get("limit", 50))
    history = history[:limit]
    from .serializers import FileHistorySerializer
    return Response({
        "count": len(history),
        "history": FileHistorySerializer(history, many=True).data,
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recent_activity(request):
    user_files = File.objects.filter(owner=request.user)
    history = FileHistory.objects.filter(file__in=user_files).order_by("-timestamp")[:10]
    from .serializers import FileHistorySerializer
    return Response(FileHistorySerializer(history, many=True).data)
