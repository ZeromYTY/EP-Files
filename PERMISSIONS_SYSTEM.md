# Система разграничения прав доступа

## Обзор

Реализована полноценная система разграничения прав доступа к файлам и папкам с поддержкой:
- ✅ Двух уровней доступа (read / read-write)
- ✅ Выдачи и отзыва прав владельцем ресурса
- ✅ Наследования прав от папки к вложенным элементам
- ✅ Централизованной проверки прав на уровне middleware и сервисов
- ✅ Защиты от обхода прав через прямые URL/ID

## Архитектура

### 1. Модель Permission

**Файл:** `ep_files_app/models/permissions.py`

```python
class Permission(models.Model):
    # Типы прав
    READ = 'read'              # Только чтение
    READ_WRITE = 'read_write'  # Чтение и запись
    
    user = ForeignKey(User)           # Кому выданы права
    granted_by = ForeignKey(User)     # Кто выдал права
    file = ForeignKey(File)           # Файл (опционально)
    folder = ForeignKey(Folder)       # Папка (опционально)
    permission_type = CharField       # Тип прав
    inherit = BooleanField            # Наследовать на вложенные элементы
```

**Особенности:**
- Один ресурс (файл ИЛИ папка), но не оба
- Уникальность: один пользователь - один набор прав на ресурс
- Валидация: только владелец может выдавать права
- Нельзя выдать права самому себе

### 2. PermissionService

**Файл:** `ep_files_app/services/permission_service.py`

Централизованный сервис для проверки и управления правами:

```python
class PermissionService:
    # Проверка прав
    can_read_file(user, file) -> bool
    can_write_file(user, file) -> bool
    can_read_folder(user, folder) -> bool
    can_write_folder(user, folder) -> bool
    
    # Управление правами
    grant_permission(granted_by, user, file/folder, permission_type, inherit)
    revoke_permission(user, file/folder)
    
    # Получение информации
    get_user_permissions(user) -> List[Permission]
    get_resource_permissions(file/folder) -> List[Permission]
    get_accessible_files(user) -> List[File]
    get_accessible_folders(user) -> List[Folder]
```

**Логика проверки прав:**

1. **Владелец** всегда имеет полные права
2. **Прямые права** на ресурс проверяются первыми
3. **Наследуемые права** от родительских папок (если `inherit=True`)
4. Для записи требуется `READ_WRITE`, для чтения достаточно любых прав

### 3. PermissionCheckMiddleware

**Файл:** `ep_files_app/middleware/permissions.py`

Автоматическая проверка прав на уровне HTTP-запросов:

```python
class PermissionCheckMiddleware:
    # Проверяет права ДО выполнения view
    # Возвращает 403 если доступ запрещен
    # Логирует попытки несанкционированного доступа
```

**Защищенные URL:**
- `/api/files/{id}/download/` - требует READ
- `/api/files/{id}/` (DELETE) - требует WRITE
- `/api/files/{id}/detail/` - требует READ
- `/api/files/{id}/history/` - требует READ
- `/api/folders/{id}/rename/` - требует WRITE
- `/api/folders/{id}/move/` - требует WRITE
- `/api/folders/{id}/delete/` - требует WRITE

### 4. DRF Permissions

**Файл:** `ep_files_app/permissions.py`

Классы для использования в Django REST Framework:

```python
HasFileReadPermission    # Проверка прав на чтение файла
HasFileWritePermission   # Проверка прав на запись файла
HasFolderReadPermission  # Проверка прав на чтение папки
HasFolderWritePermission # Проверка прав на запись папки
```

## API Endpoints

### Выдача прав на файл

```http
POST /api/files/{file_id}/permissions/grant/
Authorization: Bearer {token}
Content-Type: application/json

{
  "user_email": "user@example.com",
  "permission_type": "read",  // или "read_write"
  "inherit": true
}
```

**Ответ:**
```json
{
  "message": "Права доступа выданы",
  "permission": {
    "id": 1,
    "user_email": "user@example.com",
    "permission_type": "read",
    "permission_type_display": "Чтение",
    "resource_type": "file",
    "resource_name": "document.pdf",
    "inherit": true,
    "created_at": "2026-05-07T10:00:00Z"
  }
}
```

