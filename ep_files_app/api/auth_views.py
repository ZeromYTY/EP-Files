"""API-представления для регистрации, входа и получения данных текущего пользователя."""
import logging

from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.middleware.csrf import get_token
from PIL import Image, UnidentifiedImageError
from rest_framework import generics, status
from rest_framework.authentication import CSRFCheck
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from ep_files_app.models.models import User
from .serializers import ChangePasswordSerializer, UserRegistrationSerializer, UserSerializer

logger = logging.getLogger(__name__)

MAX_AVATAR_SIZE = 2 * 1024 * 1024
ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def cookie_max_age(delta):
    return int(delta.total_seconds())


def set_auth_cookies(response, access_token, refresh_token=None):
    """Store JWTs in HttpOnly cookies for browser clients."""
    response.set_cookie(
        settings.JWT_ACCESS_COOKIE_NAME,
        str(access_token),
        max_age=cookie_max_age(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"]),
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        path=settings.JWT_ACCESS_COOKIE_PATH,
    )
    if refresh_token is not None:
        response.set_cookie(
            settings.JWT_REFRESH_COOKIE_NAME,
            str(refresh_token),
            max_age=cookie_max_age(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]),
            httponly=True,
            secure=settings.JWT_COOKIE_SECURE,
            samesite=settings.JWT_COOKIE_SAMESITE,
            path=settings.JWT_REFRESH_COOKIE_PATH,
        )
    return response


def clear_auth_cookies(response):
    response.delete_cookie(
        settings.JWT_ACCESS_COOKIE_NAME,
        path=settings.JWT_ACCESS_COOKIE_PATH,
        samesite=settings.JWT_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        path=settings.JWT_REFRESH_COOKIE_PATH,
        samesite=settings.JWT_COOKIE_SAMESITE,
    )
    return response


def enforce_csrf(request):
    check = CSRFCheck(lambda req: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise PermissionDenied(f"CSRF Failed: {reason}")


def auth_response(request, data, status_code=status.HTTP_200_OK, headers=None):
    response = Response(data, status=status_code, headers=headers)
    get_token(request)
    return response


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
        data = {"user": serialized_user(user, request)}
        headers = self.get_success_headers(serializer.data)
        response = auth_response(request, data, status.HTTP_201_CREATED, headers=headers)
        return set_auth_cookies(response, refresh.access_token, refresh)

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
            response = auth_response(request, {"user": serialized_user(user, request)})
            return set_auth_cookies(response, refresh.access_token, refresh)
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


class RefreshView(APIView):
    """Rotates/refreshes JWTs using the HttpOnly refresh-token cookie."""
    permission_classes = (AllowAny,)

    def post(self, request):
        enforce_csrf(request)
        refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if not refresh_token:
            return Response({"detail": "Refresh token cookie is missing."}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except InvalidToken as exc:
            response = Response({"detail": str(exc)}, status=status.HTTP_401_UNAUTHORIZED)
            return clear_auth_cookies(response)

        response = auth_response(request, {"detail": "Token refreshed."})
        return set_auth_cookies(
            response,
            serializer.validated_data["access"],
            serializer.validated_data.get("refresh"),
        )


class LogoutView(APIView):
    """Clears browser auth cookies."""
    permission_classes = (AllowAny,)

    def post(self, request):
        enforce_csrf(request)
        response = Response({"detail": "Logged out."})
        return clear_auth_cookies(response)

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
