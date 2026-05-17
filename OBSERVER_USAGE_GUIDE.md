# Руководство по использованию Observer Pattern

## Быстрый старт

Observer pattern уже интегрирован в систему и работает автоматически. Никаких дополнительных действий не требуется!

## Как это работает

### Автоматическое логирование

Все операции с файлами автоматически записываются в историю:

```python
# В вашем коде просто вызывайте обычные операции
file_obj.save()  # История создается автоматически!
```

### Генерация событий вручную

Если нужно создать событие вручную:

```python
from ep_files_app.services.file_event_service import file_event_service

# Событие загрузки
file_event_service.emit_upload_event(
    file=file_obj,
    user=request.user,
    ip_address=request.META.get('REMOTE_ADDR'),
    details={'size': file_obj.size}
)

# Событие скачивания
file_event_service.emit_download_event(
    file=file_obj,
    user=request.user,
    ip_address=request.META.get('REMOTE_ADDR')
)

# Событие переименования
file_event_service.emit_rename_event(
    file=file_obj,
    old_name='old.txt',
    new_name='new.txt',
    user=request.user,
    ip_address=request.META.get('REMOTE_ADDR')
)

# Событие перемещения
file_event_service.emit_move_event(
    file=file_obj,
    old_path='/folder1',
    new_path='/folder2',
    user=request.user,
    ip_address=request.META.get('REMOTE_ADDR')
)

# Событие удаления
file_event_service.emit_delete_event(
    file_id=file_obj.id,
    file_name=file_obj.name,
    user=request.user,
    ip_address=request.META.get('REMOTE_ADDR')
)

# Событие обновления
file_event_service.emit_update_event(
    file=file_obj,
    user=request.user,
    ip_address=request.META.get('REMOTE_ADDR'),
    details={'changes': 'content updated'}
)
```

## API Endpoints

### 1. История конкретного файла

```bash
GET /api/files/{file_id}/history/
```

**Ответ:**
```json
{
  "file_id": 1,
  "file_name": "document.pdf",
  "history": [
    {
      "id": 1,
      "event_type": "upload",
      "event_type_display": "Загрузка",
      "event_display": "John Doe загрузил файл document.pdf",
      "user_name": "John Doe",
      "user_email": "john@example.com",
      "timestamp": "2026-05-07T10:30:00Z",
      "ip_address": "192.168.1.100",
      "details": {"size": 1024}
    }
  ]
}
```

### 2. Вся история пользователя

```bash
GET /api/history/
GET /api/history/?event_type=upload
GET /api/history/?days=7
GET /api/history/?limit=20
```

**Параметры:**
- `event_type` - фильтр по типу события (upload, download, rename, move, delete, update)
- `days` - показать события за последние N дней
- `limit` - максимальное количество записей (по умолчанию 50)

**Ответ:**
```json
{
  "count": 10,
  "history": [...]
}
```

### 3. Недавняя активность

```bash
GET /api/history/recent/
```

Возвращает последние 10 действий пользователя.

## Добавление нового наблюдателя

Если нужно добавить дополнительную логику (например, отправку email):

```python
# ep_files_app/observers/email_observer.py
from .base import FileObserver, FileEvent
import logging

logger = logging.getLogger(__name__)

class EmailNotificationObserver(FileObserver):
    """Отправляет email уведомления о событиях"""
    
    def update(self, event: FileEvent) -> None:
        try:
            if event.event_type == 'delete':
                # Отправить email о удалении
                send_email(
                    to=event.user_email,
                    subject=f'Файл {event.file_name} удален',
                    body=f'Ваш файл был удален в {event.timestamp}'
                )
                logger.info(f"Email sent to {event.user_email}")
        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}")
```

Затем подписать наблюдателя:

```python
# ep_files_app/services/file_event_service.py
from ep_files_app.observers import EmailNotificationObserver

class FileEventService(FileSubject):
    def __init__(self):
        if self._initialized:
            return
        
        super().__init__()
        
        # Подписываем наблюдателей
        self.attach(FileHistoryObserver())
        self.attach(EmailNotificationObserver())  # Новый наблюдатель!
        
        self._initialized = True
```

## Просмотр истории в админке

1. Перейдите в админку Django: `/admin/`
2. Откройте раздел "История файлов"
3. Используйте фильтры для поиска:
   - По типу события
   - По дате
   - По пользователю
   - По имени файла

## Примеры использования

### Пример 1: Аудит безопасности

```python
from ep_files_app.models import FileHistory
from datetime import timedelta
from django.utils import timezone

# Найти все удаления за последние 24 часа
yesterday = timezone.now() - timedelta(days=1)
deletions = FileHistory.objects.filter(
    event_type='delete',
    timestamp__gte=yesterday
)

for deletion in deletions:
    print(f"{deletion.user.email} удалил {deletion.file_name} с IP {deletion.ip_address}")
```

### Пример 2: Статистика активности

```python
from django.db.models import Count

# Топ-10 самых активных пользователей
top_users = FileHistory.objects.values('user__email').annotate(
    actions=Count('id')
).order_by('-actions')[:10]

for user in top_users:
    print(f"{user['user__email']}: {user['actions']} действий")
```

### Пример 3: Отслеживание подозрительной активности

```python
# Найти пользователей, которые скачали более 100 файлов за день
from django.db.models import Count

suspicious = FileHistory.objects.filter(
    event_type='download',
    timestamp__date=timezone.now().date()
).values('user__email').annotate(
    downloads=Count('id')
).filter(downloads__gt=100)
```

## Производительность

### Индексы

Для быстрого поиска созданы индексы:
- `(file, -timestamp)` - история конкретного файла
- `(user, -timestamp)` - история пользователя
- `(event_type, -timestamp)` - фильтрация по типу события

### Рекомендации

1. **Архивирование**: Периодически архивируйте старые записи (старше 1 года)
2. **Пагинация**: Используйте параметр `limit` для больших запросов
3. **Кэширование**: Кэшируйте часто запрашиваемые данные

## Troubleshooting

### Проблема: События не записываются

**Решение:**
1. Проверьте, что миграции применены: `python manage.py migrate`
2. Проверьте логи: `tail -f logs/app.log`
3. Убедитесь, что FileEventService инициализирован

### Проблема: Медленные запросы

**Решение:**
1. Используйте `select_related('user', 'file')` для оптимизации
2. Добавьте пагинацию
3. Используйте фильтры для уменьшения выборки

### Проблема: Слишком много записей

**Решение:**
```python
# Удалить записи старше 1 года
from datetime import timedelta
from django.utils import timezone

old_date = timezone.now() - timedelta(days=365)
FileHistory.objects.filter(timestamp__lt=old_date).delete()
```

## Дополнительная информация

- Полная документация: `OBSERVER_PATTERN.md`
- Отчет о тестировании: `OBSERVER_PATTERN_TEST_REPORT.md`
- Исходный код: `ep_files_app/observers/`
