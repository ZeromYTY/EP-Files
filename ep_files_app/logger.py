"""Logging helpers for EP Files."""

import logging


class UserAwareFormatter(logging.Formatter):
    """Класс форматирования логов с поддержкой идентификации пользователей.

    Автоматически обогащает записи логирования (LogRecord) атрибутом пользователя,
    если он не был передан явно при вызове логгера, что позволяет стандартизировать
    вывод системных и пользовательских событий.

    Methods:
        format(record): Модифицирует запись лога, добавляя имя пользователя,
            и выполняет стандартное форматирование.
    """
    def format(self, record: logging.LogRecord) -> str:
        """Форматирует запись лога, гарантируя наличие атрибута пользователя.

                Проверяет наличие атрибута ``user`` в объекте записи. Если атрибут
                отсутствует, устанавливает для него строковое значение "system".

                Args:
                    record (logging.LogRecord): Объект записи лога, содержащий
                        метаданные события.

                Returns:
                    str: Строка лога, отформатированная в соответствии с заданным
                    шаблоном (классом родителя).

                Examples:
                    >>> import logging
                    >>> record = logging.LogRecord("test", logging.INFO, "", 0, "Msg", (), None)
                    >>> formatter = UserAwareFormatter("%(user)s: %(message)s")
                    >>> formatter.format(record)
                    'system: Msg'
                """
        if not hasattr(record, "user"):
            record.user = "system"
        return super().format(record)


def get_logger(name: str) -> logging.Logger:
    """Инициализирует и возвращает экземпляр логгера с заданным именем.

        Является оберткой над стандартным методом ``logging.getLogger``. Помогает
        инкапсулировать получение логгера для последующей настройки уровней
        и обработчиков (handlers) в рамках архитектуры приложения.

        Args:
            name (str): Имя логгера, обычно передается как ``__name__`` текущего модуля.

        Returns:
            logging.Logger: Настроенный объект логгера для записи системных событий.

        Examples:
            >>> logger = get_logger("app.services")
            >>> isinstance(logger, logging.Logger)
            True
        """
    return logging.getLogger(name)