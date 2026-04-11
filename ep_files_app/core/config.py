import os
from pathlib import Path
from datetime import timedelta

# Лимиты и пути
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
STORAGE_PATH = Path(__file__).resolve().parent.parent.parent / 'storage'

# Создаем папку хранилища
os.makedirs(STORAGE_PATH, exist_ok=True)

# --- Настройки безопасности (для JWT) ---
JWT_SECRET_KEY = 'super-secret-key-12345'
ACCESS_TOKEN_LIFETIME = timedelta(minutes=60) # Токен живет час