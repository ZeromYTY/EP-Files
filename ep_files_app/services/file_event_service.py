"""
Сервис для генерации событий файлов (Subject в паттерне Observer)
"""
from datetime import datetime
from typing import Optional, Dict, Any
from ep_files_app.observers import FileEvent, FileSubject, FileHistoryObserver
from ep_files_app.models import File, User


class FileEventService(FileSubject):
    """
    Сервис для генерации и распространения событий файлов
    Singleton для обеспечения единой точки подписки
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        super().__init__()
        
        # Автоматически подписываем наблюдателя истории
        self.attach(FileHistoryObserver())
        
        self._initialized = True
    
    def emit_upload_event(
        self,
        file: File,
        user: User,
        ip_address: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Генерировать событие загрузки файла"""
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
        """Генерировать событие скачивания файла"""
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
        """Генерировать событие переименования файла"""
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
        """Генерировать событие перемещения файла"""
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
        """Генерировать событие удаления файла"""
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
        """Генерировать событие обновления файла"""
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


# Глобальный экземпляр сервиса
file_event_service = FileEventService()
