# 🔒 Безопасность проекта EP-Files

## Реализованные меры безопасности

### 1. Аутентификация и авторизация

#### JWT Токены
- Access Token: живет 60 минут
- Refresh Token: живет 7 дней
- Ротация токенов при обновлении
- Blacklist для использованных токенов

#### Права доступа
- Только владелец может скачивать/удалять свои файлы
- Проверка прав на каждый запрос
- Кастомные permission классы

### 2. Валидация файлов

#### Проверка расширений
Запрещены исполняемые файлы:
- .exe, .bat, .cmd, .com, .pif, .scr
- .vbs, .js, .jar, .msi, .app
- .sh, .bash, .ps1, .deb, .rpm

#### Проверка MIME типов
Разрешены только:
- Документы (PDF, Word, Excel, PowerPoint)
- Изображения (JPEG, PNG, GIF, WebP, SVG)
- Архивы (ZIP, RAR, 7z, GZIP)
- Текстовые файлы (TXT, CSV, JSON, XML)
- Медиа (MP4, MP3, WAV)

#### Проверка размера
- Максимальный размер файла: 100 MB
- Лимит хранилища на пользователя: 100 MB
- Проверка на клиенте и сервере

#### Санитизация имен файлов
- Удаление опасных символов
- Защита от path traversal атак
- Ограничение длины имени (255 символов)

### 3. Защита от атак

#### Rate Limiting
- Анонимные пользователи: 100 запросов/час
- Авторизованные: 1000 запросов/час
- Кастомный middleware для DDoS защиты

#### Security Headers
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Content-Security-Policy
- Referrer-Policy

#### CORS
- Разрешены только localhost домены
- Credentials: true
- Защита от CSRF атак

### 4. Логирование

#### Отслеживаемые события
- Загрузка файлов
- Скачивание файлов
- Удаление файлов
- Попытки несанкционированного доступа
- Превышение rate limit

#### Формат логов
```
INFO 2026-04-18 15:30:00 views File uploaded: document.pdf by user@example.com
WARNING 2026-04-18 15:31:00 views Unauthorized download attempt: file 123 by hacker@evil.com
```

### 5. Защита данных

#### Пароли
- Хеширование с помощью Django hashers
- Минимальная длина: 6 символов
- Валидация при регистрации

#### База данных
- SQLite для разработки
- Кастомная модель User
- Связь файлов с владельцами (ForeignKey)

### 6. Изоляция пользователей

#### Принцип наименьших привилегий
- Пользователь видит только свои файлы
- Нет доступа к файлам других пользователей
- Проверка owner на каждый запрос

#### API Endpoints с защитой
```
GET /api/files/ - только свои файлы
POST /api/upload/ - требует авторизации
DELETE /api/files/<id>/ - только владелец
GET /api/download/<id>/ - только владелец
```

## Известные ограничения

### Для разработки (НЕ для продакшена!)

1. **DEBUG = True** - отключить в продакшене
2. **SECRET_KEY** - изменить на случайный
3. **HTTPS** - включить SSL редирект
4. **База данных** - использовать PostgreSQL
5. **Rate limiting** - использовать Redis
6. **Файловое хранилище** - использовать S3/MinIO

## Рекомендации для продакшена

### 1. Настройки Django
```python
DEBUG = False
SECRET_KEY = os.environ.get('SECRET_KEY')
ALLOWED_HOSTS = ['yourdomain.com']
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
```

### 2. База данных
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST'),
        'PORT': '5432',
    }
}
```

### 3. Файловое хранилище
```python
# Использовать S3 или MinIO
DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME')
```

### 4. Переменные окружения
Создать `.env` файл:
```
SECRET_KEY=your-super-secret-key-here
DB_NAME=ep_files_db
DB_USER=ep_files_user
DB_PASSWORD=strong-password-here
JWT_SECRET_KEY=another-secret-key
```

### 5. HTTPS
- Использовать Let's Encrypt для SSL сертификатов
- Настроить Nginx как reverse proxy
- Включить HTTP/2

### 6. Мониторинг
- Sentry для отслеживания ошибок
- Prometheus + Grafana для метрик
- ELK Stack для логов

## Проверка безопасности

### Чеклист перед деплоем

- [ ] DEBUG = False
- [ ] Изменен SECRET_KEY
- [ ] Настроен HTTPS
- [ ] Настроена база данных (не SQLite)
- [ ] Настроено файловое хранилище (не локальное)
- [ ] Включены все security headers
- [ ] Настроен rate limiting с Redis
- [ ] Настроено логирование
- [ ] Настроен мониторинг
- [ ] Проведен security audit
- [ ] Настроены бэкапы

### Инструменты для проверки

1. **OWASP ZAP** - сканирование уязвимостей
2. **Bandit** - анализ Python кода
3. **Safety** - проверка зависимостей
4. **Django Check** - встроенная проверка

```bash
# Проверка Django
python manage.py check --deploy

# Проверка зависимостей
pip install safety
safety check

# Анализ кода
pip install bandit
bandit -r ep_files_app/
```

## Контакты

При обнаружении уязвимостей:
- Не публикуйте информацию публично
- Сообщите разработчикам напрямую
- Дайте время на исправление (90 дней)

## Обновления безопасности

Регулярно обновляйте зависимости:
```bash
pip list --outdated
pip install --upgrade django djangorestframework
```

## Лицензия

Этот документ является частью проекта EP-Files и распространяется под той же лицензией.
