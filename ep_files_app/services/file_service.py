from ep_files_app.core import config as app_config
from ep_files_app.models.models import File


# --- 1. ПАТТЕРН STRATEGY (Стратегии обработки типов файлов) ---
# Позволяет менять алгоритм обработки в зависимости от расширения файла
class ImageProcessingStrategy:
    def process(self, file_obj):
        return f"Оптимизация изображения {file_obj.name} (создание миниатюр) выполнена."


class DocumentProcessingStrategy:
    def process(self, file_obj):
        return f"Текстовый файл {file_obj.name} проиндексирован для поиска."


# --- 2. ПАТТЕРН OBSERVER (Наблюдатель за событиями) ---
# Автоматически реагирует на успешную загрузку (логирование/уведомление)
class FileActivityLogger:
    def update(self, action, file_name):
        print(f"[SYSTEM LOG]: Действие '{action}' с файлом '{file_name}' успешно записано.")


# --- 3. ПАТТЕРН FACADE (Фасад — Единая точка входа) ---
# Скрывает сложность проверки, сохранения, обработки и логирования за одним методом
class FileService:
    def __init__(self):
        self.logger = FileActivityLogger()

    def handle_upload(self, uploaded_file, user):
        """
        Главный метод-фасад для загрузки контента.
        Аналог единой кнопки 'Загрузить' в Google Drive.
        """
        if uploaded_file.size > app_config.MAX_FILE_SIZE:
            return None, "Ошибка: Превышен лимит размера файла."

        file_obj = File(file=uploaded_file, owner=user)
        file_obj.save()

        if uploaded_file.name.lower().endswith(('.jpg', '.png', '.jpeg')):
            strategy = ImageProcessingStrategy()
        else:
            strategy = DocumentProcessingStrategy()

        processing_info = strategy.process(uploaded_file)

        self.logger.update("UPLOAD", uploaded_file.name)

        return file_obj, processing_info