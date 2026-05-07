# 🎯 Паттерн Observer: История изменений файлов

## 📋 Описание реализации

Реализована система истории изменений файлов с использованием паттерна **Observer** (Наблюдатель).

### Цель
Отделить логирование операций с файлами от самих операций, обеспечив централизованное и расширяемое решение.

---

## 🏗️ Архитектура

### 1. **Subject (Издатель)** - `FileEventService`

**Файл:** `ep_files_app/services/file_event_service.py`

**Роль:** Генерирует события при операциях с файлами и уведомляет всех подписчиков.

**Реализация:**
- Singleton паттерн для единой точки подписки
- Методы для генерации событий:
  - `emit_upload_event()` - загрузка файла
  - `emit_download_event()` - скачивание файла
  - `emit_rename_event()` - переименование файла
  - `emit_move_event()` - перемещение файла
  - `emit_delete_event()` - удаление файла
  - `emit_update_event()` - обновление файла

**Пример использования:**
```python
from ep_files_app.services.file_event_service import file_event_service

# Генерация события загрузки
file_event_service.emit_upload_event(
    file=file_obj,
    user=request.user,
    ip_address=request.META.get('REMOTE_ADDR'),
    details={'size': file.size}
)
```

---

### 2. **Observer (Наблюдатель)** - `FileHistoryObserver`

**Файл:** `ep_files_app/observers/history_observer.py`

**Роль:** Подписан на события и записывает их в таблицу истории.

**Реализация:**
- Автоматически подписывается при инициализации `FileEventService`
- Обрабатывает события и создает записи в `FileHistory`
- Обрабатывает ошибки без прерывания основного процесса

**Пример:**
```python
class FileHistoryObserver(FileObserver):
    def update(self, event: FileEvent) -> None:
        # Создаем запись в истории
        FileHistory.objects.create(
            file=file_instance,
            file_name=event.file_name,
            event_type=event.event_type,
            user=user_instance,
            # ...
        )
```

---

### 3. **Event (Событие)** - `FileEvent`

**Файл:** `ep_files_app/observers/base.py`

**Роль:** Структура данных для передачи информации о событии.

**Поля:**
```python
@dataclass
class FileEvent:
    event_type: str          # Тип события
    file_id: Optional[int]   # ID файла
    file_name: str           # Имя файла
    user_id: Optional[int]   # ID пользователя
    user_email: Optional[str] # Email пользователя
    timestamp: datetime      # Время события
    old_value: Optional[str] # Старое значение (для rename/move)
    new_value: Optional[str] # Новое значение (для rename/move)
    details: Dict[str, Any]  # Дополнительные детали
    ip_address: Optional[str] # IP адрес
```

---

### 4. **Model (Модель)** - `FileHistory`

**Файл:** `ep_files_app/models/file_history.py`

**Роль:** Хранит историю всех операций с файлами.

**Поля:**
- `file` - ссылка на файл (nullable для удаленных файлов)
- `file_name` - имя файла на момент события
- `event_type` - тип события (upload, download, rename, move, delete, update)
- `user` - пользователь, выполнивший действие
- `timestamp` - время события
- `old_value` / `new_value` - для переименования/перемещения
- `details` - JSON с дополнительной информацией
- `ip_address` - IP адрес пользователя

**Индексы:**
- По файлу и времени
- По пользователю и времени
- По типу события и времени

---

## 📊 Типы событий

| Событие | Код | Описание |
|---------|-----|----------|
| Загрузка | `upload` | Файл загружен на сервер |
| Скачивание | `download` | Файл скачан пользователем |
| Переименование | `rename` | Файл переименован |
| Перемещение | `move` | Файл перемещен в другую папку |
| Удаление | `delete` | Файл удален |
| Обновление | `update` | Содержимое файла обновлено |

---

## 🔌 API Endpoints

### 1. История конкретного файла
```
GET /api/files/{file_id}/history/
```

**Ответ:**
```json
{
  "file_id": 1,
  "file_name": "document.pdf",
  "history": [
    {
      "id": 5,
      "event_type": "download",
      "event_type_display": "Скачивание",
      "event_display": "user@example.com скачал файл document.pdf",
      "user_name": "John Doe",
      "user_email": "user@example.com",
      "timestamp": "2026-04-18T20:30:00Z",
      "ip_address": "192.168.1.1"
    },
    {
      "id": 1,
      "event_type": "upload",
      "event_type_display": "Загрузка",
      "event_display": "user@example.com загрузил файл document.pdf",
      "user_name": "John Doe",
      "user_email": "user@example.com",
      "timestamp": "2026-04-18T10:00:00Z",
      "details": {"size": 1024000},
      "ip_address": "192.168.1.1"
    }
  ]
}
```

