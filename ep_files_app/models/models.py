import os
from django.db import models
from django.contrib.auth.hashers import make_password


class User(models.Model):
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=128)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def set_password(self, raw_password):
        """Хеширует пароль перед сохранением."""
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
        return self.name if self.name else "Unnamed File"

    def save(self, *args, **kwargs):
        if self.file:
            if not self.size:
                self.size = self.file.size
            if not self.name:
                self.name = os.path.basename(self.file.name)
        super().save(*args, **kwargs)