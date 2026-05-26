"""
Модель истории изменений файлов
"""
from django.db import models
from .models import User, File


class FileHistory(models.Model):
    """ORM-модель Django для ведения журнала аудита и истории изменений файлов.

    Используется для персистентного хранения информации обо всех ключевых операциях
    над файлами (загрузка, скачивание, модификация, удаление). Модель спроектирована
    таким образом, что сохраняет исторические текстовые метаданные (например, имя файла)
    даже после безвозвратного физического удаления связанного объекта ``File`` из системы.
    Таблица оптимизирована составными индексами для быстрой фильтрации логов по файлу,
    пользователю и типу активности.

    Attributes:
        EVENT_UPLOAD (str): Константа события «Загрузка».
        EVENT_DOWNLOAD (str): Константа события «Скачивание».
        EVENT_RENAME (str): Константа события «Переименование».
        EVENT_MOVE (str): Константа события «Перемещение».
        EVENT_DELETE (str): Константа события «Удаление».
        EVENT_UPDATE (str): Константа события «Обновление».
        EVENT_CHOICES (list): Соответствие констант событий их человекочитаемым названиям.
        file (ForeignKey): Опциональная связь с моделью ``File``. При удалении файла
            поле принимает значение ``null``, сохраняя саму запись аудита.
        file_name (CharField): Имя файла на момент фиксации события. Гарантирует
            идентификацию ресурса после его удаления.
        event_type (CharField): Строковой идентификатор совершенной операции.
        user (ForeignKey): Ссылка на модель ``User``, совершившего действие. При удалении
            пользователя поле принимает значение ``null``.
        timestamp (DateTimeField): Дата и время автоматической регистрации события.
        old_value (TextField): Предыдущее состояние измененного свойства (например,
            старый путь каталога или прежнее имя файла).
        new_value (TextField): Актуальное состояние измененного свойства после операции.
        details (JSONField): Словарь для хранения произвольных дополнительных
            структурированных метаданных.
        ip_address (GenericIPAddressField): IPv4 или IPv6 адрес сетевого интерфейса клиента.

    Properties:
        event_display (str): Вычисляет текстовое человекочитаемое описание лога.
    """

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
        """Генерирует форматированное человекочитаемое описание зафиксированного события.

        Анализирует тип операции, автора действия (при отсутствии подставляет маркер
        'Система') и контекстные значения полей изменений для сборки понятной строки
        активности, предназначенной для вывода в интерфейсах истории или логах аудита.

        Returns:
            str: Строка с подробным описанием действия (например, "Иван загрузил
            файл photo.png" или "Система удалил файл report.csv").

        Examples:
            >>> history = FileHistory(event_type='upload', file_name='doc.pdf')
            >>> history.event_display
            'Система загрузил файл doc.pdf'
        """
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
