"""
Модели для системы разграничения прав доступа
"""
from django.db import models
from django.core.exceptions import ValidationError
from .models import User, File, Folder


class Permission(models.Model):
    """
    Модель прав доступа к файлам и папкам
    """
    
    # Типы прав доступа
    READ = 'read'
    READ_WRITE = 'read_write'
    
    PERMISSION_CHOICES = [
        (READ, 'Чтение'),
        (READ_WRITE, 'Чтение и запись'),
    ]
    
    # Пользователь, которому выдаются права
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='received_permissions',
        help_text='Пользователь, получающий права доступа'
    )
    
    # Владелец ресурса (кто выдал права)
    granted_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='granted_permissions',
        help_text='Пользователь, выдавший права'
    )
    
    # Файл (если права на файл)
    file = models.ForeignKey(
        File,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='permissions',
        help_text='Файл, к которому выдаются права'
    )
    
    # Папка (если права на папку)
    folder = models.ForeignKey(
        Folder,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='permissions',
        help_text='Папка, к которой выдаются права'
    )
    
    # Уровень доступа
    permission_type = models.CharField(
        max_length=20,
        choices=PERMISSION_CHOICES,
        default=READ,
        help_text='Тип прав доступа'
    )
    
    # Наследуются ли права на вложенные элементы
    inherit = models.BooleanField(
        default=True,
        help_text='Наследовать права на вложенные файлы и папки'
    )
    
    # Метаданные
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Право доступа'
        verbose_name_plural = 'Права доступа'
        ordering = ['-created_at']
        # Уникальность: один пользователь не может иметь несколько прав на один ресурс
        unique_together = [
            ('user', 'file'),
            ('user', 'folder'),
        ]
        indexes = [
            models.Index(fields=['user', 'file']),
            models.Index(fields=['user', 'folder']),
            models.Index(fields=['file']),
            models.Index(fields=['folder']),
        ]
    
    def clean(self):
        """Валидация модели"""
        # Должен быть указан либо файл, либо папка, но не оба
        if self.file and self.folder:
            raise ValidationError('Нельзя указать одновременно файл и папку')
        
        if not self.file and not self.folder:
            raise ValidationError('Необходимо указать файл или папку')
        
        # Нельзя выдать права самому себе
        if self.user == self.granted_by:
            raise ValidationError('Нельзя выдать права самому себе')
        
        # Проверяем, что granted_by является владельцем ресурса
        if self.file and self.file.owner != self.granted_by:
            raise ValidationError('Только владелец файла может выдавать права')
        
        if self.folder and self.folder.owner != self.granted_by:
            raise ValidationError('Только владелец папки может выдавать права')
    
    def save(self, *args, **kwargs):
        """Сохранение с валидацией"""
        self.clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        resource = self.file.name if self.file else self.folder.name
        return f"{self.user.email} - {self.get_permission_type_display()} - {resource}"
    
    @property
    def resource_type(self):
        """Тип ресурса (file или folder)"""
        return 'file' if self.file else 'folder'
    
    @property
    def resource(self):
        """Получить ресурс (файл или папку)"""
        return self.file if self.file else self.folder
    
    @property
    def can_write(self):
        """Может ли пользователь записывать"""
        return self.permission_type == self.READ_WRITE
    
    @property
    def can_read(self):
        """Может ли пользователь читать (всегда True)"""
        return True
