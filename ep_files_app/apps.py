"""Конфигурация Django-приложения EP-Files."""
from django.apps import AppConfig


class EpFilesAppConfig(AppConfig):
    """Класс конфигурации Django-приложения для управления файлами.

    Инициализирует и настраивает подсистему работы с файлами (ep_files_app),
    регистрируя её в общей экосистеме проекта Django. Отвечает за метаданные
    приложения и выполнение кода инициализации при старте сервера.

    Attributes:
        name (str): Полный путь к пакету приложения в проекте Python.
    """
    name = 'ep_files_app'
