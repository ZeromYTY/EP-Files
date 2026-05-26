"""
Сервис для генерации событий файлов (Subject в паттерне Observer)
"""
from datetime import datetime
from typing import Optional, Dict, Any
from ep_files_app.observers import FileEvent, FileSubject, FileHistoryObserver
from ep_files_app.models import File, User


class FileEventService(FileSubject):
    """Централизованный сервис генерации и диспетчеризации событий файловой активности.

    Реализует паттерн «Одиночка» (Singleton) для обеспечения единой точки управления
    подписками наблюдателей во всем приложении. Наследуется от ``FileSubject`` и выступает
    в роли издателя. При инициализации автоматически регистрирует базового слушателя
    ``FileHistoryObserver`` для сохранения истории операций в БД.

    Attributes:
        _instance (FileEventService): Статическая ссылка на единственный экземпляр класса.

    Methods:
        emit_upload_event(...): Формирует и рассылает событие загрузки файла.
        emit_download_event(...): Формирует и рассылает событие скачивания файла.
        emit_rename_event(...): Формирует и рассылает событие изменения имени файла.
        emit_move_event(...): Формирует и рассылает событие изменения директории файла.
        emit_delete_event(...): Формирует и рассылает событие удаления файла из системы.
        emit_update_event(...): Формирует и рассылает событие изменения содержимого файла.
    """

    _instance = None

    def __new__(cls):
        """Гарантирует существование строго одного экземпляра сервиса в системе."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        """Инициализирует шину событий и подписывает стандартных наблюдателей истории."""
        if self._initialized:
            return

        super().__init__()

        self.attach(FileHistoryObserver())

        self._initialized = True

    def emit_upload_event(
        self,
        file: File,
        user: User,
        ip_address: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Формирует и отправляет событие об успешной загрузке нового файла.

        Создает объект ``FileEvent`` с типом 'upload', заполняет метаданные
        и передает его всем зарегистрированным подписчикам через метод ``notify()``.

        Args:
            file (File): Экземпляр загруженного файла.
            user (User): Автор загрузки, совершивший действие.
            ip_address (str, optional): Сетевой IP-адрес клиента, инициировавшего запрос.
            details (dict, optional): Дополнительный структурированный контекст события.
        """
        event = FileEvent(
            event_type='upload',
            file_id=file.id,
            file_name=file.name,
            user_id=user.id,
            user_email=user.email,
            timestamp=datetime.now(),
            details=details or {},
            ip_address=ip_address,
        )
        self.notify(event)

    def emit_download_event(
        self,
        file: File,
        user: User,
        ip_address: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Формирует и отправляет событие о скачивании файла пользователем.

        Создает объект ``FileEvent`` с типом 'download', собирает идентификаторы
        и запускает механизм оповещения наблюдателей аудита.

        Args:
            file (File): Скачиваемый файл.
            user (User): Пользователь, запросивший скачивание.
            ip_address (str, optional): Сетевой IP-адрес клиента.
            details (dict, optional): Дополнительные параметры или метаданные запроса.
        """
        event = FileEvent(
            event_type='download',
            file_id=file.id,
            file_name=file.name,
            user_id=user.id,
            user_email=user.email,
            timestamp=datetime.now(),
            details=details or {},
            ip_address=ip_address,
        )
        self.notify(event)

    def emit_rename_event(
        self,
        file: File,
        old_name: str,
        new_name: str,
        user: User,
        ip_address: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Формирует и отправляет событие об изменении имени файла.

        Создает объект ``FileEvent`` с типом 'rename'. Записывает старое
        и новое наименования в специализированные поля лога ``old_value`` и ``new_value``.

        Args:
            file (File): Переименованный файл.
            old_name (str): Исходное имя файла до внесения изменений.
            new_name (str): Новое имя файла после успешного переименования.
            user (User): Пользователь, выполнивший операцию.
            ip_address (str, optional): Сетевой IP-адрес клиента.
            details (dict, optional): Дополнительные метаданные.
        """
        event = FileEvent(
            event_type='rename',
            file_id=file.id,
            file_name=new_name,
            user_id=user.id,
            user_email=user.email,
            timestamp=datetime.now(),
            old_value=old_name,
            new_value=new_name,
            details=details or {},
            ip_address=ip_address,
        )
        self.notify(event)

    def emit_move_event(
        self,
        file: File,
        old_path: str,
        new_path: str,
        user: User,
        ip_address: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Формирует и отправляет событие о перемещении файла в другую папку.

        Создает объект ``FileEvent`` с типом 'move'. Фиксирует траекторию изменения
        пути файловой структуры через свойства ``old_value`` и ``new_value``.

        Args:
            file (File): Перемещенный объект файла.
            old_path (str): Исходный путь расположения или ID старой родительской папки.
            new_path (str): Целевой путь расположения или ID новой родительской папки.
            user (User): Пользователь, инициировавший перемещение.
            ip_address (str, optional): Сетевой IP-адрес клиента.
            details (dict, optional): Дополнительные метаданные транзакции.
        """
        event = FileEvent(
            event_type='move',
            file_id=file.id,
            file_name=file.name,
            user_id=user.id,
            user_email=user.email,
            timestamp=datetime.now(),
            old_value=old_path,
            new_value=new_path,
            details=details or {},
            ip_address=ip_address,
        )
        self.notify(event)

    def emit_delete_event(
        self,
        file_id: int,
        file_name: str,
        user: User,
        ip_address: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Формирует и отправляет событие о безвозвратном удалении файла из системы.

        Создает объект ``FileEvent`` с типом 'delete'. В отличие от других методов,
        принимает примитивы (id и имя) напрямую, так как сам объект модели ``File``
        на момент логирования уже стерт из базы данных.

        Args:
            file_id (int): Первичный ключ удаленного файла.
            file_name (str): Последнее сохраненное имя удаленного файла.
            user (User): Пользователь, который удалил файл.
            ip_address (str, optional): Сетевой IP-адрес клиента.
            details (dict, optional): Дополнительные метаданные.
        """
        event = FileEvent(
            event_type='delete',
            file_id=file_id,
            file_name=file_name,
            user_id=user.id,
            user_email=user.email,
            timestamp=datetime.now(),
            details=details or {},
            ip_address=ip_address,
        )
        self.notify(event)

    def emit_update_event(
        self,
        file: File,
        user: User,
        ip_address: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Формирует и отправляет событие о модификации содержимого (метаданных) файла.

        Создает объект ``FileEvent`` с типом 'update' для отслеживания перезаписи
        бинарного содержимого файла или изменения его ключевых внутренних параметров.

        Args:
            file (File): Обновленный экземпляр файла.
            user (User): Пользователь, применивший изменения.
            ip_address (str, optional): Сетевой IP-адрес клиента.
            details (dict, optional): Детализированный отчет об измененных атрибутах.
        """
        event = FileEvent(
            event_type='update',
            file_id=file.id,
            file_name=file.name,
            user_id=user.id,
            user_email=user.email,
            timestamp=datetime.now(),
            details=details or {},
            ip_address=ip_address,
        )
        self.notify(event)


file_event_service = FileEventService()
