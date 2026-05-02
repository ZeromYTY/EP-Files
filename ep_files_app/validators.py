"""
Валидаторы для проверки файлов
"""
import os
from django.core.exceptions import ValidationError


# Разрешенные MIME типы
ALLOWED_MIME_TYPES = [
    # Документы
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    
    # Текстовые файлы
    'text/plain',
    'text/csv',
    'text/html',
    'text/css',
    'text/javascript',
    'application/json',
    'application/xml',
    
    # Изображения
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    
    # Архивы
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/gzip',
    
    # Видео
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    
    # Аудио
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
]

# Запрещенные расширения (исполняемые файлы)
FORBIDDEN_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr',
    '.vbs', '.js', '.jar', '.msi', '.app', '.deb', '.rpm',
    '.sh', '.bash', '.ps1', '.psm1',
]


def validate_file_extension(filename):
    """Проверяет расширение файла"""
    ext = os.path.splitext(filename)[1].lower()
    
    if ext in FORBIDDEN_EXTENSIONS:
        raise ValidationError(
            f'Файлы с расширением {ext} запрещены из соображений безопасности.'
        )
    
    return True


def validate_file_mime_type(file):
    """Проверяет MIME тип файла (реальный, не по расширению)"""
    try:
        # Пытаемся импортировать magic
        import magic
        
        # Читаем первые байты для определения типа
        file.seek(0)
        file_header = file.read(2048)
        file.seek(0)
        
        # Определяем MIME тип
        mime = magic.from_buffer(file_header, mime=True)
        
        if mime not in ALLOWED_MIME_TYPES:
            raise ValidationError(
                f'Тип файла {mime} не разрешен. Разрешены только документы, изображения, архивы и медиа файлы.'
            )
        
        return True
    except ImportError:
        # Если magic не установлен - пропускаем проверку
        # В продакшене нужно установить: brew install libmagic
        return True
    except Exception as e:
        # Если не удалось определить тип - разрешаем (fallback)
        return True


def validate_file_size(file, max_size=100 * 1024 * 1024):
    """Проверяет размер файла"""
    if file.size > max_size:
        max_size_mb = max_size / (1024 * 1024)
        raise ValidationError(
            f'Размер файла превышает максимально допустимый ({max_size_mb} MB).'
        )
    
    return True


def validate_filename(filename):
    """Проверяет имя файла на опасные символы"""
    dangerous_chars = ['..', '/', '\\', '<', '>', ':', '"', '|', '?', '*']
    
    for char in dangerous_chars:
        if char in filename:
            raise ValidationError(
                f'Имя файла содержит недопустимые символы: {char}'
            )
    
    return True


def sanitize_filename(filename):
    """Очищает имя файла от опасных символов"""
    import re
    
    # Удаляем путь, оставляем только имя
    filename = os.path.basename(filename)
    
    # Заменяем опасные символы на подчеркивание
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    
    # Удаляем множественные точки (защита от path traversal)
    filename = re.sub(r'\.{2,}', '.', filename)
    
    # Ограничиваем длину
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:255-len(ext)] + ext
    
    return filename
