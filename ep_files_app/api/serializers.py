
"""
DRF-сериализаторы для ресурсов User и File.

Отвечают за валидацию входных данных, хэширование пароля
и вычисляемые поля, такие как ``download_url``.
"""

from rest_framework import serializers
from ep_files_app.models.models import User, File


class UserSerializer(serializers.ModelSerializer):
    """Сериализатор для чтения данных пользователя.

    Используется в ответах API, где нужно отобразить профиль.
    Не включает чувствительные поля, такие как ``password``.
    """

    class Meta:
        model = User
        fields = ["id", "name", "email", "is_staff", "is_superuser", "is_active", "date_joined"]


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Сериализатор для регистрации нового пользователя.

    Проверяет уникальность ``email``, минимальную длину пароля
    (6 символов) и хэширует пароль перед сохранением.

    Поля:
        name (str): Отображаемое имя, необязательное.
        email (str): Должен быть уникальным среди всех пользователей.
        password (str): Только запись; минимум 6 символов.
    """

    name = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["name", "email", "password"]

    def validate_email(self, value):
        """Отклонить дублирующийся email-адрес.

        Аргументы:
            value (str): Значение email из запроса.

        Возвращает:
            str: Прошедший валидацию email.

        Исключения:
            serializers.ValidationError: Если email уже зарегистрирован.
        """
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Пользователь с такой почтой уже есть.")
        return value

    def validate_password(self, value):
        """Проверить минимальную длину пароля.

        Аргументы:
            value (str): Значение пароля из запроса.

        Возвращает:
            str: Прошедший валидацию пароль.

        Исключения:
            serializers.ValidationError: Если пароль короче 6 символов.
        """
        if len(value) < 6:
            raise serializers.ValidationError("Пароль должен содержать минимум 6 символов.")
        return value

    def create(self, validated_data):
        """Создать и сохранить нового пользователя с хэшированным паролем.

        Аргументы:
            validated_data (dict): Прошедшие валидацию поля из запроса.

        Возвращает:
            User: Созданный экземпляр пользователя.
        """
        name = validated_data.pop("name", "")
        password = validated_data.pop("password")
        user = User(name=name, **validated_data)
        user.set_password(password)
        user.save()
        return user


class FileSerializer(serializers.ModelSerializer):
    """Сериализатор для чтения данных файла.

    Добавляет email владельца и вычисляемый URL для скачивания
    к стандартным полям метаданных файла.

    Поля:
        owner_email (str): Email владельца файла (только чтение).
        download_url (str): Относительный URL для скачивания (вычисляемое).
    """

    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = File
        fields = ["id", "name", "size", "date", "owner_email", "download_url"]

    def get_download_url(self, obj):
        """Сформировать URL для скачивания файла.

        Аргументы:
            obj (File): Экземпляр файла, который сериализуется.

        Возвращает:
            str: Относительный путь, например ``/api/download/42/``.
        """
        return f"/api/download/{obj.id}/"
