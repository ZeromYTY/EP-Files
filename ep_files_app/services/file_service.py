"""Сервисная логика обработки и загрузки файлов."""
from ep_files_app.core import config as app_config
from ep_files_app.models.models import File


class ImageProcessingStrategy:
    """Стратегия обработки изображений."""

    def process(self, file_obj):
        """Обрабатывает изображение (создание миниатюр)."""
        return f"Оптимизация изображения {file_obj.name} (создание миниатюр) выполнена."


class DocumentProcessingStrategy:
    """Стратегия обработки документов."""

    def process(self, file_obj):
        """Индексирует текстовый файл для поиска."""
        return f"Текстовый файл {file_obj.name} проиндексирован для поиска."


class FileActivityLogger:
    """Логгер активности файлов."""

    def update(self, action, file_name):
        """Записывает действие с файлом в лог."""
        print(f"[SYSTEM LOG]: Действие '{action}' с файлом '{file_name}' успешно записано.")


class FileService:
    """Сервис обработки и загрузки файлов."""

    def __init__(self):
        """Инициализирует сервис с логгером активности."""
        self.logger = FileActivityLogger()

    def handle_upload(self, uploaded_file, user):
        """Обрабатывает загрузку файла пользователем."""
        if user is None:
            return None, "Ошибка: пользователь не авторизован."

        if uploaded_file is None:
            return None, "Ошибка: файл не передан."

        if uploaded_file.size > app_config.MAX_FILE_SIZE:
            return None, "Ошибка: Превышен лимит размера файла."

        try:
            file_obj = File(file=uploaded_file, owner=user)
            file_obj.save()
        except Exception:
            return None, "Ошибка: не удалось сохранить файл."

        if uploaded_file.name.lower().endswith((".jpg", ".png", ".jpeg")):
            strategy = ImageProcessingStrategy()
        else:
            strategy = DocumentProcessingStrategy()

        processing_info = strategy.process(uploaded_file)
        self.logger.update("UPLOAD", uploaded_file.name)

        return file_obj, processing_info
