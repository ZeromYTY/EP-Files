from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.settings import api_settings

from ep_files_app.models.models import User


class EpFilesJWTAuthentication(JWTAuthentication):
    """JWT authentication for the custom User model."""

    def get_user(self, validated_token):
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