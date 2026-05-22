# Развёртывание EP Files

## Схема развёртывания

```
Пользователь → :80 (Nginx) → Frontend (Vite :5173)
                            → Backend (Django :8000)
                            → PostgreSQL (:5432)
```

Все сервисы запускаются в Docker-контейнерах на VPS Beget.

| Сервис | Образ | Порт |
|---|---|---|
| frontend | ep-files-frontend | 5173 |
| backend | ep-files-backend | 8000 |
| db | postgres:16-alpine | 5432 |

**Сервер:** VPS Beget, 1 ядро / 2 ГБ RAM / 15 ГБ NVMe  
**IP:** 185.225.34.127

---

## Первое развёртывание с нуля

### 1. Подключись к серверу

```bash
ssh root@185.225.34.127
```

### 2. Установи Git

```bash
apt update && apt install -y git
```

### 3. Склонируй репозиторий

```bash
git clone <url-репозитория> ep-files
cd ep-files
```

### 4. Создай и заполни .env

```bash
cp .env.example .env
nano .env
```

Обязательно заполни:

```
SECRET_KEY=замени-на-случайную-строку
JWT_SECRET_KEY=замени-на-случайную-строку
POSTGRES_PASSWORD=замени-на-надёжный-пароль
DATABASE_URL=postgresql://epfiles:твой-пароль@db:5432/epfiles
DEBUG=False
ALLOWED_HOSTS=185.225.34.127
CORS_ALLOWED_ORIGINS=http://185.225.34.127
```

### 5. Запусти проект

```bash
docker compose up -d --build
```

### 6. Проверь что всё запущено

```bash
docker ps
```

Должны быть запущены три контейнера: `ep-files-frontend-1`, `ep-files-backend-1`, `ep-files-db-1`.

---

## Обновление после изменений в репозитории

```bash
cd ep-files
git pull origin master
docker compose up -d --build
```

---

## Открыть порт 80 (для доступа по IP без порта)

Сейчас фронтенд доступен на порту 5173, бэкенд на 8000. Чтобы открыть стандартный порт 80, установи Nginx как прокси:

```bash
apt install -y nginx
```

Создай конфиг:

```bash
nano /etc/nginx/sites-available/ep-files
```

Вставь:

```nginx
server {
    listen 80;
    server_name 185.225.34.127;

    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /media/ {
        proxy_pass http://localhost:8000;
    }

    location /admin/ {
        proxy_pass http://localhost:8000;
    }
}
```

Активируй:

```bash
ln -s /etc/nginx/sites-available/ep-files /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

После этого проект доступен по `http://185.225.34.127`.

---

## Мониторинг и Healthcheck

### Просмотр логов

```bash
# Все контейнеры
docker compose logs -f

# Только бэкенд
docker compose logs -f backend

# Только фронтенд
docker compose logs -f frontend
```

### Статус контейнеров

```bash
docker ps
```

### Healthcheck — пинг API

Проверить что бэкенд отвечает:

```bash
curl http://localhost:8000/api/
```

Проверить что фронтенд отвечает:

```bash
curl -I http://localhost:5173
```

### Автоматический перезапуск

Контейнеры настроены на автозапуск при перезагрузке сервера через `restart: unless-stopped` в `docker-compose.yml`. Чтобы убедиться:

```bash
docker inspect ep-files-backend-1 | grep RestartPolicy
```

---

## Полезные команды

```bash
# Остановить всё
docker compose down

# Перезапустить один сервис
docker compose restart backend

# Войти внутрь контейнера
docker compose exec backend bash

# Создать суперпользователя
docker compose exec backend python manage.py createsuperuser

# Свободное место на диске
df -h

# Потребление ресурсов контейнерами
docker stats
```