### Выдача прав на папку

```http
POST /api/folders/{folder_id}/permissions/grant/
Authorization: Bearer {token}
Content-Type: application/json

{
  "user_email": "user@example.com",
  "permission_type": "read_write",
  "inherit": true
}
```

### Отзыв прав на файл

```http
DELETE /api/files/{file_id}/permissions/revoke/
Authorization: Bearer {token}
Content-Type: application/json

{
  "user_email": "user@example.com"
}
```

**Ответ:**
```json
{
  "message": "Права доступа отозваны"
}
```

### Отзыв прав на папку

```http
DELETE /api/folders/{folder_id}/permissions/revoke/
Authorization: Bearer {token}
Content-Type: application/json

{
  "user_email": "user@example.com"
}
```

### Просмотр прав на файл

```http
GET /api/files/{file_id}/permissions/
Authorization: Bearer {token}
```

**Ответ:**
```json
{
  "file_id": 1,
  "file_name": "document.pdf",
  "permissions": [
    {
      "id": 1,
      "user_email": "user1@example.com",
      "user_name": "User One",
      "permission_type": "read",
      "permission_type_display": "Чтение",
      "inherit": true,
      "granted_by_email": "owner@example.com",
      "created_at": "2026-05-07T10:00:00Z"
    }
  ]
}
```

### Просмотр прав на папку

```http
GET /api/folders/{folder_id}/permissions/
Authorization: Bearer {token}
```

### Мои права доступа

```http
GET /api/permissions/my/
Authorization: Bearer {token}
```

**Ответ:**
```json
{
  "count": 5,
  "permissions": [
    {
      "id": 1,
      "resource_type": "file",
      "resource_name": "document.pdf",
      "permission_type": "read",
      "granted_by_email": "owner@example.com",
      "created_at": "2026-05-07T10:00:00Z"
    }
  ]
}
```

### Доступные файлы

```http
GET /api/files/accessible/
Authorization: Bearer {token}
```

Возвращает все файлы, к которым у пользователя есть доступ (свои + с правами).

### Доступные папки

```http
GET /api/folders/accessible/
Authorization: Bearer {token}
```

Возвращает все папки, к которым у пользователя есть доступ (свои + с правами).

## Примеры использования

### Пример 1: Поделиться файлом с коллегой (только чтение)

```bash
curl -X POST http://localhost:8000/api/files/1/permissions/grant/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_email": "colleague@example.com",
    "permission_type": "read",
    "inherit": false
  }'
```

### Пример 2: Дать права на редактирование папки проекта

```bash
curl -X POST http://localhost:8000/api/folders/5/permissions/grant/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_email": "teammate@example.com",
    "permission_type": "read_write",
    "inherit": true
  }'
```

Все вложенные файлы и папки автоматически станут доступны для редактирования.

### Пример 3: Отозвать права

```bash
curl -X DELETE http://localhost:8000/api/files/1/permissions/revoke/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_email": "colleague@example.com"
  }'
```

### Пример 4: Проверка прав в коде

```python
from ep_files_app.services.permission_service import permission_service

# Проверить, может ли пользователь читать файл
if permission_service.can_read_file(user, file):
    # Разрешить доступ
    pass

# Проверить, может ли пользователь изменять файл
if permission_service.can_write_file(user, file):
    # Разрешить изменение
    pass
```

## Наследование прав

### Как работает наследование

1. **Права на папку с `inherit=True`** распространяются на:
   - Все файлы в папке
   - Все вложенные папки
   - Все файлы во вложенных папках (рекурсивно)

2. **Приоритет прав:**
   - Прямые права на ресурс > Наследуемые права
   - Владелец всегда имеет полные права

3. **Пример структуры:**
```
/Projects (owner: Alice)
  ├─ /Backend (permission: Bob - read_write, inherit=true)
  │   ├─ api.py        ← Bob может редактировать (наследование)
  │   └─ models.py     ← Bob может редактировать (наследование)
  └─ /Frontend
      └─ app.js        ← Bob НЕ может редактировать (нет прав)
```

