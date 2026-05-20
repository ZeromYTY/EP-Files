"""
Модели для системы разграничения прав доступа
"""
from django.db import models
from django.core.exceptions import ValidationError
from .models import User, File, Folder


class Permission(models.Model):
    """ORM-модель Django для управления матрицей прав доступа (ACL) к файлам и папкам.

    Определяет структуру связей между получателями разрешений, инициаторами и
    целевыми объектами хранения (ресурсами). Модель регулирует тип доступа
    (чтение, запись) и флаг рекурсивного каскадного наследования. На уровне СУБД
    наложены жесткие индексы производительности и ограничения уникальности,
    исключающие дублирование записей.

    Attributes:
        READ (str): Константа уровня доступа «Только чтение».
        READ_WRITE (str): Константа уровня доступа «Чтение и запись».
        PERMISSION_CHOICES (list): Набор пар ключ-значение для валидации полей выбора.
        user (ForeignKey): Ссылка на модель ``User``, получающую привилегию доступа.
        granted_by (ForeignKey): Ссылка на модель ``User``, делегирующую привилегию.
        file (ForeignKey): Опциональная ссылка на защищаемый объект модели ``File``.
        folder (ForeignKey): Опциональная ссылка на защищаемый объект модели ``Folder``.
        permission_type (CharField): Текущий уровень разрешений (READ / READ_WRITE).
        inherit (BooleanField): Переключатель каскадного наследования прав вниз по каталогу.
        created_at (DateTimeField): Дата и время первичной регистрации правила.
        updated_at (DateTimeField): Дата и время последней модификации правила.

    Methods:
        clean(): Инкапсулирует комплексные правила валидации бизнес-логики.
        save(*args, **kwargs): Выполняет персистентное сохранение с принудительной валидацией.
    """


    READ = 'read'
    READ_WRITE = 'read_write'
    
    PERMISSION_CHOICES = [
        (READ, 'Чтение'),
        (READ_WRITE, 'Чтение и запись'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='received_permissions',
        help_text='Пользователь, получающий права доступа'
    )

    granted_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='granted_permissions',
        help_text='Пользователь, выдавший права'
    )

    file = models.ForeignKey(
        File,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='permissions',
        help_text='Файл, к которому выдаются права'
    )

    folder = models.ForeignKey(
        Folder,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='permissions',
        help_text='Папка, к которой выдаются права'
    )

    permission_type = models.CharField(
        max_length=20,
        choices=PERMISSION_CHOICES,
        default=READ,
        help_text='Тип прав доступа'
    )

    inherit = models.BooleanField(
        default=True,
        help_text='Наследовать права на вложенные файлы и папки'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Право доступа'
        verbose_name_plural = 'Права доступа'
        ordering = ['-created_at']
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
        """Выполняет комплексную проверку целостности бизнес-логики права доступа.

        Проверяет соблюдение следующих архитектурных правил:
        1. Запись строго относится либо к файлу, либо к папке (исключено double-binding).
        2. Запись не может быть пустой без указания ресурса.
        3. Пользователю запрещено выдавать права доступа самому себе.
        4. Инициатор (``granted_by``) обязан являться владельцем (``owner``) ресурса.

        Raises:
            ValidationError: Если нарушено любое из перечисленных правил валидации.
        """
        if self.file and self.folder:
            raise ValidationError('Нельзя указать одновременно файл и папку')
        
        if not self.file and not self.folder:
            raise ValidationError('Необходимо указать файл или папку')

        if self.user == self.granted_by:
            raise ValidationError('Нельзя выдать права самому себе')

        if self.file and self.file.owner != self.granted_by:
            raise ValidationError('Только владелец файла может выдавать права')
        
        if self.folder and self.folder.owner != self.granted_by:
            raise ValidationError('Только владелец папки может выдавать права')
    
    def save(self, *args, **kwargs):
        """Сохраняет запись права доступа в БД с предварительной проверкой чистоты данных.

        Принудительно вызывает метод ``clean()`` перед отправкой SQL-запроса в СУБД,
        что исключает сохранение некорректных или компрометирующих связей.
        """
        self.clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        resource = self.file.name if self.file else self.folder.name
        return f"{self.user.email} - {self.get_permission_type_display()} - {resource}"
    
    @property
    def resource_type(self):
        """Возвращает строковый маркер типа защищаемого ресурса.

        Returns:
            str: Значение ``'file'``, если право привязано к файлу,
            или ``'folder'``, если право выдано на директорию.
        """
        return 'file' if self.file else 'folder'
    
    @property
    def resource(self):
        """Возвращает непосредственный объект модели, на который наложено право.

        Returns:
            Union[File, Folder]: Экземпляр модели ``File`` или ``Folder`` в зависимости
            от заполненного внешнего ключа.
        """
        return self.file if self.file else self.folder
    
    @property
    def can_write(self):
        """Определяет, предоставляет ли текущее правило полномочия на модификацию ресурса.

        Returns:
            bool: True, если тип разрешения эквивалентен ``READ_WRITE``, иначе False.
        """
        return self.permission_type == self.READ_WRITE
    
    @property
    def can_read(self):
        """Определяет, предоставляет ли текущее правило полномочия на чтение ресурса.

        Returns:
            bool: Всегда True, так как любой тип авторизованного правила доступа
            включает в себя право на базовый просмотр.
        """
        return True
