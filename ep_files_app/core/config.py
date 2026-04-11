import os
from pathlib import Path
from datetime import timedelta

# Лимиты и пути
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
STORAGE_PATH = Path(__file__).resolve().parent.parent.parent / 'storage'

# Создаем папку хранилища
os.makedirs(STORAGE_PATH, exist_ok=True)

# --- Настройки безопасности (для JWT) ---
JWT_SECRET_KEY = 'your-super-secret-key-change-this-in-production-12345'
ACCESS_TOKEN_LIFETIME = timedelta(minutes=60) # Токен живет час