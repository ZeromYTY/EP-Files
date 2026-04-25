import os
from django.db import models
from django.contrib.auth.hashers import make_password


class User(models.Model):
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=128)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    def set_password(self, raw_password):
        self.password_hash = make_password(raw_password)

    def __str__(self):
        return self.email


class Folder(models.Model):
    name = models.CharField(max_length=255)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="folders")
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="children"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("owner", "parent", "name")
        ordering = ["name"]

    def __str__(self):
        return self.get_full_path()

    def get_full_path(self):
        parts = []
        node = self
        while node is not None:
            parts.append(node.name)
            node = node.parent
        return "/" + "/".join(reversed(parts))

    def get_all_descendant_ids(self):
        ids = []
        for child in self.children.all():
            ids.append(child.id)
            ids.extend(child.get_all_descendant_ids())
        return ids


class File(models.Model):
    file = models.FileField(upload_to='files')
    name = models.CharField(max_length=100, blank=True)
    size = models.BigIntegerField(editable=False, null=True, blank=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    date = models.DateTimeField(auto_now_add=True)
    folder = models.ForeignKey(
        Folder, null=True, blank=True, on_delete=models.CASCADE, related_name="files"
    )

    def __str__(self):
        return self.name if self.name else "Unnamed File"

    def save(self, *args, **kwargs):
        if self.file:
            if not self.size:
                self.size = self.file.size
            if not self.name:
                self.name = os.path.basename(self.file.name)
        super().save(*args, **kwargs)