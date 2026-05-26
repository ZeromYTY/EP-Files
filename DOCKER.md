# Запуск проекта через Docker

## Быстрый старт

```bash
# 1. Скопируй файл с переменными окружения
cp .env.example .env

# 2. Запусти всё одной командой
docker-compose up --build
```

После запуска доступно:
- **Фронтенд:** http://localhost:5173
- **Бэкенд API:** http://localhost:8000/api/
- **Django Admin:** http://localhost:8000/admin/

Frontend-контейнер собирает React production build и отдаёт его через nginx. При обращении к `http://localhost:5173/api/`, `http://localhost:5173/admin/` и `http://localhost:5173/media/` nginx внутри frontend-контейнера проксирует запросы в backend.

---

## Переменные окружения

| Переменная | Описание | Пример |
|---|---|---|
| `SECRET_KEY` | Секретный ключ Django | `django-insecure-...` |
| `DEBUG` | Режим отладки | `True` / `False` |
| `JWT_SECRET_KEY` | Ключ подписи JWT-токенов | `my-secret` |
| `ACCESS_TOKEN_LIFETIME` | Время жизни токена (сек) | `3600` |
| `MAX_FILE_SIZE` | Макс. размер файла (байт) | `104857600` |
| `CORS_ALLOWED_ORIGINS` | Разрешённые origins фронта | `http://localhost:5173` |
| `POSTGRES_DB` | Имя базы данных | `epfiles` |
| `POSTGRES_USER` | Пользователь БД | `epfiles` |
| `POSTGRES_PASSWORD` | Пароль БД | `epfiles` |
| `DATABASE_URL` | Строка подключения к БД | `postgresql://...` |

---

## Полезные команды

```bash
# Запуск в фоне
docker-compose up -d

# Остановка
docker-compose down

# Остановка с удалением данных БД
docker-compose down -v

# Логи конкретного сервиса
docker-compose logs -f backend
docker-compose logs -f frontend

# Открыть shell внутри контейнера
docker-compose exec backend bash

# Создать суперпользователя вручную
docker-compose exec backend python manage.py createsuperuser
```

---

## Сервисы

| Сервис | Образ | Порт |
|---|---|---|
| `backend` | Python 3.13 + Django | 8000 |
| `frontend` | nginx + React build | 5173 |
| `db` | PostgreSQL 16 | 5432 |

---

## Хранение данных

Данные хранятся в Docker volumes и **не теряются** при перезапуске:
- `postgres_data` — база данных
- `storage_data` — загруженные пользователями файлы