### 2. Вся история активности пользователя
```
GET /api/history/
GET /api/history/?event_type=upload
GET /api/history/?days=7
GET /api/history/?limit=100
```

**Параметры:**
- `event_type` - фильтр по типу события
- `days` - показать за последние N дней
- `limit` - ограничение количества записей (по умолчанию 50)

### 3. Недавняя активность
```
GET /api/history/recent/
```

Возвращает последние 10 действий пользователя.

---

## 💡 Преимущества паттерна Observer

### ✅ Разделение ответственности
- Операции с файлами не знают о логировании
- Логирование изолировано в отдельном наблюдателе
- Легко добавить новых наблюдателей

### ✅ Расширяемость
Можно легко добавить новых наблюдателей:
```python
class EmailNotificationObserver(FileObserver):
    def update(self, event: FileEvent):
        # Отправка email при важных событиях
        if event.event_type == 'delete':
            send_email(event.user_email, f"Файл {event.file_name} удален")

# Подписываем
file_event_service.attach(EmailNotificationObserver())
```

### ✅ Надежность
- Ошибки в наблюдателях не прерывают основной процесс
- Каждый наблюдатель обрабатывается независимо

### ✅ Централизация
- Вся логика логирования в одном месте
- Единая точка для управления подписками

---

## 🔧 Интеграция в существующий код

### До (без паттерна):
```python
def upload_file(request):
    file_obj.save()
    
    # Логирование размазано по коду
    logger.info(f"File uploaded: {file_obj.name}")
    
    # Запись в историю прямо здесь
    FileHistory.objects.create(
        file=file_obj,
        event_type='upload',
        user=request.user,
        # ...
    )
```

### После (с паттерном):
```python
def upload_file(request):
    file_obj.save()
    
    # Просто генерируем событие
    file_event_service.emit_upload_event(
        file=file_obj,
        user=request.user,
        ip_address=request.META.get('REMOTE_ADDR')
    )
    
    # Наблюдатель автоматически запишет в историю
```

---

## 📈 Примеры использования

### 1. Просмотр истории файла
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/files/1/history/
```

### 2. Просмотр всех загрузок за неделю
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/history/?event_type=upload&days=7"
```

### 3. Недавняя активность
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/history/recent/
```

---

## 🎨 Диаграмма классов

```
┌─────────────────────┐
│   FileSubject       │
│  (Subject/Publisher)│
├─────────────────────┤
│ + attach(observer)  │
│ + detach(observer)  │
│ + notify(event)     │
└──────────┬──────────┘
           │
           │ наследует
           ▼
┌─────────────────────┐
│ FileEventService    │
│   (Concrete Subject)│
├─────────────────────┤
│ + emit_upload()     │
│ + emit_download()   │
│ + emit_delete()     │
│ + emit_rename()     │
│ + emit_move()       │
└──────────┬──────────┘
           │
           │ уведомляет
           ▼
┌─────────────────────┐
│   FileObserver      │
│  (Observer Interface)│
├─────────────────────┤
│ + update(event)     │
└──────────┬──────────┘
           │
           │ реализует
           ▼
┌─────────────────────┐
│FileHistoryObserver  │
│ (Concrete Observer) │
├─────────────────────┤
│ + update(event)     │
│   → создает запись  │
│      в FileHistory  │
└─────────────────────┘
```

---

## ✅ Критерии готовности

- [x] Каждое действие с файлом отражается в истории
- [x] Можно посмотреть, кто и когда что сделал с файлом
- [x] Код логирования централизован (не размазан по сервисам)
- [x] Реализован паттерн Observer
- [x] Добавлены API endpoints для просмотра истории
- [x] История сохраняется даже для удаленных файлов
- [x] Записывается IP адрес пользователя
- [x] Поддержка фильтрации и пагинации

---

## 🚀 Запуск

1. Примените миграции:
```bash
python manage.py migrate
```

2. Проверьте работу:
```bash
# Загрузите файл
curl -X POST -H "Authorization: Bearer <token>" \
  -F "file=@test.pdf" \
  http://localhost:8000/api/upload/

# Посмотрите историю
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/history/recent/
```

---

## 📚 Файлы проекта

**Модели:**
- `ep_files_app/models/file_history.py` - модель истории

**Observer Pattern:**
- `ep_files_app/observers/base.py` - базовые классы
- `ep_files_app/observers/history_observer.py` - наблюдатель истории

**Сервисы:**
- `ep_files_app/services/file_event_service.py` - издатель событий

**API:**
- `ep_files_app/api/views.py` - endpoints истории
- `ep_files_app/api/serializers.py` - сериализатор истории

**Миграции:**
- `ep_files_app/migrations/0003_filehistory.py` - создание таблицы

---

## 🎉 Готово!

Система истории файлов полностью реализована с использованием паттерна Observer!
