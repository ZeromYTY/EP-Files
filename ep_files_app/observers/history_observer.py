"""
Наблюдатель для записи истории файлов
"""
import logging
from .base import FileObserver, FileEvent
from ep_files_app.models import FileHistory, File, User

logger = logging.getLogger(__name__)


class FileHistoryObserver(FileObserver):
    """
    Наблюдатель, который записывает все события файлов в историю
    """
    
    def update(self, event: FileEvent) -> None:
        """
        Обработать событие и записать в историю
        
        Args:
            event: Событие файла
        """
        try:
            # Получаем файл (если он еще существует)
            file_instance = None
            if event.file_id:
                try:
                    file_instance = File.objects.get(id=event.file_id)
                except File.DoesNotExist:
                    # Файл удален, это нормально для события DELETE
                    pass
            
            # Получаем пользователя
            user_instance = None
            if event.user_id:
                try:
                    user_instance = User.objects.get(id=event.user_id)
                except User.DoesNotExist:
                    logger.warning(f"User {event.user_id} not found for event {event.event_type}")
            
            # Создаем запись в истории
            history_entry = FileHistory.objects.create(
                file=file_instance,
                file_name=event.file_name,
                event_type=event.event_type,
                user=user_instance,
                old_value=event.old_value,
                new_value=event.new_value,
                details=event.details,
                ip_address=event.ip_address,
            )
            
            logger.info(
                f"History recorded: {event.event_type} for file '{event.file_name}' "
                f"by user {event.user_email or 'unknown'}"
            )
            
            return history_entry
            
        except Exception as e:
            logger.error(f"Failed to record file history: {str(e)}", exc_info=True)
            # Не пробрасываем исключение, чтобы не нарушить основной процесс