## Безопасность

### Защита от обхода прав

1. **Middleware проверяет права ДО выполнения view**
   - Невозможно обойти через прямой URL
   - Невозможно обойти через изменение ID в запросе

2. **Двойная проверка:**
   - Middleware проверяет на уровне HTTP
   - View дополнительно проверяет владельца

3. **Логирование:**
   - Все попытки несанкционированного доступа логируются
   - Можно отслеживать подозрительную активность

### Валидация

1. **На уровне модели:**
   - Нельзя указать одновременно файл и папку
   - Нельзя выдать права самому себе
   - Только владелец может выдавать права

2. **На уровне API:**
   - Проверка существования пользователя
   - Проверка существования ресурса
   - Проверка прав текущего пользователя

## Администрирование

### Django Admin

Модель `Permission` зарегистрирована в админке:

- **Список:** пользователь, ресурс, тип прав, кто выдал
- **Фильтры:** по типу прав, наследованию, дате
- **Поиск:** по email пользователей
- **Группировка:** по дате создания

### Мониторинг

Проверить права пользователя:
```python
from ep_files_app.services.permission_service import permission_service

# Все права пользователя
permissions = permission_service.get_user_permissions(user)

# Все файлы с доступом
files = permission_service.get_accessible_files(user)
```

## Производительность

### Оптимизация

1. **Индексы в БД:**
   - `(user, file)` - быстрый поиск прав на файл
   - `(user, folder)` - быстрый поиск прав на папку
   - `(file)` - быстрый поиск всех прав на файл
   - `(folder)` - быстрый поиск всех прав на папку

2. **Select Related:**
   - Используется `select_related` для уменьшения запросов
   - Предзагрузка связанных объектов

3. **Кэширование:**
   - Можно добавить кэширование проверок прав
   - Инвалидация при изменении прав

## Критерии готовности

✅ **Пользователь без прав не может читать/редактировать чужие файлы**
- Middleware блокирует доступ на уровне HTTP
- Возвращается 403 Forbidden

✅ **При смене прав в базе фактический доступ меняется сразу**
- Нет кэширования прав по умолчанию
- Проверка происходит при каждом запросе

✅ **Нет возможности обойти права через прямые URL/ID**
- Middleware проверяет все защищенные endpoints
- Двойная проверка в views
- Логирование попыток несанкционированного доступа

## Дальнейшее развитие

### Возможные улучшения

1. **Групповые права:**
   - Создание групп пользователей
   - Выдача прав группе

2. **Временные права:**
   - Права с датой истечения
   - Автоматический отзыв по расписанию

3. **Расширенные права:**
   - Право на удаление
   - Право на выдачу прав другим
   - Право на просмотр истории

4. **Уведомления:**
   - Email при выдаче прав
   - Уведомления об отзыве прав

5. **Аудит:**
   - История изменения прав
   - Отчеты по правам доступа

## Troubleshooting

### Проблема: Пользователь не может получить доступ к файлу

**Решение:**
1. Проверьте права в админке
2. Проверьте наследование от родительских папок
3. Проверьте логи middleware

### Проблема: Права не наследуются

**Решение:**
1. Убедитесь, что `inherit=True`
2. Проверьте структуру папок
3. Проверьте, что файл находится в папке

### Проблема: Владелец не может выдать права

**Решение:**
1. Убедитесь, что пользователь - владелец ресурса
2. Проверьте, что целевой пользователь существует
3. Проверьте, что не пытаетесь выдать права самому себе

## Заключение

Система разграничения прав доступа полностью реализована и готова к использованию. Все требования выполнены:

- ✅ Сущность прав доступа (read / read-write)
- ✅ Выдача/отзыв прав владельцем
- ✅ Наследование прав от папки
- ✅ Централизованная проверка (middleware + сервис)
- ✅ Защита от обхода через URL/ID
- ✅ Немедленное применение изменений прав
