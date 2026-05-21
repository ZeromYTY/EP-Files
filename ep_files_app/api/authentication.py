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
            return User.objects.get(pk=user_id)
        except User.DoesNotExist as exc:
            raise AuthenticationFailed(
                "Пользователь по токену не найден.",
                code="user_not_found",
            ) from exc