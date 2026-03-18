from django.contrib import admin
from .models import File  # Импортируй свою модель

@admin.register(File)
class FileAdmin(admin.ModelAdmin):
    list_display = ('name', 'size', 'owner', 'date')