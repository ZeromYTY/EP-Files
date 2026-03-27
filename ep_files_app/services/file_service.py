from ep_files_app.core import config as app_config
from ep_files_app.models.models import File


class FileService:
    """Service Layer: Бизнес-логика обработки файлов"""

    @staticmethod
    def validate_and_create(uploaded_file, user):
        if uploaded_file.size > app_config.MAX_FILE_SIZE:
            return None, "Размер файла превышен"

        file_obj = File(file=uploaded_file, owner=user)
        file_obj.save()
        return file_obj, None