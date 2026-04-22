from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.contrib.auth.hashers import check_password
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.exceptions import ValidationError
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta

from ep_files_app.models.models import User, File
from .serializers import UserRegistrationSerializer, UserSerializer, FileSerializer
from ep_files_app.permissions import IsFileOwner, CanUploadFiles
from ep_files_app.validators import (
    validate_file_extension,
    validate_file_size,
    validate_filename,
    sanitize_filename
)
import os
import logging

logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserRegistrationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        user = serializer.instance
        refresh = RefreshToken.for_user(user)
        data = {
            'token': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        }
        headers = self.get_success_headers(serializer.data)
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)


class LoginView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        user = User.objects.filter(email=email).first()

        if user and check_password(password, user.password_hash):
            refresh = RefreshToken.for_user(user)
            return Response({
                'token': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserSerializer(user).data,
            })

        return Response({'error': 'Неверные данные'}, status=status.HTTP_401_UNAUTHORIZED)


class MeView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response({'user': UserSerializer(request.user).data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def protected_test_view(request):
    return Response({"message": "Доступ разрешен! JWT работает."})


@api_view(['POST'])
@permission_classes([IsAuthenticated, CanUploadFiles])
def upload_file(request):
    """
    Обрабатывает HTTP POST запрос на загрузку файла.
    Использует `FileService` для валидации и сохранения файла.
    Доступ разрешен только аутентифицированным пользователям.

    Args:
        request (rest_framework.request.Request): Объект запроса DRF.
        Ожидает файл в `request.FILES` под ключом "file".

    Returns:
        rest_framework.response.Response: JSON с данными:
            - message (str): Подтверждение успеха.
            - file_id (int): ID созданного файла.
            - file_name (str): Имя файла.
            - file_size (int): Размер в байтах.
            - processing_info (str): Дополнительная информация от сервиса.

    Responses:
        201: Файл успешно создан.
        400: Ошибка валидации (нет файла или файл отклонен сервисом).
        401: Пользователь не авторизован.
    """
    """Загрузка файла с полной валидацией и защитой"""
    if request.method == "POST":
        try:
            uploaded_file = request.FILES.get("file")
            if not uploaded_file:
                return Response(
                    {"error": "Файл не предоставлен"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                validate_filename(uploaded_file.name)
            except ValidationError as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

            try:
                validate_file_extension(uploaded_file.name)
            except ValidationError as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

            try:
                validate_file_size(uploaded_file)
            except ValidationError as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

            safe_filename = sanitize_filename(uploaded_file.name)

            file_obj = File(
                name=safe_filename,
                size=uploaded_file.size,
                owner=request.user,
                file=uploaded_file
            )
            file_obj.save()

            logger.info(f"File uploaded: {safe_filename} by user {request.user.email}")
            return Response({
                'message': 'Файл успешно загружен!',
                'file': FileSerializer(file_obj).data
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"File upload error: {str(e)}")
            return Response(
                {"error": "Ошибка при загрузке файла"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# 5. Получение списка файлов пользователя
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_files(request):
    files = File.objects.filter(owner=request.user).order_by('-date')
    serializer = FileSerializer(files, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def download_file(request, file_id):
    """
        Обрабатывает HTTP GET запрос на скачивание файла по его ID.

        Находит запись в базе данных и возвращает поток байтов файла
        с заголовком Content-Disposition для инициирования скачивания в браузере.

        Args:
            request (rest_framework.request.Request): Объект запроса DRF.
            file_id (int): Уникальный идентификатор файла из URL.

        Returns:
            django.http.FileResponse: Бинарный поток файла.

        Raises:
            Http404: Если файл с указанным ID не найден в базе данных.

        Responses:
            200: Успешная отдача файла.
            404: Файл не найден.
        """


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_file(request, file_id):
    """Удаление файла с проверкой прав доступа"""
    try:
        file_obj = File.objects.get(id=file_id)

        if file_obj.owner != request.user:
            return Response(
                {"error": "У вас нет прав на удаление этого файла"},
                status=status.HTTP_403_FORBIDDEN
            )

        filename = file_obj.name

        if file_obj.file:
            try:
                file_obj.file.delete(save=False)
            except Exception as e:
                logger.error(f"Error deleting physical file: {str(e)}")

        file_obj.delete()

        logger.info(f"File deleted: {filename} by user {request.user.email}")

        return Response(
            {'message': f'Файл "{filename}" успешно удален'},
            status=status.HTTP_200_OK
        )
    except File.DoesNotExist:
        return Response(
            {"error": "Файл не найден"},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_file(request, file_id):
    """Скачивание файла с проверкой прав доступа"""
    try:
        from django.http import FileResponse
        import mimetypes

        file_rec = File.objects.get(id=file_id)

        if file_rec.owner != request.user:
            logger.warning(
                f"Unauthorized download attempt: file {file_id} by user {request.user.email}"
            )
            return Response(
                {"error": "У вас нет прав на скачивание этого файла"},
                status=status.HTTP_403_FORBIDDEN
            )
        if not file_rec.file or not os.path.exists(file_rec.file.path):
            return Response(
                {"error": "Файл не найден на сервере"},
                status=status.HTTP_404_NOT_FOUND
            )

        logger.info(f"File downloaded: {file_rec.name} by user {request.user.email}")

        file_handle = file_rec.file.open('rb')

        content_type, _ = mimetypes.guess_type(file_rec.name)
        if content_type is None:
            content_type = 'application/octet-stream'

        response = FileResponse(file_handle, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{file_rec.name}"'
        response['Content-Length'] = file_rec.size

        return response

    except File.DoesNotExist:
        return Response(
            {"error": "Файл не найден"},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Download error: {str(e)}")
        return Response(
            {"error": "Ошибка при скачивании файла"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# 8. Статистика пользователя (для статус-бара)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_storage_stats(request):
    """Получение статистики хранилища пользователя"""
    try:
        user = request.user

        total_files = File.objects.filter(owner=user).count()

        # Общий размер файлов
        total_size = File.objects.filter(owner=user).aggregate(
            total=Sum('size')
        )['total'] or 0

        storage_limit = 100 * 1024 * 1024  # 100 MB

        usage_percent = (total_size / storage_limit * 100) if storage_limit > 0 else 0

        week_ago = timezone.now() - timedelta(days=7)
        recent_files = File.objects.filter(
            owner=user,
            date__gte=week_ago
        ).count()

        file_types = {}
        files = File.objects.filter(owner=user)
        for file in files:
            ext = os.path.splitext(file.name)[1].lower() or 'без расширения'
            if ext in file_types:
                file_types[ext] += 1
            else:
                file_types[ext] = 1

        return Response({
            'total_files': total_files,
            'total_size': total_size,
            'storage_limit': storage_limit,
            'usage_percent': round(usage_percent, 2),
            'available_space': storage_limit - total_size,
            'recent_files_count': recent_files,
            'file_types': file_types,
        })

    except Exception as e:
        logger.error(f"Stats error: {str(e)}")
        return Response(
            {"error": "Ошибка при получении статистики"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_files(request):
    """Поиск файлов по имени"""
    try:
        query = request.GET.get('q', '').strip()

        if not query:
            return Response(
                {"error": "Параметр поиска 'q' обязателен"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Поиск по имени файла
        files = File.objects.filter(
            owner=request.user,
            name__icontains=query
        ).order_by('-date')

        serializer = FileSerializer(files, many=True)

        return Response({
            'query': query,
            'count': files.count(),
            'results': serializer.data
        })

    except Exception as e:
        logger.error(f"Search error: {str(e)}")
        return Response(
            {"error": "Ошибка при поиске"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def file_detail(request, file_id):
    """Получение детальной информации о файле"""
    try:
        file_obj = File.objects.get(id=file_id)

        # Проверяем права доступа
        if file_obj.owner != request.user:
            return Response(
                {"error": "У вас нет прав на просмотр этого файла"},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = FileSerializer(file_obj)

        return Response(serializer.data)

    except File.DoesNotExist:
        return Response(
            {"error": "Файл не найден"},
            status=status.HTTP_404_NOT_FOUND
        )
