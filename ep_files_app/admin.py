from django.contrib import admin
from .models.models import File
from .models.file_history import FileHistory
from .models.permissions import Permission


@admin.register(File)
class FileAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'size', 'owner')
    exclude = ('owner', 'name', 'size')

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.owner = request.user
        super().save_model(request, obj, form, change)


@admin.register(FileHistory)
class FileHistoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'file_name', 'event_type', 'user', 'timestamp', 'ip_address')
    list_filter = ('event_type', 'timestamp')
    search_fields = ('file_name', 'user__email', 'user__name')
    readonly_fields = ('file', 'file_name', 'event_type', 'user', 'timestamp', 
                      'old_value', 'new_value', 'details', 'ip_address')
    date_hierarchy = 'timestamp'
    
    def has_add_permission(self, request):
        # История создается автоматически, запрещаем ручное добавление
        return False
    
    def has_change_permission(self, request, obj=None):
        # История не должна изменяться
        return False


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'resource_display', 'permission_type', 'inherit', 'granted_by', 'created_at')
    list_filter = ('permission_type', 'inherit', 'created_at')
    search_fields = ('user__email', 'user__name', 'granted_by__email', 'granted_by__name')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Основная информация', {
            'fields': ('user', 'granted_by', 'permission_type', 'inherit')
        }),
        ('Ресурс', {
            'fields': ('file', 'folder')
        }),
        ('Метаданные', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def resource_display(self, obj):
        """Отображение ресурса"""
        if obj.file:
            return f"Файл: {obj.file.name}"
        elif obj.folder:
            return f"Папка: {obj.folder.name}"
        return "-"
    resource_display.short_description = 'Ресурс'