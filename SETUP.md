# 🚀 EP Files - Setup & Run Guide (Alpha v0.1)

Полная инструкция по запуску проекта локально.

## 📋 Требования

- **Python 3.9+**
- **Node.js 16+** + npm/yarn
- **Git**

---

## 🔧 Быстрый старт (5 минут)

### 1️⃣ Backend Setup

```bash
# Перейти в папку проекта
cd /Users/markescobar/Documents/222/ep-files

# Создать виртуальное окружение (первый раз)
python3 -m venv venv

# Активировать окружение
source venv/bin/activate

# Установить зависимости
pip install -r requirements.txt

# Применить миграции БД
python manage.py migrate

# (Опционально) Создать суперпользователя для админки
python manage.py createsuperuser

# Запустить сервер
python manage.py runserver
```

**Backend будет доступен на:** `http://localhost:8000`

### 2️⃣ Frontend Setup

Открыть **новый терминал** (не закрывая предыдущий):

```bash
# Перейти в папку frontend
cd /Users/markescobar/Documents/222/ep-files/frontend

# Установить зависимости (первый раз)
npm install

# Запустить dev server
npm run dev
```

**Frontend будет доступен на:** `http://localhost:5173`

---

## ✅ Проверка работы

### Тестирование API

```bash
# 1. Регистрация
curl -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# 2. Логин
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# 3. Проверка JWT (замените TOKEN на полученный access token)
curl -X GET http://localhost:8000/api/test-auth/ \
  -H "Authorization: Bearer TOKEN"
```

### Тестирование UI

1. Откройте `http://localhost:5173` в браузере
2. Нажмите **"Зарегистрируйтесь"** и создайте аккаунт
3. Войдите с использованием email и пароля
4. Загрузите файл (максимум 10 MB)
5. Скачайте загруженный файл

---

## 🗄️ База данных

По умолчанию используется **SQLite** (`db.sqlite3`). При первом запуске она создается автоматически после `python manage.py migrate`.

### Сброс БД (если нужно начать заново)

```bash
rm db.sqlite3
python manage.py migrate
```

---

## 📁 Структура проекта после запуска

```
ep-files/
├── venv/                    # Виртуальное окружение Python
├── db.sqlite3              # БД (создается после migrate)
├── media/                  # Загруженные файлы пользователей
│   └── files/
├── ep_files_app/           # Основное приложение Django
│   ├── api/
│   │   ├── views.py       # REST endpoints (регистрация, логин, загрузка)
│   │   ├── serializers.py # DRF сериализаторы
│   ├── models/
│   │   └── models.py      # User, File модели
│   ├── services/
│   │   └── file_service.py # Бизнес-логика (паттерны Strategy, Observer, Facade)
│   └── migrations/        # Миграции БД
├── main/
│   └── settings.py        # Конфиг Django
├── frontend/
│   ├── node_modules/      # npm зависимости (после npm install)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx         # Форма входа
│   │   │   ├── Register.jsx      # Форма регистрации
│   │   │   └── Files.jsx         # Страница с файлами
│   │   ├── App.jsx        # Маршруты
│   │   └── main.jsx       # Точка входа
│   └── package.json       # npm зависимости
└── manage.py              # Django CLI
```

---

## 🔐 Безопасность (для продакшена)

⚠️ **В альфе используются:**
- Захардкодированные SECRET_KEY
- DEBUG = True

**Перед продакшеном:**

1. Создайте `.env` файл с переменными:

```env
SECRET_KEY=your-super-secret-key-here
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DATABASE_URL=postgresql://user:password@localhost/dbname
```

2. Обновите `settings.py` для чтения из `.env`
3. Используйте PostgreSQL вместо SQLite
4. Настройте HTTPS и CORS для production URL

---

## 🐛 Частые проблемы

### ❌ "ModuleNotFoundError: No module named 'rest_framework'"

```bash
# Убедитесь, что виртуальное окружение активировано
source venv/bin/activate
pip install -r requirements.txt
```

### ❌ "CORS error" при загрузке файла

Фронтенд пытается обратиться к `http://localhost:8000`, но тот недоступен:
```bash
# Проверьте, что backend запущен:
python manage.py runserver
```

### ❌ "Port 8000 already in use"

```bash
# Используйте другой порт
python manage.py runserver 8001
# И обновите Frontend API_BASE_URL в src/pages/Login.jsx на http://localhost:8001/api
```

### ❌ "Port 5173 already in use"

```bash
cd frontend
npm run dev -- --port 5174
```

---

## 🚀 Что дальше?

### MVP фичи для следующего этапа:
- [ ] Список файлов пользователя (GET /api/files/)
- [ ] Удаление файлов
- [ ] Публичные ссылки на файлы
- [ ] Поиск по названию файла
- [ ] Загрузка нескольких файлов одновременно
- [ ] Превью изображений

### Тестирование:
- [ ] Unit тесты для сервисов
- [ ] Integration тесты для API
- [ ] E2E тесты для фронтенда

### DevOps:
- [ ] Docker контейнеризация
- [ ] CI/CD pipeline (GitLab CI)
- [ ] Deplyment на оборудование

---

## 📚 Полезные команды

```bash
# Python/Django
python manage.py shell           # Django REPL
python manage.py makemigrations  # Создать миграции
python manage.py migrate         # Применить миграции
python manage.py createsuperuser # Создать админа
python manage.py collectstatic   # Собрать статику (продакшен)

# npm/Frontend
npm run build                    # Build для продакшена
npm run lint                     # Проверка ESLint
npm run format                   # Форматирование кода
```

---

## 📞 Support

Проблемы? Проверьте:
1. [CONTRIBUTING.md](CONTRIBUTING.md) — правила работы с кодом
2. [patterns.txt](patterns.txt) — архитектура паттернов
3. Логи backend: `python manage.py runserver` вывод
4. Логи frontend: браузер DevTools (F12) → Console

**Happy coding! 🎉**
