import mimetypes
import os
from django.db import models
from django.contrib.auth.models import User

from abc import ABC, abstractmethod
import html

from PIL import Image
import io


from django.contrib.auth.hashers import make_password
from django.core.exceptions import ValidationError

from main import settings


class User(models.Model):
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=100, blank=True, default='')
    password_hash = models.CharField(max_length=128)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    @property
    def is_anonymous(self):
        return False

    @property
    def is_authenticated(self):
        return True

    class Meta:
        app_label = 'ep_files_app'

    def set_password(self, raw_password):
        """Хеширует пароль перед сохранением"""
        self.password_hash = make_password(raw_password)

    def __str__(self):
        return self.email



class File(models.Model):
    """
    Модель для представления загруженного файла и его метаданных.

    Используется для хранения физического пути к файлу и связи с владельцем.
    Автоматически вычисляет размер и извлекает имя файла при сохранении.

    Attributes:
        file (models.FileField): Объект файла, хранящийся в папке 'files'.
        name (models.CharField): Оригинальное имя файла (заполняется автоматически).
        size (models.BigIntegerField): Размер файла в байтах (заполняется автоматически).
        owner (models.ForeignKey): Ссылка на пользователя (User), загрузившего файл.
        date (models.DateTimeField): Дата и время загрузки файла.
    """
    file = models.FileField(upload_to='files')
    name = models.CharField(max_length=100, blank=True)
    size = models.BigIntegerField(editable=False, null=True, blank=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        """
        Возвращает строковое представление объекта.

        Returns:
            str: Имя файла или "Unnamed File", если имя не задано.
        """
        return self.name if self.name else "Unnamed File"

    def save(self, *args, **kwargs):
        """
        Сохраняет экземпляр модели в базе данных.

        Перед вызовом базового метода save() проверяет наличие файла и
        автоматически заполняет поля 'size' и 'name', если они пусты.

        Args:
            *args: Произвольные позиционные аргументы.
            **kwargs: Произвольные именованные аргументы.
        """
        if self.file:
            if not self.size:
                self.size = self.file.size
            if not self.name:
                self.name = os.path.basename(self.file.name)
        super().save(*args, **kwargs)



class PreviewStrategy(ABC):
    """
    Абстрактный базовый класс для стратегий генерации превью.
    """

    @abstractmethod
    def preview(self, file: bytes) -> str | bytes:
        """
        Создает превью на основе сырых данных файла.

        Args:
            file (bytes): Содержимое файла в байтах.

        Returns:
            str | bytes: Текстовая строка или байты изображения для превью.
        """
        pass


class TextPreview(PreviewStrategy):
    """
    Стратегия для создания превью текстовых файлов.
    """

    def preview(self, file: bytes) -> str:
        """
        Читает начало текстового файла и экранирует HTML-символы.

        Args:
            file (bytes): Содержимое файла.

        Returns:
            str: Первые 20 строк текста, безопасные для отображения в HTML.
        """
        text = file.decode("utf-8", errors="ignore")
        lines = text.splitlines()[:20]
        preview = "\n".join(lines)
        return html.escape(preview)


class ImagePreview(PreviewStrategy):
    """
    Стратегия для создания миниатюр изображений.
    """

    def preview(self, file: bytes) -> bytes:
        """
        Изменяет размер изображения и конвертирует его в JPEG.

        Args:
            file (bytes): Исходные байты изображения.

        Returns:
            bytes: Сжатое изображение (миниатюра) в формате JPEG.
        """
        img = Image.open(io.BytesIO(file))
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        img.thumbnail((300, 300))
        output = io.BytesIO()
        img.save(output, format="JPEG", quality=70)
        return output.getvalue()


class PreviewFactory:
    """
    Фабрика для выбора подходящей стратегии превью.
    """

    _strategies = {
        'text': TextPreview(),
        'image': ImagePreview()
    }

    @staticmethod
    def get_strategy(name: str) -> PreviewStrategy:
        """
        Определяет стратегию превью на основе имени файла.

        Args:
            name (str): Имя файла с расширением.

        Returns:
            PreviewStrategy: Экземпляр подходящей стратегии (Text или Image).
        """
        ext = name.split('.')[-1].lower() if '.' in name else ''
        img_extns = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
        if ext in img_extns:
            return PreviewFactory._strategies['image']
        return PreviewFactory._strategies['text']


class FileOperationFacade:
    """
    Фасад для централизованного управления операциями над файлами.

    Скрывает внутреннюю сложность проверки ограничений, взаимодействия с базой данных
    и физическим хранилищем. Является единой точкой входа для файлового модуля.
    """

    @staticmethod
    def upload_file(file, user):
        """
        Выполняет валидацию и регистрацию нового файла в системе.

        Метод проверяет наличие файла и его соответствие лимитам размера,
        после чего создает запись в базе данных и сохраняет файл на диск.

        Args:
            file (django.core.files.uploadedfile.UploadedFile): Объект файла из запроса.
            user (User): Экземпляр пользователя, который будет назначен владельцем файла.

        Returns:
            File: Объект созданной модели File с заполненными метаданными.

        Raises:
            ValidationError: Если файл отсутствует или его размер превышает
                установленное значение settings.MAX_FILE_SIZE.
        """
        if not file:
            raise ValidationError("Файл не найден")
        if file.size > settings.MAX_FILE_SIZE:
            raise ValidationError("Файл слишком большой")

        file_obj = File(file=file, owner=user)
        file_obj.save()
        return file_obj

    @staticmethod
    def delete_file(file_id, user):
        """
        Удаляет файл из системы с проверкой прав владения.

        Удаление происходит как из базы данных, так и из физического хранилища (Media).
        Операция будет выполнена только в том случае, если файл принадлежит
        указанному пользователю.

        Args:
            file_id (int): Идентификатор (ID) удаляемого файла.
            user (User): Объект пользователя, инициирующего удаление.

        Returns:
            bool: True, если файл был успешно найден и удален.
                  False, если файл не существует или пользователь не является его владельцем.
        """
        try:
            file_obj = File.objects.get(id=file_id, owner=user)
            file_obj.file.delete()
            file_obj.delete()
            return True
        except File.DoesNotExist:
            return False

