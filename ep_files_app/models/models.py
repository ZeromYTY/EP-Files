import mimetypes
import os

from django.db import models
from django.contrib.auth.models import User

from abc import ABC, abstractmethod
import html

from PIL import Image
import io


# Create your models here.

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


class PreviewStrategy(ABC):
    @abstractmethod
    def preview(self, file: bytes) -> str | bytes:
        pass


class TextPreview(PreviewStrategy):
    def preview(self, file: bytes) -> str:
        text = file.decode("utf-8", errors="ignore")

        lines = text.split()[:20]
        preview = "\n".join(lines)

        return html.escape(preview)


class ImagePreview(PreviewStrategy):
    def preview(self, file: bytes) -> bytes:
        img = Image.open(io.BytesIO(file))

        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        img.thumbnail((300, 300))

        output = io.BytesIO()
        img.save(output, format="JPEG", quality=70)
        return output.getvalue()


class PreviewFactory:
    _strategies = {
        'text': TextPreview(),
        'image': ImagePreview()
    }

    @staticmethod
    def get_strategy(name: str) -> PreviewStrategy:
        ext = name.split('.')[-1].lower() if '.' in name else ''

        img_extns = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']

        if ext in img_extns:
            return PreviewFactory._strategies['image']
        return PreviewFactory._strategies['text']
