import io
import os
import html
import mimetypes
from abc import ABC, abstractmethod

from PIL import Image
from django.contrib.auth.hashers import make_password
from django.core.exceptions import ValidationError
from django.db import models

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
    file = models.FileField(upload_to='files')

    name = models.CharField(max_length=100, blank=True)

    size = models.BigIntegerField(editable=False, null=True, blank=True)

    owner = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)

    date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.file:
            if not self.size:
                self.size = self.file.size
            if not self.name:
                self.name = os.path.basename(self.file.name)

        super().save(*args, **kwargs)

class BasePreview:
    """Базовый интерфейс предпросмотра файла."""

    def generate_preview(self, file_obj):
        raise NotImplementedError


class TextPreview(BasePreview):
    """Предпросмотр текстовых файлов."""

    def generate_preview(self, file_obj):
        with file_obj.file.open("rb") as opened_file:
            raw_content = opened_file.read(4096)

        text = raw_content.decode("utf-8", errors="replace")
        return {
            "type": "text",
            "content": html.escape(text),
        }


class ImagePreview(BasePreview):
    """Предпросмотр изображений."""

    def generate_preview(self, file_obj):
        return {
            "type": "image",
            "url": file_obj.file.url,
            "name": file_obj.name,
        }


class PreviewFactory:
    """Фабрика выбора стратегии предпросмотра по MIME-типу."""

    @staticmethod
    def get_preview(file_obj):
        file_name = file_obj.name or file_obj.file.name
        mime_type, _ = mimetypes.guess_type(file_name)

        if mime_type and mime_type.startswith("image/"):
            return ImagePreview()

        if mime_type and (
            mime_type.startswith("text/")
            or mime_type in ("application/json", "application/xml")
        ):
            return TextPreview()

        raise ValidationError("Предпросмотр для этого типа файла не поддерживается.")