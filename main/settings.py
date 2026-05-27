import os
from pathlib import Path
from django.core.exceptions import ImproperlyConfigured
from ep_files_app.core import config as app_config

BASE_DIR = Path(__file__).resolve().parent.parent

DEFAULT_DEV_SECRET_KEY = 'django-insecure-@1i!@693izgkyqoju_svjf9z00&mdu8@_6))4zmxzaw@x)8wa$'


def env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


def env_list(name, default=''):
    raw_value = os.environ.get(name, default)
    return [item.strip() for item in raw_value.split(',') if item.strip()]


DEBUG = env_bool('DEBUG', True)

SECRET_KEY = os.environ.get('SECRET_KEY', DEFAULT_DEV_SECRET_KEY)
if not DEBUG and SECRET_KEY == DEFAULT_DEV_SECRET_KEY:
    raise ImproperlyConfigured('SECRET_KEY must be set to a unique value when DEBUG=False.')

if not DEBUG and app_config.JWT_SECRET_KEY == 'your-super-secret-key-change-this-in-production-12345':
    raise ImproperlyConfigured('JWT_SECRET_KEY must be set to a unique value when DEBUG=False.')

ALLOWED_HOSTS = env_list('ALLOWED_HOSTS', 'localhost,127.0.0.1,backend')
if not DEBUG and (not ALLOWED_HOSTS or '*' in ALLOWED_HOSTS):
    raise ImproperlyConfigured('ALLOWED_HOSTS must be explicit and must not contain * when DEBUG=False.')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'ep_files_app',
    'rest_framework',
    'rest_framework_simplejwt',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'ep_files_app.middleware.security.SecurityHeadersMiddleware',
    'ep_files_app.middleware.security.RateLimitMiddleware',
    'ep_files_app.middleware.permissions.PermissionCheckMiddleware',
]

ROOT_URLCONF = 'main.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': ['ep_files_app'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'main.wsgi.application'

# --- DATABASE ---
# Если задана DATABASE_URL — используем PostgreSQL, иначе SQLite
_db_url = os.environ.get('DATABASE_URL', '')

if _db_url.startswith('postgresql://') or _db_url.startswith('postgres://'):
    # Парсим postgresql://user:password@host:port/dbname
    _url = _db_url.split('://', 1)[1]
    _user_pass, _rest = _url.split('@', 1)
    _user, _password = _user_pass.split(':', 1)
    _host_port, _dbname = _rest.split('/', 1)
    _host, _port = (_host_port.split(':', 1) if ':' in _host_port else (_host_port, '5432'))

    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': _dbname,
            'USER': _user,
            'PASSWORD': _password,
            'HOST': _host,
            'PORT': _port,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_USER_MODEL = 'ep_files_app.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# --- ФАЙЛЫ ---
DATA_UPLOAD_MAX_MEMORY_SIZE = app_config.MAX_FILE_SIZE
FILE_UPLOAD_MAX_MEMORY_SIZE = app_config.MAX_FILE_SIZE
MEDIA_ROOT = app_config.STORAGE_PATH
MEDIA_URL = '/media/'
# File upload limits
MAX_FILE_SIZE = 10 * 1024 * 1024

# --- JWT & REST FRAMEWORK ---
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'ep_files_app.api.authentication.EpFilesJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
    }
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': app_config.ACCESS_TOKEN_LIFETIME,
    'REFRESH_TOKEN_LIFETIME': app_config.REFRESH_TOKEN_LIFETIME,
    'SIGNING_KEY': app_config.JWT_SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

# --- CORS ---
if DEBUG:
    _default_cors_origins = (
        "http://localhost:3000,"
        "http://localhost:5173,"
        "http://localhost:5174,"
        "http://127.0.0.1:3000,"
        "http://127.0.0.1:5173,"
        "http://127.0.0.1:5174"
    )
    CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS', _default_cors_origins)
else:
    CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS')
    if any(origin == '*' for origin in CORS_ALLOWED_ORIGINS):
        raise ImproperlyConfigured('CORS_ALLOWED_ORIGINS must not contain * when DEBUG=False.')

CSRF_TRUSTED_ORIGINS = env_list('CSRF_TRUSTED_ORIGINS')
if DEBUG and not CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

CORS_ALLOW_CREDENTIALS = True

# --- SECURITY ---
X_FRAME_OPTIONS = 'DENY'
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = env_bool('SECURE_SSL_REDIRECT', not DEBUG)
SESSION_COOKIE_SECURE = env_bool('SESSION_COOKIE_SECURE', not DEBUG)
CSRF_COOKIE_SECURE = env_bool('CSRF_COOKIE_SECURE', not DEBUG)
CSRF_COOKIE_SAMESITE = os.environ.get('CSRF_COOKIE_SAMESITE', 'Lax')
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_SECONDS = int(os.environ.get('SECURE_HSTS_SECONDS', 31536000 if not DEBUG else 0))
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool('SECURE_HSTS_INCLUDE_SUBDOMAINS', not DEBUG)
SECURE_HSTS_PRELOAD = env_bool('SECURE_HSTS_PRELOAD', not DEBUG)

# --- JWT COOKIES ---
JWT_ACCESS_COOKIE_NAME = os.environ.get('JWT_ACCESS_COOKIE_NAME', 'ep_access_token')
JWT_REFRESH_COOKIE_NAME = os.environ.get('JWT_REFRESH_COOKIE_NAME', 'ep_refresh_token')
JWT_COOKIE_SECURE = env_bool('JWT_COOKIE_SECURE', not DEBUG)
JWT_COOKIE_SAMESITE = os.environ.get('JWT_COOKIE_SAMESITE', 'Lax')
JWT_ACCESS_COOKIE_PATH = os.environ.get('JWT_ACCESS_COOKIE_PATH', '/api/')
JWT_REFRESH_COOKIE_PATH = os.environ.get('JWT_REFRESH_COOKIE_PATH', '/api/auth/')

# --- LOGGING ---
os.makedirs(BASE_DIR / 'logs', exist_ok=True)

DEFAULT_LOG_LEVEL = 'DEBUG' if DEBUG else 'INFO'
LOG_LEVEL = os.environ.get('LOG_LEVEL', DEFAULT_LOG_LEVEL).upper()

if LOG_LEVEL not in {'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'}:
    LOG_LEVEL = DEFAULT_LOG_LEVEL

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
    'verbose': {
        '()': 'ep_files_app.logger.UserAwareFormatter',
        'format': '{levelname} {asctime} {module} user={user} {message}',
        'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': LOG_LEVEL,
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'app.log',
            'formatter': 'verbose',
        },
        'console': {
            'level': LOG_LEVEL,
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'ep_files_app': {
            'handlers': ['file', 'console'],
            'level': LOG_LEVEL,
            'propagate': False,
        },
        'django.request': {
            'handlers': ['file', 'console'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}
DEFAULT_AUTO_FIELD = "django.db.models.AutoField"
