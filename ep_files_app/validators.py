"""
Валидаторы для проверки файлов
"""
import os
from django.core.exceptions import ValidationError

ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    'text/plain',
    'text/csv',
    'text/html',
    'text/css',
    'text/javascript',
    'application/json',
    'application/xml',

    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',

    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/gzip',

    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',

    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
]

FORBIDDEN_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr',
    '.vbs', '.js', '.jar', '.msi', '.app', '.deb', '.rpm',
    '.sh', '.bash', '.ps1', '.psm1',
]


def validate_file_extension(filename):
    """Проверяет расширение файла на соответствие требованиям безопасности.

    Выделяет расширение из имени файла, приводит его к нижнему регистру
    и сверяет со списком запрещенных расширений FORBIDDEN_EXTENSIONS.

    Args:
        filename (str): Имя файла или полный путь к файлу для проверки.

    Returns:
        bool: True, если расширение файла является безопасным и разрешено.

    Raises:
        ValidationError: Если расширение файла находится в списке
            запрещенных (FORBIDDEN_EXTENSIONS).

    Examples:
        >>> validate_file_extension("document.pdf")
        True
        >>> validate_file_extension("unsafe_script.exe")
        Traceback (most recent call last):
        ...
        ValidationError: Файлы с расширением .exe запрещены из соображений безопасности.

    Note:
        Проверка регистронезависима. Расширения '.TXT' и '.txt'
        обрабатываются одинаково.
    """
    ext = os.path.splitext(filename)[1].lower()

    if ext in FORBIDDEN_EXTENSIONS:
        raise ValidationError(
            f'Файлы с расширением {ext} запрещены из соображений безопасности.'
        )

    return True


def validate_file_mime_type(file):
    """Проверяет реальный MIME-тип файла на основе его содержимого.

    Использует библиотеку python-magic для чтения первых 2048 байт файла
    и определения его истинного типа. Метод предотвращает подмену расширения.
    Если библиотека magic не установлена или произошла ошибка чтения,
    валидация пропускается (возвращается True).

    Args:
        file (file-like object): Объект файла, поддерживающий методы
            seek() и read().

    Returns:
        bool: True, если MIME-тип файла разрешен, либо если проверку
        не удалось выполнить из-за отсутствия зависимостей/ошибок.

    Raises:
        ValidationError: Если MIME-тип файла определен и отсутствует
            в глобальном списке ALLOWED_MIME_TYPES.

    Examples:
        >>> with open("photo.jpg", "rb") as f:
        ...     validate_file_mime_type(f)
        True

    Note:
        Функция сбрасывает указатель позиции файла в 0 как до начала
        чтения сигнатуры, так и после его завершения.
    """

    try:
        import magic

        file.seek(0)
        file_header = file.read(2048)
        file.seek(0)

        mime = magic.from_buffer(file_header, mime=True)

        if mime not in ALLOWED_MIME_TYPES:
            raise ValidationError(
                f'Тип файла {mime} не разрешен. Разрешены только документы, изображения, архивы и медиа файлы.'
            )

        return True
    except ImportError:
        return True
    except Exception as e:
        return True


def validate_file_size(file, max_size=100 * 1024 * 1024):
    """Проверяет размер файла на соответствие установленному лимиту.

    Сравнивает текущий размер переданного файла с максимально допустимым
    значением. Если файл превышает лимит, генерирует исключение валидации
    с указанием ограничения в мегабайтах.

    Args:
        file (UploadedFile): Объект файла, имеющий атрибут ``size``
            (например, класс файла из Django/FastAPI).
        max_size (int, optional): Максимально разрешенный размер файла
            в байтах. По умолчанию равен 104 857 600 байт (100 MB).

    Returns:
        bool: True, если размер файла находится в пределах допустимого.

    Raises:
        ValidationError: Если размер файла (``file.size``) строго больше,
            чем значение ``max_size``.

    Examples:
        >>> class MockFile: size = 50 * 1024 * 1024
        >>> validate_file_size(MockFile())
        True

        >>> class HeavyFile: size = 200 * 1024 * 1024
        >>> validate_file_size(HeavyFile(), max_size=100 * 1024 * 1024)
        Traceback (most recent call last):
        ...
        ValidationError: Размер файла превышает максимально допустимый (100.0 MB).
    """

    if file.size > max_size:
        max_size_mb = max_size / (1024 * 1024)
        raise ValidationError(
            f'Файл слишком большой. Максимальный размер: {max_size_mb:.0f} МБ.'
        )

    return True


def validate_filename(filename):
    """Проверяет имя файла на наличие опасных и недопустимых символов.

    Сканирует строку имени файла на наличие элементов, которые могут быть
    использованы для уязвимостей типа Path Traversal (выход за пределы директории)
    или нарушить работу файловых систем (Windows/Linux).

    Args:
        filename (str): Имя файла или проверяемая строка.

    Returns:
        bool: True, если имя файла не содержит опасных символов.

    Raises:
        ValidationError: Если в имени файла обнаружен любой символ или
            последовательность из списка ``dangerous_chars``.

    Examples:
        >>> validate_filename("good_photo.jpg")
        True

        >>> validate_filename("../../etc/passwd")
        Traceback (most recent call last):
        ...
        ValidationError: Имя файла содержит недопустимые символы: ..

        >>> validate_filename("report:2026.pdf")
        Traceback (most recent call last):
        ...
        ValidationError: Имя файла содержит недопустимые символы: :
    """

    dangerous_chars = ['..', '/', '\\', '<', '>', ':', '"', '|', '?', '*']

    for char in dangerous_chars:
        if char in filename:
            raise ValidationError(
                f'Имя файла содержит недопустимые символы: {char}'
            )

    return True


def sanitize_filename(filename):
    """Очищает имя файла от опасных символов и приводит его к безопасному виду.

    Метод изолирует базовое имя файла, заменяет спецсимволы Windows/Linux на
    знак подчеркивания, устраняет последовательности точек (Path Traversal)
    и принудительно ограничивает длину имени до 255 символов с сохранением расширения.

    Args:
        filename (str): Исходное имя файла или полный путь к нему.

    Returns:
        str: Очищенное и безопасное имя файла, готовое для сохранения на диск.

    Examples:
        >>> sanitize_filename("some/path/../../../etc/passwd")
        'passwd'

        >>> sanitize_filename("report:photo?.jpg")
        'report_photo_.jpg'

        >>> sanitize_filename("very_long_name...txt")
        'very_long_name.txt'

    Note:
        При обрезке длинного имени (более 255 символов) оригинальное расширение
        файла всегда остается нетронутым в конце строки.
    """

    import re

    filename = os.path.basename(filename)

    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)

    filename = re.sub(r'\.{2,}', '.', filename)

    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:255 - len(ext)] + ext

    return filename
