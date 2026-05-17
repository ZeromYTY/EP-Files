import os
from pathlib import Path
from datetime import timedelta

MAX_FILE_SIZE = int(os.environ.get('MAX_FILE_SIZE', 100 * 1024 * 1024))

STORAGE_PATH = Path(os.environ.get('STORAGE_PATH', Path(__file__).resolve().parent.parent.parent / 'storage'))
os.makedirs(STORAGE_PATH, exist_ok=True)

JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-super-secret-key-change-this-in-production-12345')

ACCESS_TOKEN_LIFETIME = timedelta(seconds=int(os.environ.get('ACCESS_TOKEN_LIFETIME', 3600)))
