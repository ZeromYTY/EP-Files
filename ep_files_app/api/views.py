from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.contrib.auth.hashers import check_password
from rest_framework_simplejwt.tokens import RefreshToken

from ep_files_app.models.models import User
from .serializers import UserRegistrationSerializer
import os

from django.http import JsonResponse
from django.http import FileResponse, Http404
from ep_files_app.models.models import File
from main import settings
from ep_files_app.services.file_service import FileService



# 1. Регистрация
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserRegistrationSerializer


# 2. Логин (выдача токена для кастомной модели)
class LoginView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        user = User.objects.filter(email=email).first()

        if user and check_password(password, user.password_hash):
            # Генерируем токены вручную
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            })

        return Response({'error': 'Неверные данные'}, status=status.HTTP_401_UNAUTHORIZED)


# 3. Тестовый эндпоинт для проверки защиты
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def protected_test_view(request):
    return Response({"message": "Доступ разрешен! JWT работает."})


# 4. Загрузка файла (с JWT авторизацией)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_file(request):
    if request.method == "POST":
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        file_service = FileService()
        file_obj, processing_info = file_service.handle_upload(uploaded_file, request.user)
        
        if file_obj is None:
            return Response({"error": processing_info}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'message': 'Файл успешно загружен!',
            'file_id': file_obj.id,
            'file_name': file_obj.name,
            'file_size': file_obj.size,
            'processing_info': processing_info
        }, status=status.HTTP_201_CREATED)


# 5. Скачивание файла
@api_view(['GET'])
def download_file(request, file_id):
    try:
        file_rec = File.objects.get(id=file_id)
    except File.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

    response = FileResponse(file_rec.file.open('rb'))
    filename = os.path.basename(file_rec.file.name)
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


