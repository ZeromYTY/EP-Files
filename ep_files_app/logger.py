"""Logging helpers for EP Files."""

import logging


class UserAwareFormatter(logging.Formatter):
    """Formatter that adds a default user field to log records."""

    def __init__(self, *args, **kwargs):
        log_format = kwargs.pop("format", None)
        if log_format is not None and "fmt" not in kwargs:
            kwargs["fmt"] = log_format
        super().__init__(*args, **kwargs)

    def format(self, record: logging.LogRecord) -> str:
        """Add user field when logger call does not provide it."""
        if not hasattr(record, "user"):
            record.user = "system"
        return super().format(record)


def get_logger(name: str) -> logging.Logger:
    """Return logger by name."""
    return logging.getLogger(name)