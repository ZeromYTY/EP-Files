from django.contrib import admin
from .models.models import File
from .models.file_history import FileHistory


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