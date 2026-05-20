"""
Наблюдатель для записи истории файлов
"""
import logging
from .base import FileObserver, FileEvent
from ep_files_app.models import FileHistory, File, User

logger = logging.getLogger(__name__)


class FileHistoryObserver(FileObserver):
    """Компонент-наблюдатель для персистентного сохранения истории операций с файлами в БД.

    Реализует паттерн «Наблюдатель» (Observer). Подписывается на шину событий
    и автоматически реагирует на любые изменения, фиксируя действия пользователей
    (загрузка, скачивание, удаление, перемещение) в таблице аудита системы.

    Methods:
        update(event): Принимает объект события, восстанавливает связи с моделями
            и создает новую запись в таблице FileHistory.
    """
    
    def update(self, event: FileEvent) -> None:
        """Обрабатывает входящее файловое событие и логирует его в базу данных.

        Метод осуществляет безопасный поиск связанных сущностей (файл, пользователь)
        по их идентификаторам. Если файл был удален (актуально для события 'delete'),
        связь пропускается, а метаданные сохраняются в виде текстовых полей. Любые
        внутренние ошибки перехватываются, предотвращая сбой основной бизнес-логики.

        Args:
            event (FileEvent): Переданный объект события, содержащий полные
                метаданные операции, включая IP-адрес и детализированный контекст.

        Returns:
            FileHistory | None: Созданный экземпляр модели лога истории в случае
            успеха, или ``None``, если при выполнении операции произошла ошибка.

        Note:
            Исключения при записи лога намеренно подавляются (с выводом в системный
            лог ошибок через ``logger.error``), чтобы сбой подсистемы аудита
            не блокировал работу пользователя с файлами.
        """
        try:
            file_instance = None
            if event.file_id:
                try:
                    file_instance = File.objects.get(id=event.file_id)
                except File.DoesNotExist:
                    pass

            user_instance = None
            if event.user_id:
                try:
                    user_instance = User.objects.get(id=event.user_id)
                except User.DoesNotExist:
                    logger.warning(f"User {event.user_id} not found for event {event.event_type}")

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
