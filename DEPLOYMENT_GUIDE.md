# EP Files Deployment Guide

Инструкция для деплоя production-версии на VPS с Docker Compose и внешним Nginx.

## 1. Подготовка сервера

```bash
ssh root@185.225.34.127
apt update
apt install -y git docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
systemctl enable --now docker
systemctl enable --now nginx
```

## 2. Получение проекта

```bash
cd /root
git clone https://gitlab.informatics.ru/2025-2026/vk/s109m/final-projects/ep-files.git
cd ep-files
git checkout master
```

Если проект уже есть на сервере:

```bash
cd /root/ep-files
git fetch origin
git checkout master
git pull --ff-only origin master
```

## 3. Настройка `.env`

```bash
cp .env.production.example .env
nano .env
```

Обязательно заменить:

- `SECRET_KEY`
- `JWT_SECRET_KEY`
- `POSTGRES_PASSWORD`
- пароль внутри `DATABASE_URL`
- `DJANGO_SUPERUSER_PASSWORD`
- домены/IP в `ALLOWED_HOSTS` и `CORS_ALLOWED_ORIGINS`, если деплой не на `ep-files.ru`

Пример важных production-значений:

```env
DEBUG=False
ALLOWED_HOSTS=ep-files.ru,www.ep-files.ru,185.225.34.127,localhost,127.0.0.1,backend
CORS_ALLOWED_ORIGINS=https://ep-files.ru,https://www.ep-files.ru
DATABASE_URL=postgresql://epfiles:<db-password>@db:5432/epfiles
```

## 4. Запуск контейнеров

```bash
docker compose up -d --build
docker compose ps
```

Что поднимается:

- `backend`: Django API на `127.0.0.1:8000`
- `frontend`: собранный React через nginx на `127.0.0.1:5173`
- `db`: PostgreSQL на `127.0.0.1:5432`

Миграции запускаются автоматически при старте backend-контейнера.

## 5. Внешний Nginx

Создать конфиг:

```bash
nano /etc/nginx/sites-available/ep-files
```

Содержимое:

```nginx
server {
    listen 80;
    server_name ep-files.ru www.ep-files.ru;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активировать:

```bash
ln -sf /etc/nginx/sites-available/ep-files /etc/nginx/sites-enabled/ep-files
nginx -t
systemctl reload nginx
```

Frontend-контейнер сам проксирует `/api/`, `/admin/` и `/media/` в backend-контейнер.

## 6. HTTPS

```bash
certbot --nginx -d ep-files.ru -d www.ep-files.ru
certbot certificates
```

После выпуска сертификата проверить:

```bash
curl -I https://ep-files.ru
curl https://ep-files.ru/api/
```

## 7. Обновление версии

На сервере:

```bash
cd /root/ep-files
./deploy.sh
```

Или вручную:

```bash
git fetch origin
git checkout master
git pull --ff-only origin master
docker compose up -d --build --remove-orphans
docker compose ps
```

## 8. Проверка после деплоя

```bash
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
curl -I http://127.0.0.1:5173
curl http://127.0.0.1:5173/api/
curl -I https://ep-files.ru
curl https://ep-files.ru/api/
```

Проверить в браузере:

- `https://ep-files.ru`
- регистрация/вход
- загрузка файла
- скачивание файла
- корзина
- личный кабинет

## 9. Администратор

Создать или обновить администратора:

```bash
docker compose exec backend python manage.py shell
```

```python
from ep_files_app.models import User

u, _ = User.objects.get_or_create(email="admin@example.com", defaults={"name": "Admin"})
u.is_staff = True
u.is_superuser = True
u.is_active = True
u.set_password("change-me")
u.save()
```

## 10. Откат

Посмотреть историю:

```bash
git log --oneline -10
```

Откатиться к конкретному commit:

```bash
git checkout <commit_hash>
docker compose up -d --build --remove-orphans
```

Вернуться обратно на `master`:

```bash
git checkout master
git pull --ff-only origin master
docker compose up -d --build --remove-orphans
```
