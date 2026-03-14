import logging


class UserAwareFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        if not hasattr(record, "user"):
            record.user = "system"
        return super().format(record)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)