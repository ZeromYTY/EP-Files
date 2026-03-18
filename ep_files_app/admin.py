from django.contrib import admin
from .models import File  # Импортируй свою модель

@admin.register(File)
class FileAdmin(admin.ModelAdmin):
    exclude = ('owner', 'name', 'size')

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.owner = request.user
        super().save_model(request, obj, form, change)