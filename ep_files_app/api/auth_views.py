"""API-представления для регистрации, входа и получения данных текущего пользователя."""
import logging

from django.contrib.auth.hashers import check_password
from PIL import Image, UnidentifiedImageError
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from ep_files_app.models.models import User
from .serializers import ChangePasswordSerializer, UserRegistrationSerializer, UserSerializer

logger = logging.getLogger(__name__)

MAX_AVATAR_SIZE = 2 * 1024 * 1024
ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def serialized_user(user, request):
    return UserSerializer(user, context={"request": request}).data


def validate_avatar(uploaded_file):
    if not uploaded_file:
        return "Файл аватара не передан."
    if uploaded_file.size > MAX_AVATAR_SIZE:
        return "Аватар должен быть меньше 2 MB."
    if uploaded_file.content_type not in ALLOWED_AVATAR_TYPES:
        return "Поддерживаются только JPEG, PNG, WEBP и GIF."
    try:
        Image.open(uploaded_file).verify()
        uploaded_file.seek(0)
    except (UnidentifiedImageError, OSError, SyntaxError):
        return "Файл не является корректным изображением."
    return None

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
            "user": serialized_user(user, request),
        }
        headers = self.get_success_headers(serializer.data)
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)

class LoginView(APIView):
    """Проверяет данные входа пользователя."""
    permission_classes = (AllowAny,)

    def post(self, request):
        """Авторизует пользователя по email и паролю."""
        raw_email = request.data.get("email") or ""
        email = raw_email.strip().lower()
        password = request.data.get("password")
        user = User.objects.filter(email__iexact=email).first()
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
                "user": serialized_user(user, request),
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
        return Response({"user": serialized_user(request.user, request)})

class ChangePasswordView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password_hash"])
        logger.info(
            "User changed password: %s",
            request.user.email,
            extra={"user": request.user.email},
        )
        return Response({"message": "Пароль успешно изменен."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def protected_test_view(request):
    """Проверяет работу защищённого API-endpoint."""
    return Response({"message": "Access granted. JWT is working."})


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def avatar_view(request):
    if request.method == "DELETE":
        if request.user.avatar:
            request.user.avatar.delete(save=False)
        request.user.avatar = None
        request.user.save(update_fields=["avatar"])
        return Response({"user": serialized_user(request.user, request)})

    uploaded_file = request.FILES.get("avatar")
    error = validate_avatar(uploaded_file)
    if error:
        return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)

    if request.user.avatar:
        request.user.avatar.delete(save=False)
    request.user.avatar = uploaded_file
    request.user.save(update_fields=["avatar"])
    return Response({"user": serialized_user(request.user, request)})
