"""API-представления для регистрации, входа и получения данных текущего пользователя."""
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

class RegisterView(generics.CreateAPIView):
    """Регистрирует пользователя и возвращает JWT-токены."""
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserRegistrationSerializer

    def create(self, request, *args, **kwargs):
        """Создаёт пользователя и формирует ответ с токенами."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        user = serializer.instance
        logger.info(
            "User registered: %s",
            user.email,
            extra={"user": user.email},
        )
        refresh = RefreshToken.for_user(user)
        data = {
            "token": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data,
        }
        headers = self.get_success_headers(serializer.data)
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)

class LoginView(APIView):
    """Проверяет данные входа пользователя."""
    permission_classes = (AllowAny,)

    def post(self, request):
        """Авторизует пользователя по email и паролю."""
        email = request.data.get("email")
        password = request.data.get("password")
        user = User.objects.filter(email=email).first()
        if user and check_password(password, user.password_hash):
            if not user.is_active:
                logger.warning(
                    "Blocked user login attempt: %s",
                    user.email,
                    extra={"user": user.email},
                )
                return Response(
                    {
                        "error": "Ваш аккаунт заблокирован администратором.",
                        "code": "user_blocked",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            logger.info(
                "User logged in: %s",
                user.email,
                extra={"user": user.email},
            )
            refresh = RefreshToken.for_user(user)
            return Response({
                "token": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
            })
        logger.warning(
            "Failed login attempt for email: %s",
            email,
            extra={"user": email or "anonymous"},
        )
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

class MeView(APIView):
    """Возвращает данные текущего авторизованного пользователя."""
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        """Возвращает email, имя и роль текущего пользователя."""
        return Response({"user": UserSerializer(request.user).data})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def protected_test_view(request):
    """Проверяет работу защищённого API-endpoint."""
    return Response({"message": "Access granted. JWT is working."})
