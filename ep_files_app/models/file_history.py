"""
Модель истории изменений файлов
"""
from django.db import models
from .models import User, File


class FileHistory(models.Model):
    """История изменений файлов"""
    
    # Типы событий
    EVENT_UPLOAD = 'upload'
    EVENT_DOWNLOAD = 'download'
    EVENT_RENAME = 'rename'
    EVENT_MOVE = 'move'
    EVENT_DELETE = 'delete'
    EVENT_UPDATE = 'update'
    
    EVENT_CHOICES = [
        (EVENT_UPLOAD, 'Загрузка'),
        (EVENT_DOWNLOAD, 'Скачивание'),
        (EVENT_RENAME, 'Переименование'),
        (EVENT_MOVE, 'Перемещение'),
        (EVENT_DELETE, 'Удаление'),
        (EVENT_UPDATE, 'Обновление'),
    ]
    
    # Основные поля
    file = models.ForeignKey(
        File, 
        on_delete=models.CASCADE, 
        related_name='history',
        null=True,
        blank=True,
        help_text='Файл (может быть null если файл удален)'
    )
    file_name = models.CharField(
        max_length=255,
        help_text='Имя файла на момент события'
    )
    event_type = models.CharField(
        max_length=20,
        choices=EVENT_CHOICES,
        help_text='Тип события'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='file_actions',
        help_text='Пользователь, выполнивший действие'
    )
    timestamp = models.DateTimeField(
        auto_now_add=True,
        help_text='Время события'
    )
    
    # Дополнительная информация
    old_value = models.TextField(
        blank=True,
        null=True,
        help_text='Старое значение (для переименования/перемещения)'
    )
    new_value = models.TextField(
        blank=True,
        null=True,
        help_text='Новое значение (для переименования/перемещения)'
    )
    details = models.JSONField(
        default=dict,
        blank=True,
        help_text='Дополнительные детали события'
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text='IP адрес пользователя'
    )
    
    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'История файла'
        verbose_name_plural = 'История файлов'
        indexes = [
            models.Index(fields=['file', '-timestamp']),
            models.Index(fields=['user', '-timestamp']),
            models.Index(fields=['event_type', '-timestamp']),
        ]
    
    def __str__(self):
        return f"{self.get_event_type_display()}: {self.file_name} by {self.user} at {self.timestamp}"
    
    @property
    def event_display(self):
        """Человекочитаемое описание события"""
        user_name = self.user.name or self.user.email if self.user else 'Система'
        
        if self.event_type == self.EVENT_UPLOAD:
            return f"{user_name} загрузил файл {self.file_name}"
        elif self.event_type == self.EVENT_DOWNLOAD:
            return f"{user_name} скачал файл {self.file_name}"
        elif self.event_type == self.EVENT_RENAME:
            return f"{user_name} переименовал {self.old_value} в {self.new_value}"
        elif self.event_type == self.EVENT_MOVE:
            return f"{user_name} переместил {self.file_name} из {self.old_value} в {self.new_value}"
        elif self.event_type == self.EVENT_DELETE:
            return f"{user_name} удалил файл {self.file_name}"
        elif self.event_type == self.EVENT_UPDATE:
            return f"{user_name} обновил файл {self.file_name}"
        return f"{user_name} выполнил действие с {self.file_name}"
