from django.conf import settings
from rest_framework.exceptions import PermissionDenied
from rest_framework.authentication import CSRFCheck
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.settings import api_settings

from ep_files_app.models.models import User


class EpFilesJWTAuthentication(JWTAuthentication):
    """Класс JWT-аутентификации для работы с кастомной моделью пользователя.

    Расширяет стандартный механизм аутентификации ``JWTAuthentication`` из библиотеки
    SimpleJWT, адаптируя его под использование кастомной модели ``User`` (где логином
    выступает email). Отвечает за извлечение идентификатора пользователя из валидированного
    токена доступа и последующий поиск соответствующей учетной записи в базе данных.

    Methods:
        get_user(validated_token): Извлекает пользователя из базы данных на основе
            данных из декодированного JWT-токена.
    """

    def authenticate(self, request):
        """Authenticate by Authorization header or by HttpOnly access-token cookie."""
        header = self.get_header(request)
        cookie_auth = False

        if header is None:
            raw_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE_NAME)
            cookie_auth = bool(raw_token)
        else:
            raw_token = self.get_raw_token(header)

        if raw_token is None:
            return None

        if cookie_auth and request.method not in ("GET", "HEAD", "OPTIONS", "TRACE"):
            self.enforce_csrf(request)

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token

    def enforce_csrf(self, request):
        """Require a valid CSRF token when JWT auth comes from cookies."""
        check = CSRFCheck(lambda req: None)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise PermissionDenied(f"CSRF Failed: {reason}")

    def get_user(self, validated_token):
        """Извлекает и верифицирует экземпляр пользователя из переданного JWT-токена.

                Анализирует payload токена для поиска заклеймленного идентификатора
                (по умолчанию ``user_id``). Если идентификатор отсутствует или связанный с ним
                пользователь был удален из базы данных, генерирует исключение аутентификации
                с понятным кодом ошибки.

                Args:
                    validated_token (Token): Объект валидированного и успешно декодированного
                        библиотекой SimpleJWT токена доступа.

                Returns:
                    User: Экземпляр кастомной модели ``User``, соответствующий идентификатору
                    из токена.

                Raises:
                    AuthenticationFailed: Если токен не содержит обязательного поля идентификатора
                        или пользователь с таким первичным ключом отсутствует в системе.

                Examples:
                    >>> auth = EpFilesJWTAuthentication()
                    >>> user = auth.get_user(decoded_token)
                """
        user_id = validated_token.get(api_settings.USER_ID_CLAIM)

        if user_id is None:
            raise AuthenticationFailed(
                "Токен не содержит идентификатор пользователя.",
                code="token_no_user_id",
            )

        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist as exc:
            raise AuthenticationFailed(
                "Пользователь по токену не найден.",
                code="user_not_found",
            ) from exc

        if not user.is_active:
            raise AuthenticationFailed(
                "Ваш аккаунт заблокирован администратором.",
                code="user_blocked",
            )

        return user
