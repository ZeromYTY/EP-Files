# Как контрибьютить в EP Files

## Ветковая стратегия

```
master        — только релизы, прямые коммиты запрещены
└── dev       — основная разработка, сюда идут все MR
    └── feature/название   — новая фича
    └── fix/название       — исправление бага
```

**Правило:** любая работа ведётся в отдельной ветке от `dev`, затем через Merge Request обратно в `dev`.

## Рабочий процесс

```bash
# 1. Убедись что dev актуален
git checkout dev
git pull origin dev

# 2. Создай ветку
git checkout -b feature/название-фичи

# 3. Работай, коммить
git add .
git commit -m "feat: описание изменения"

# 4. Запушь
git push origin feature/название-фичи

# 5. Открой Merge Request в dev через GitLab
```

## Формат коммитов

Используем [Conventional Commits](https://www.conventionalcommits.org/):

| Префикс | Когда использовать |
|---|---|
| `feat:` | новая функциональность |
| `fix:` | исправление бага |
| `docs:` | изменения в документации |
| `refactor:` | рефакторинг без изменения поведения |
| `test:` | добавление или правка тестов |
| `chore:` | обновление зависимостей, конфигов |

Примеры:
```
feat: добавить превью для PDF-файлов
fix: исправить ошибку при загрузке файлов > 100MB
docs: обновить раздел быстрого старта в README
```

## CI/CD — что проверяется автоматически

При открытии Merge Request и на ветке `dev` запускается пайплайн:

**Lint** — pylint с порогом 8.0. Если упадёт — MR не принимается.

Запусти локально перед пушем:
```bash
pylint ep_files_app/ main/ --load-plugins=pylint_django \
    --django-settings-module=main.settings \
    --fail-under=8.0
```

**Tests** — pytest. Пиши тесты для новой функциональности.

Запусти локально:
```bash
pytest
```

**Docs** — Sphinx собирается на ветках `dev` и `master`. Если добавляешь новые модули — обнови docstring'и.

## Настройка окружения для разработки

```bash
git clone <url>
cd ep-files

cp .env.example .env

# Через Docker
docker-compose up --build

# Или локально
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
pip install pylint pylint-django pytest pytest-django
python manage.py migrate
python manage.py runserver
```

## Merge Request

- Название MR должно описывать что сделано, а не как
- Закрывай issue через описание: `Closes #123`
- MR без прохождения пайплайна не принимается

