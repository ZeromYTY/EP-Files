"""
Базовые классы для паттерна Observer
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Any, Dict
from datetime import datetime


@dataclass
class FileEvent:
    """Событие файла"""
    event_type: str  # upload, download, rename, move, delete, update
    file_id: Optional[int]
    file_name: str
    user_id: Optional[int]
    user_email: Optional[str]
    timestamp: datetime
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    details: Dict[str, Any] = None
    ip_address: Optional[str] = None
    
    def __post_init__(self):
        if self.details is None:
            self.details = {}
        if self.timestamp is None:
            self.timestamp = datetime.now()


class FileObserver(ABC):
    """Абстрактный наблюдатель за событиями файлов"""
    
    @abstractmethod
    def update(self, event: FileEvent) -> None:
        """
        Обработать событие
        
        Args:
            event: Событие файла
        """
        pass


class FileSubject:
    """Издатель событий файлов (Subject в паттерне Observer)"""
    
    def __init__(self):
        self._observers: list[FileObserver] = []
    
    def attach(self, observer: FileObserver) -> None:
        """
        Подписать наблюдателя на события
        
        Args:
            observer: Наблюдатель
        """
        if observer not in self._observers:
            self._observers.append(observer)
    
    def detach(self, observer: FileObserver) -> None:
        """
        Отписать наблюдателя от событий
        
        Args:
            observer: Наблюдатель
        """
        if observer in self._observers:
            self._observers.remove(observer)
    
    def notify(self, event: FileEvent) -> None:
        """
        Уведомить всех наблюдателей о событии
        
        Args:
            event: Событие файла
        """
        for observer in self._observers:
            try:
                observer.update(event)
            except Exception as e:
                # Логируем ошибку, но не прерываем уведомление других наблюдателей
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Error notifying observer {observer.__class__.__name__}: {str(e)}")
