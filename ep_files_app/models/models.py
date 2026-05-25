"""Основные модели проекта: пользователи, файлы, папки, предпросмотр и избранное."""
import html
import io
import os
from abc import ABC, abstractmethod
from typing import Union

from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models
from PIL import Image

from main import settings

class UserManager(BaseUserManager):
    """Менеджер для создания пользователей и суперпользователей."""

    def create_user(self, email, password=None, **extra_fields):
        """Создаёт и сохраняет обычного пользователя."""
        if not email:
            raise ValueError("Email is required")

        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)

        if password:
            user.set_password(password)

        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Создаёт и сохраняет суперпользователя с правами администратора."""
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")

        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")

        return self.create_user(email, password, **extra_fields)

class User(models.Model):
    """Модель пользователя системы."""

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=100, blank=True, default="")
    avatar = models.ImageField(upload_to="avatars", null=True, blank=True)
    password_hash = models.CharField(max_length=128)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    storage_limit = models.BigIntegerField(default=100 * 1024 * 1024)
    date_joined = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = UserManager()

    class Meta:

        app_label = "ep_files_app"

    @property
    def is_anonymous(self):
        return False

    @property
    def is_authenticated(self):
        return True

    def set_password(self, raw_password):
        """Устанавливает пароль пользователя с хешированием."""
        self.password_hash = make_password(raw_password)

    def __str__(self):
        return self.email


class Folder(models.Model):
    """Модель папки для организации файлов."""

    name = models.CharField(max_length=255)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="folders")
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="children"
    )

    public_token = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
    )
    is_public = models.BooleanField(default=False)
    public_expires_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:

        unique_together = ("owner", "parent", "name")
        ordering = ["name"]
        app_label = "ep_files_app"

    def __str__(self):
        return self.get_full_path()

    def get_full_path(self):
        """Возвращает полный путь папки от корня."""
        parts = []
        node = self
        while node is not None:
            parts.append(node.name)
            node = node.parent
        return "/" + "/".join(reversed(parts))

    def get_all_descendant_ids(self):
        """Возвращает список ID всех вложенных папок."""

        ids = []
        for child in self.children.all():
            ids.append(child.id)
            ids.extend(child.get_all_descendant_ids())
        return ids

    def get_total_size(self):
        """Вычисляет общий размер всех файлов в папке и подпапках."""
        from django.db.models import Sum
        
        total_size = 0
        direct_files_size = self.files.filter(is_deleted=False).aggregate(total=Sum('size'))['total'] or 0
        total_size += direct_files_size
        
        for child in self.children.all():
            total_size += child.get_total_size()
        
        return total_size


class File(models.Model):
    """Модель файла, загруженного пользователем."""

    file = models.FileField(upload_to="files")
    name = models.CharField(max_length=100, blank=True)

    size = models.BigIntegerField(editable=False, null=True, blank=True)

    owner = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)

    date = models.DateTimeField(auto_now_add=True)
    folder = models.ForeignKey(
        Folder, null=True, blank=True, on_delete=models.SET_NULL, related_name="files"
    )

    public_token = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
    )
    is_public = models.BooleanField(default=False)
    public_expires_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.name if self.name else "Unnamed File"

    def save(self, *args, **kwargs):
        """Сохраняет файл, автоматически заполняя размер и имя."""
        if self.file:
            if not self.size:
                self.size = self.file.size
            if not self.name:
                self.name = os.path.basename(self.file.name)

        super().save(*args, **kwargs)

class BasePreview:
    """Базовый класс для генерации предпросмотра файлов."""

    def generate_preview(self, file_obj):
        """Генерирует предпросмотр файла."""
        raise NotImplementedError

class PreviewStrategy(ABC):
    """Абстрактная стратегия для создания предпросмотра файлов."""

    @abstractmethod
    def preview(self, file: bytes) -> Union[str, bytes]:
        """Создаёт предпросмотр файла."""
        pass


class TextPreview(PreviewStrategy):
    """Стратегия предпросмотра текстовых файлов."""

    def preview(self, file: bytes) -> str:
        """Возвращает первые 20 строк текстового файла."""
        text = file.decode("utf-8", errors="ignore")
        lines = text.splitlines()[:20]
        return html.escape("\n".join(lines))


class ImagePreview(PreviewStrategy):
    """Стратегия предпросмотра изображений."""

    def preview(self, file: bytes) -> bytes:
        """Создаёт миниатюру изображения размером 300x300."""
        img = Image.open(io.BytesIO(file))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.thumbnail((300, 300))
        output = io.BytesIO()
        img.save(output, format="JPEG", quality=70)
        return output.getvalue()


class PreviewFactory:
    """Фабрика для выбора стратегии предпросмотра файлов."""

    _strategies = {
        "text": TextPreview(),
        "image": ImagePreview(),
    }

    @staticmethod
    def get_strategy(name: str) -> PreviewStrategy:
        """Возвращает подходящую стратегию предпросмотра по имени файла."""
        ext = name.split('.')[-1].lower() if '.' in name else ''

        img_extns = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']

        if ext in img_extns:
            return PreviewFactory._strategies['image']

        if ext == 'txt':
            return PreviewFactory._strategies['text']

        return PreviewFactory._strategies['text']


class FileOperationFacade:
    """Фасад для упрощения операций с файлами."""

    @staticmethod
    def upload_file(file, user):
        """Загружает файл для пользователя."""
        if not file:
            raise ValidationError("File not provided")
        if file.size > settings.MAX_FILE_SIZE:
            raise ValidationError("File is too large")
        file_obj = File(file=file, owner=user)
        file_obj.save()
        return file_obj

    @staticmethod
    def delete_file(file_id, user):
        """Удаляет файл пользователя по ID."""
        try:
            file_obj = File.objects.get(id=file_id, owner=user)
            file_obj.file.delete()
            file_obj.delete()
            return True
        except File.DoesNotExist:
            return False

class FavoriteFile(models.Model):
    """Модель избранных файлов и папок пользователя."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorite_items")
    file = models.ForeignKey('File', on_delete=models.CASCADE, null=True, blank=True)
    folder = models.ForeignKey('Folder', on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ep_files_app_favorite_file'


class FileReport(models.Model):
    """Жалоба на файл, доступный по публичной ссылке."""

    STATUS_PENDING = "pending"
    STATUS_RESOLVED = "resolved"
    STATUS_CHOICES = (
        (STATUS_PENDING, "На рассмотрении"),
        (STATUS_RESOLVED, "Решена"),
    )

    ACTION_KEEP = "keep"
    ACTION_DISABLE_PUBLIC = "disable_public"
    ACTION_DELETE_FILE = "delete_file"
    ACTION_CHOICES = (
        (ACTION_KEEP, "Оставить файл"),
        (ACTION_DISABLE_PUBLIC, "Отключить публичную ссылку"),
        (ACTION_DELETE_FILE, "Удалить файл"),
    )

    file = models.ForeignKey(
        'File',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reports",
    )
    file_name = models.CharField(max_length=255)
    file_owner_email = models.EmailField(blank=True, default="")
    public_token = models.CharField(max_length=100, blank=True, default="", db_index=True)
    reporter_email = models.EmailField(blank=True, default="")
    reason = models.CharField(max_length=120)
    message = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    admin_action = models.CharField(max_length=30, choices=ACTION_CHOICES, blank=True, default="")
    admin_note = models.TextField(blank=True, default="")
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_file_reports",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Жалоба на {self.file_name}"
