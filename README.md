# EP Files

Файлообменник — веб-приложение для загрузки, хранения и обмена файлами.

## Стек

- **Бэкенд:** Django 4.2 + Django REST Framework + JWT-аутентификация
- **Фронтенд:** React 19 + Vite + MUI
- **База данных:** PostgreSQL (SQLite для локальной разработки)
- **Инфраструктура:** Docker + Docker Compose

## Быстрый старт

### Через Docker (рекомендуется)

```bash
git clone <url-репозитория>
cd ep-files

cp .env.example .env

docker-compose up --build
```

После запуска:

| Сервис | Адрес |
|---|---|
| Фронтенд | http://localhost:5173 |
| API | http://localhost:8000/api/ |
| Django Admin | http://localhost:8000/admin/ |

### Локально без Docker

**Бэкенд:**

```bash
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # Linux/macOS

pip install -r requirements.txt

python manage.py migrate
python manage.py runserver
```

**Фронтенд** (в отдельном терминале):

```bash
cd frontend

npm install
npm run dev
```

## Переменные окружения

Скопируй `.env.example` в `.env` и заполни:

| Переменная | Описание |
|---|---|
| `SECRET_KEY` | Секретный ключ Django |
| `DEBUG` | Режим отладки (`True` / `False`) |
| `JWT_SECRET_KEY` | Ключ подписи JWT-токенов |
| `DATABASE_URL` | Строка подключения к БД |
| `CORS_ALLOWED_ORIGINS` | Разрешённые origins фронтенда |
| `MAX_FILE_SIZE` | Максимальный размер файла в байтах |

## Документация

Документация API и кода собирается через Sphinx и публикуется на GitLab Pages автоматически при merge в `master`.

Собрать локально:

```bash
cd docs
sphinx-build -b html source build/html
```

Открыть: `docs/build/html/index.html`

## CI/CD

Пайплайн запускается автоматически на merge request и ветке `dev`:

| Стадия | Что делает |
|---|---|
| `lint` | Проверка кода через pylint (порог 8.0) |
| `test` | Запуск pytest |
| `docs` | Сборка Sphinx-документации |

GitLab Pages обновляется при каждом merge в `master`.

* [Обоснование архитектурных паттернов (Observer, Strategy, Facade)](./patterns.txt)