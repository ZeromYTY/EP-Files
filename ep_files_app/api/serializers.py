
"""
DRF-сериализаторы для ресурсов User и File.

Отвечают за валидацию входных данных, хэширование пароля
и вычисляемые поля, такие как ``download_url``.
"""

from django.contrib.auth.hashers import check_password
from rest_framework import serializers
from ep_files_app.models.models import User, File
from ep_files_app.models.file_history import FileHistory
from ep_files_app.models.permissions import Permission


class UserSerializer(serializers.ModelSerializer):
    """Сериализатор для чтения общедоступных данных и профиля пользователя.

    Используется в эндпоинтах вывода списков или детальной информации о пользователях
    внутри ответов API. Исключает из сериализации конфиденциальные данные, такие как
    хэшированные пароли, внутренние токены сессий и административные метки.

    Attributes:
        Meta.model (User): Связанная модель пользователя Django.
        Meta.fields (list[str]): Набор полей, сериализуемых для передачи клиенту:
            ``['id', 'name', 'email', 'is_staff', 'is_superuser', 'is_active', 'storage_limit', 'date_joined']``.
    """

    class Meta:
        model = User
        fields = [
            "id",
            "name",
            "email",
            "is_staff",
            "is_superuser",
            "is_active",
            "storage_limit",
            "date_joined",
        ]


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Сериализатор для создания (регистрации) новых учетных записей пользователей.

    Обеспечивает сквозную валидацию входящих параметров: проверяет уникальность
    адреса электронной почты в рамках системы, осуществляет контроль минимальной
    длины пароля и гарантирует безопасное хэширование перед фиксацией записи в БД.

    Args:
        name (CharField): Необязательное имя пользователя, доступно только для записи.
        password (CharField): Пароль пользователя, доступен только для записи (не выводится в GET).

    Attributes:
        Meta.model (User): Связанная модель пользователя Django.
        Meta.fields (list[str]): Поля, принимаемые на вход: ``['name', 'email', 'password']``.
    """

    name = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["name", "email", "password"]

    def validate_email(self, value):
        """Проверяет уникальность адреса электронной почты среди зарегистрированных пользователей.

        Выполняет прямой запрос к базе данных :class:`User` для поиска дубликатов.
        Если пользователь с переданным email уже существует, генерирует ошибку валидации.

        Args:
            value (str): Проверяемый адрес электронной почты, переданный клиентом.

        Returns:
            str: Нормализованный и проверенный адрес электронной почты.

        Raises:
            ValidationError: Если в системе уже зарегистрирован пользователь с аналогичным email.

        Examples:
            >>> serializer = UserRegistrationSerializer()
            >>> serializer.validate_email("existing_user@example.com")
            Traceback (most recent call last):
                ...
            ValidationError: ['Пользователь с такой почтой уже есть.']
        """
        normalized_email = value.strip().lower()
        if User.objects.filter(email__iexact=normalized_email).exists():
            raise serializers.ValidationError("Пользователь с такой почтой уже есть.")
        return normalized_email

    def validate_password(self, value):
        """Проверяет соответствие пароля базовым критериям безопасности по длине.

        Гарантирует, что переданный пароль содержит не менее 6 символов. Не выполняет
        хэширование на данном этапе (хэширование делегировано методу ``create``).

        Args:
            value (str): Необработанная строка пароля из тела запроса.

        Returns:
            str: Проверенная строка пароля для последующего сохранения.

        Raises:
            ValidationError: Если длина строки строго меньше 6 символов.

        Examples:
            >>> serializer = UserRegistrationSerializer()
            >>> serializer.validate_password("123")
            Traceback (most recent call last):
                ...
            ValidationError: ['Пароль должен содержать минимум 6 символов.']
        """
        if len(value) < 6:
            raise serializers.ValidationError("Пароль должен содержать минимум 6 символов.")
        return value

    def create(self, validated_data):
        """Инициализирует и сохраняет объект нового пользователя с хэшированием пароля.

        Извлекает поля ``name`` и ``password`` из очищенных данных. Создает экземпляр
        модели :class:`User` и использует встроенный метод ``set_password()`` для
        преобразования сырого пароля в безопасный криптографический хэш (PBKDF2/Argon2).

        Args:
            validated_data (dict): Прошедший валидацию словарь параметров (email, password, name).

        Returns:
            User: Сохраненный в базе данных экземпляр созданного пользователя.
        """
        name = validated_data.pop("name", "")
        password = validated_data.pop("password")
        user = User(name=name, **validated_data)
        user.set_password(password)
        user.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not check_password(value, user.password_hash):
            raise serializers.ValidationError("Текущий пароль указан неверно.")
        return value

    def validate_new_password(self, value):
        if len(value) < 6:
            raise serializers.ValidationError("Новый пароль должен содержать минимум 6 символов.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Пароли не совпадают."})
        if attrs["current_password"] == attrs["new_password"]:
            raise serializers.ValidationError({"new_password": "Новый пароль должен отличаться от текущего."})
        return attrs


class FileSerializer(serializers.ModelSerializer):
    """Сериализатор для чтения метаданных и параметров объектов файлов.

    Обогащает стандартную модельную структуру вычисляемыми данными: подтягивает
    электронную почту владельца из связанной сущности и динамически генерирует
    внутренний URL-адрес для инициализации процедуры скачивания файла.

    Args:
        owner_email (EmailField): Электронный адрес владельца. Доступен только для чтения.
        download_url (SerializerMethodField): Вычисляемая ссылка на скачивание файла.

    Attributes:
        Meta.model (File): Связанная модель файла Django.
        Meta.fields (list[str]): Набор выводимых полей:
            ``['id', 'name', 'size', 'date', 'owner_email', 'download_url', 'folder', 'is_public', 'public_token', 'public_expires_at']``.
    """

    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = File
        fields = [
            "id",
            "name",
            "size",
            "date",
            "owner_email",
            "download_url",
            "folder",
            "is_public",
            "public_token",
            "public_expires_at",
        ]

    def get_download_url(self, obj):
        """Формирует относительный путь API для скачивания бинарного содержимого файла.

        Использует первичный ключ (ID) текущего сериализуемого объекта файла
        для сборки роута скачивания.

        Args:
            obj (File): Экземпляр обрабатываемой в данный момент модели файла.

        Returns:
            str: Относительный URI вида ``/api/download/<file_id>/``.

        Examples:
            >>> class MockFile: id = 105
            >>> serializer = FileSerializer()
            >>> serializer.get_download_url(MockFile())
            '/api/download/105/'
        """
        return f"/api/download/{obj.id}/"



class FileHistorySerializer(serializers.ModelSerializer):
    """Сериализатор для вывода записей аудита и истории изменений файлов.

    Предназначен исключительно для чтения (Read-Only). Агрегирует информацию
    о действиях пользователей или системы над файловыми объектами, включая IP-адреса,
    типы событий с их человекочитаемым описанием и фиксацию старых/новых значений полей.

    Args:
        user_name (SerializerMethodField): Имя или email исполнителя действия.
        user_email (EmailField): Email исполнителя из связанной модели (только чтение).
        event_display (CharField): Текстовое описание произошедшего события.
        event_type_display (CharField): Человекочитаемое представление типа события.

    Attributes:
        Meta.model (FileHistory): Модель, фиксирующая историю операций над файлами.
        Meta.read_only_fields (list[str]): Все поля заблокированы для изменения извне.
    """
    user_name = serializers.SerializerMethodField()
    user_email = serializers.EmailField(source='user.email', read_only=True)
    event_display = serializers.CharField(read_only=True)
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)
    
    class Meta:
        model = FileHistory
        fields = [
            'id',
            'file',
            'file_name',
            'event_type',
            'event_type_display',
            'event_display',
            'user',
            'user_name',
            'user_email',
            'timestamp',
            'old_value',
            'new_value',
            'details',
            'ip_address',
        ]
        read_only_fields = fields
    
    def get_user_name(self, obj):
        """Определяет текстовое имя пользователя, инициировавшего системное событие.

        Если событие привязано к конкретному аккаунту, возвращает его заполненное
        имя (name) или email. Если событие создано автоматическим процессом
        без участия пользователя, возвращает строковую константу.

        Args:
            obj (FileHistory): Экземпляр модели записи истории.

        Returns:
            str: Имя пользователя, его email или строка "Система".
        """
        if obj.user:
            return obj.user.name or obj.user.email
        return 'Система'



class PermissionSerializer(serializers.ModelSerializer):
    """Сериализатор для управления и просмотра прав доступа к ресурсам.

    Определяет уровни доступа пользователей (чтение/запись/управление) к объектам
    файлов или папок. Подтягивает связанные метаданные выдавшего права сотрудника,
    наименования целевых ресурсов и обрабатывает флаги наследования разрешений.

    Args:
        user_email (EmailField): Email пользователя, которому выдаются права.
        user_name (CharField): Имя пользователя, получающего права доступа.
        granted_by_email (EmailField): Email администратора/владельца, давшего доступ.
        granted_by_name (CharField): Имя сотрудника, выдавшего права доступа.
        resource_type (CharField): Строковое определение типа ресурса (файл/папка).
        resource_name (SerializerMethodField): Название целевого объекта доступа.
        permission_type_display (CharField): Понятный текст уровня доступа.

    Attributes:
        Meta.model (Permission): Модель матрицы прав доступа.
        Meta.read_only_fields (list[str]): Полный список полей защищен от записи через этот класс.
    """
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.name', read_only=True)
    granted_by_email = serializers.EmailField(source='granted_by.email', read_only=True)
    granted_by_name = serializers.CharField(source='granted_by.name', read_only=True)
    resource_type = serializers.CharField(read_only=True)
    resource_name = serializers.SerializerMethodField()
    permission_type_display = serializers.CharField(source='get_permission_type_display', read_only=True)
    
    class Meta:
        model = Permission
        fields = [
            'id',
            'user',
            'user_email',
            'user_name',
            'granted_by',
            'granted_by_email',
            'granted_by_name',
            'file',
            'folder',
            'resource_type',
            'resource_name',
            'permission_type',
            'permission_type_display',
            'inherit',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields
    
    def get_resource_name(self, obj):
        """Извлекает название целевого объекта (файла или папки), на который выдано право.

        Анализирует внешние ключи связи (Foreign Keys). Если право выдано на файл,
        будет возвращено имя файла, если на папку — имя папки. При отсутствии связей
        возвращает пустое значение.

        Args:
            obj (Permission): Экземпляр проверяемой модели прав доступа.

        Returns:
            str: Имя файла или папки, либо ``None`` при отсутствии привязки.
        """
        if obj.file:
            return obj.file.name
        elif obj.folder:
            return obj.folder.name
        return None
