from django.db import models
from django.contrib.auth.models import User
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
                self.name = self.file.name
        super().save(*args, **kwargs)
