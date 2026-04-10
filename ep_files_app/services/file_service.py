from ep_files_app.core import config as app_config
from ep_files_app.models.models import File


class ImageProcessingStrategy:
    def process(self, file_obj):
        return f"Оптимизация изображения {file_obj.name} (создание миниатюр) выполнена."


class DocumentProcessingStrategy:
    def process(self, file_obj):
        return f"Текстовый файл {file_obj.name} проиндексирован для поиска."


class FileActivityLogger:
    def update(self, action, file_name):
        print(f"[SYSTEM LOG]: Действие '{action}' с файлом '{file_name}' успешно записано.")


class FileService:
    def __init__(self):
        self.logger = FileActivityLogger()

    def handle_upload(self, uploaded_file, user):
        """
        Главный метод-фасад для загрузки контента.
        Аналог единой кнопки 'Загрузить' в Google Drive.
        """
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