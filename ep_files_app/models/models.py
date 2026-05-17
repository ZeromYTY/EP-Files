import html
import io
import os
from abc import ABC, abstractmethod
from typing import Union

from django.contrib.auth.hashers import make_password
from django.core.exceptions import ValidationError
from django.db import models
from PIL import Image

from main import settings




class User(models.Model):
    """Custom user model using email as identifier."""

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=100, blank=True, default="")
    password_hash = models.CharField(max_length=128)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        """Meta options for User model."""

        app_label = "ep_files_app"

    @property
    def is_anonymous(self):
        """Return False as authenticated users are not anonymous."""
        return False

    @property
    def is_authenticated(self):
        """Return True as this is an authenticated user."""
        return True

    def set_password(self, raw_password):
        """Hash and set the user password."""
        self.password_hash = make_password(raw_password)

    def __str__(self):
        """Return email as string representation."""
        return self.email


class Folder(models.Model):
    """Model representing a folder in the file system tree."""

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

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        """Meta options for Folder model."""

        unique_together = ("owner", "parent", "name")
        ordering = ["name"]
        app_label = "ep_files_app"

    def __str__(self):
        """Return full path of folder."""
        return self.get_full_path()

    def get_full_path(self):
        """Return full path like /root/child/grandchild."""
        parts = []
        node = self
        while node is not None:
            parts.append(node.name)
            node = node.parent
        return "/" + "/".join(reversed(parts))

    def get_all_descendant_ids(self):
        """Return list of all descendant folder IDs recursively."""
        ids = []
        for child in self.children.all():
            ids.append(child.id)
            ids.extend(child.get_all_descendant_ids())
        return ids

    def get_total_size(self):
        """Calculate total size of all files in this folder and subfolders."""
        from django.db.models import Sum
        
        total_size = 0
        direct_files_size = self.files.aggregate(total=Sum('size'))['total'] or 0
        total_size += direct_files_size
        
        for child in self.children.all():
            total_size += child.get_total_size()
        
        return total_size


class File(models.Model):
    """Model representing an uploaded file and its metadata."""

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

    def __str__(self):
        """Return file name or default string."""
        return self.name if self.name else "Unnamed File"

    def save(self, *args, **kwargs):
        """Auto-fill size and name fields before saving."""
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

class PreviewStrategy(ABC):
    """Abstract base class for file preview strategies."""

    @abstractmethod
    def preview(self, file: bytes) -> Union[str, bytes]:
        """Generate a preview from raw file bytes."""


class TextPreview(PreviewStrategy):
    """Strategy for generating text file previews."""

    def preview(self, file: bytes) -> str:
        """Return first 20 lines of text file, HTML-escaped."""
        text = file.decode("utf-8", errors="ignore")
        lines = text.splitlines()[:20]
        return html.escape("\n".join(lines))


class ImagePreview(PreviewStrategy):
    """Strategy for generating image thumbnails."""

    def preview(self, file: bytes) -> bytes:
        """Return resized JPEG thumbnail as bytes."""
        img = Image.open(io.BytesIO(file))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.thumbnail((300, 300))
        output = io.BytesIO()
        img.save(output, format="JPEG", quality=70)
        return output.getvalue()


class PreviewFactory:
    """Factory for selecting the appropriate preview strategy."""

    _strategies = {
        "text": TextPreview(),
        "image": ImagePreview(),
    }

    @staticmethod
    def get_strategy(name: str) -> PreviewStrategy:
        """
        Определяет специализированную стратегию генерации превью на основе расширения файла.

        Метод анализирует расширение переданного имени файла и сопоставляет его
        с зарегистрированными типами стратегий (Image для графики, Text для текстовых документов).

        Args:
            name (str): Полное имя файла или путь (например, 'image.png' или 'notes.txt').

        Returns:
            PreviewStrategy: Объект стратегии, соответствующий типу контента.
                            Возвращает текстовую стратегию по умолчанию для .txt и
                            неизвестных форматов.
        """
        ext = name.split('.')[-1].lower() if '.' in name else ''

        img_extns = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']

        if ext in img_extns:
            return PreviewFactory._strategies['image']

        if ext == 'txt':
            return PreviewFactory._strategies['text']

        return PreviewFactory._strategies['text'] # измените там под исключения


class FileOperationFacade:
    """Facade for centralised file operation management."""

    @staticmethod
    def upload_file(file, user):
        """Validate and save a new file for the given user."""
        if not file:
            raise ValidationError("File not provided")
        if file.size > settings.MAX_FILE_SIZE:
            raise ValidationError("File is too large")
        file_obj = File(file=file, owner=user)
        file_obj.save()
        return file_obj

    @staticmethod
    def delete_file(file_id, user):
        """Delete a file if it belongs to the given user."""
        try:
            file_obj = File.objects.get(id=file_id, owner=user)
            file_obj.file.delete()
            file_obj.delete()
            return True
        except File.DoesNotExist:
            return False
