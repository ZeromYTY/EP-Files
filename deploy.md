# Развертывание EP Files

Актуальная подробная инструкция находится в [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

## Краткая схема

```text
Пользователь
  -> внешний Nginx :80/:443
  -> frontend Docker container :5173
      -> nginx отдаёт React build
      -> /api/, /admin/, /media/ проксируются в backend
  -> backend Docker container :8000
  -> PostgreSQL Docker container :5432
```

## Быстрый деплой на сервере

```bash
cd /root/ep-files
cp .env.production.example .env
nano .env
docker compose up -d --build
docker compose ps
```

## Обновление

```bash
cd /root/ep-files
./deploy.sh
```

## Проверка

```bash
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
curl -I http://127.0.0.1:5173
curl http://127.0.0.1:5173/api/
```

Для HTTPS, Nginx-конфига, env-переменных, администратора и отката см. [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).
