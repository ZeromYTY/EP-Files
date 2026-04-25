
"""
Модуль сервиса для работы с файлами.

Реализует три паттерна проектирования:

- **Strategy** — выбирает алгоритм обработки в зависимости от типа файла.
- **Observer** — логирует события файловой активности.
- **Facade** — предоставляет единую точку входа для логики загрузки.
"""

from ep_files_app.core import config as app_config
from ep_files_app.models.models import File


# ---------------------------------------------------------------------------
# Паттерн Strategy
# ---------------------------------------------------------------------------

class ImageProcessingStrategy:
    """Стратегия обработки изображений (JPEG, PNG).

    Имитирует генерацию миниатюр и оптимизацию изображения.
    """

    def process(self, file_obj):
        """Выполнить обработку изображения.

        Аргументы:
            file_obj: Загруженный файл с атрибутом ``name``.

        Возвращает:
            str: Сообщение о результате обработки.
        """
        return f"Оптимизация изображения {file_obj.name} (создание миниатюр) выполнена."


class DocumentProcessingStrategy:
    """Стратегия обработки документов и текстовых файлов.

    Имитирует полнотекстовую индексацию для поиска.
    """

    def process(self, file_obj):
        """Выполнить обработку документа.

        Аргументы:
            file_obj: Загруженный файл с атрибутом ``name``.

        Возвращает:
            str: Сообщение о результате обработки.
        """
        return f"Текстовый файл {file_obj.name} проиндексирован для поиска."


# ---------------------------------------------------------------------------
# Паттерн Observer
# ---------------------------------------------------------------------------

class FileActivityLogger:
    """Наблюдатель, записывающий события файловой активности в stdout.

    Подключается к :class:`FileService` для получения уведомлений
    о загрузке и удалении файлов.
    """

    def update(self, action, file_name):
        """Обработать событие файловой активности.

        Аргументы:
            action (str): Тип события, например ``"UPLOAD"`` или ``"DELETE"``.
            file_name (str): Имя файла, с которым связано событие.
        """
        print(f"[SYSTEM LOG]: Действие '{action}' с файлом '{file_name}' успешно записано.")


# ---------------------------------------------------------------------------
# Паттерн Facade
# ---------------------------------------------------------------------------

class FileService:
    """Фасад для пайплайна загрузки файлов.

    Скрывает за одним публичным методом логику валидации,
    сохранения, выбора стратегии обработки и логирования.

    Атрибуты:
        logger (FileActivityLogger): Наблюдатель для записи событий.

    Пример использования::

        service = FileService()
        file_obj, info = service.handle_upload(request.FILES["file"], request.user)
    """

    def __init__(self):
        self.logger = FileActivityLogger()

    def handle_upload(self, uploaded_file, user):
        """Проверить, сохранить и обработать загружаемый файл.

        Проверяет размер файла относительно :data:`app_config.MAX_FILE_SIZE`,
        сохраняет запись в базе данных, выбирает подходящую стратегию
        (:class:`ImageProcessingStrategy` или :class:`DocumentProcessingStrategy`)
        и уведомляет :class:`FileActivityLogger`.

        Аргументы:
            uploaded_file: Экземпляр ``InMemoryUploadedFile`` или
                ``TemporaryUploadedFile`` из Django.
            user: Авторизованный пользователь — становится владельцем файла.

        Возвращает:
            tuple[File | None, str]:
                - При успехе: ``(экземпляр File, строка с результатом обработки)``
                - При ошибке: ``(None, строка с описанием ошибки)``
        """
        if uploaded_file.size > app_config.MAX_FILE_SIZE:
            return None, "Ошибка: Превышен лимит размера файла."

        file_obj = File(file=uploaded_file, owner=user)
        file_obj.save()

        if uploaded_file.name.lower().endswith((".jpg", ".png", ".jpeg")):
            strategy = ImageProcessingStrategy()
        else:
            strategy = DocumentProcessingStrategy()

        processing_info = strategy.process(uploaded_file)
        self.logger.update("UPLOAD", uploaded_file.name)

        return file_obj, processing_info
