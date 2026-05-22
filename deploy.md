# Развертывание EP Files

## Текущая схема

```
Пользователь -> https://ep-files.ru
             -> Nginx :80/:443
             -> frontend Docker container :5173
             -> backend Docker container :8000
             -> PostgreSQL Docker container :5432
```

Проект развернут на VPS Beget.

| Сервис | Контейнер | Назначение |
|---|---|---|
| frontend | ep-files-frontend-1 | React/Vite интерфейс |
| backend | ep-files-backend-1 | Django API |
| db | ep-files-db-1 | PostgreSQL |

## Первое развертывание

```bash
ssh root@185.225.34.127
apt update
apt install -y git docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
git clone <url-репозитория> ep-files
cd ep-files
cp .env.example .env
nano .env
docker compose up -d --build
```

Минимальные значения `.env` для продакшена:

```env
DEBUG=False
ALLOWED_HOSTS=ep-files.ru,www.ep-files.ru,185.225.34.127,localhost,127.0.0.1,backend
CORS_ALLOWED_ORIGINS=https://ep-files.ru,https://www.ep-files.ru
SECRET_KEY=<secret>
JWT_SECRET_KEY=<secret>
POSTGRES_DB=epfiles
POSTGRES_USER=epfiles
POSTGRES_PASSWORD=<password>
DATABASE_URL=postgresql://epfiles:<password>@db:5432/epfiles
```

## Обновление версии

На сервере:

```bash
cd /root/ep-files
git pull origin master
docker compose up -d --build
```

То же самое вынесено в скрипт:

```bash
./deploy.sh
```

## Nginx и HTTPS

Nginx проксирует фронтенд и API:

```nginx
server {
    listen 80;
    server_name ep-files.ru www.ep-files.ru;

    client_max_body_size 100M;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Проверка и перезагрузка:

```bash
nginx -t
systemctl reload nginx
```

Сертификат Let's Encrypt:

```bash
certbot --nginx -d ep-files.ru -d www.ep-files.ru
certbot certificates
```

## Мониторинг и healthcheck

Проверить контейнеры:

```bash
docker ps
docker compose ps
```

Проверить API:

```bash
curl http://127.0.0.1:8000/api/
curl https://ep-files.ru/api/
```

Проверить фронтенд:

```bash
curl -I http://127.0.0.1:5173
curl -I https://ep-files.ru
```

Логи:

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

Ресурсы сервера:

```bash
df -h
docker stats
```

Контейнеры имеют `restart: unless-stopped`, поэтому автоматически поднимаются после перезапуска Docker/сервера.

## Подтверждение 48 часов работы

Для защиты нужно сохранить доказательства непрерывной работы:

- скрин `https://ep-files.ru`;
- скрин `docker ps` с uptime контейнеров;
- скрин `certbot certificates`;
- скрин логов `docker compose logs --since 48h`;
- при возможности скрин внешнего ping/uptime-мониторинга.

## Администратор

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
