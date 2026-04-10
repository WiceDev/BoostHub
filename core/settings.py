from pathlib import Path
from decouple import config
import dj_database_url
BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1,priveboost.com,www.priveboost.com,.ngrok-free.app,.ngrok-free.dev').split(',')

# Applications
DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]
THIRD_PARTY_APPS = [
    'rest_framework',
    'corsheaders',
]
LOCAL_APPS = [
    'core',
    'users',
    'wallet',
    'orders',
    'services',
    'api_integrations',
    'dashboard',
    'notifications',
    'tickets',
]
INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'core.middleware.IPBanMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'core.middleware.RateLimitMiddleware',  # after auth so user-keyed limits work
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'core.middleware.RequestSanitizationMiddleware',
    'core.middleware.SecurityHeadersMiddleware',
]
ROOT_URLCONF = 'core.urls'
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates', BASE_DIR / 'frontend' / 'dist'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]
WSGI_APPLICATION = 'core.wsgi.application'

# Database — prefer DATABASE_URL (Railway/Heroku style), fall back to individual vars
_DATABASE_URL = config('DATABASE_URL', default=None)
if _DATABASE_URL:
    DATABASES = {'default': dj_database_url.parse(_DATABASE_URL, conn_max_age=600)}
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': config('DATABASE_NAME'),
            'USER': config('DATABASE_USER'),
            'PASSWORD': config('DATABASE_PASSWORD'),
            'HOST': config('DATABASE_HOST', default='localhost'),
            'PORT': config('DATABASE_PORT', default='5432'),
            'CONN_MAX_AGE': 600,  # reuse DB connections for 10 min (avoids reconnect overhead)
        }
    }
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Lagos'
USE_I18N = True
USE_TZ = True
STATIC_URL = '/static/'
_static_dir = BASE_DIR / 'static'
STATICFILES_DIRS = [d for d in [_static_dir, BASE_DIR / 'frontend' / 'dist'] if d.exists()]
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
# These are unused now (React SPA handles auth routing) but kept for Django admin
LOGIN_URL = '/admin/login/'
LOGIN_REDIRECT_URL = '/admin/'
LOGOUT_REDIRECT_URL = '/admin/login/'
REDIS_URL = config('REDIS_URL', default='redis://localhost:6379/0')

# Cache — Redis backend (shared across workers; used for rate limiting & IP ban checks)
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'IGNORE_EXCEPTIONS': True,  # fail open if Redis is briefly unavailable
            'SOCKET_CONNECT_TIMEOUT': 2,
            'SOCKET_TIMEOUT': 2,
        },
        'KEY_PREFIX': 'wice',
    }
}

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_BEAT_SCHEDULE = {
    'check-boosting-orders': {
        'task': 'check_boosting_orders',
        'schedule': 300,  # every 5 minutes
    },
    'check-sms-orders': {
        'task': 'check_sms_orders',
        'schedule': 60,  # every minute (SMS is time-sensitive)
    },
    'sync-boosting-services': {
        'task': 'sync_boosting_services',
        'schedule': 600,  # every 10 minutes
    },
    'sync-sms-services': {
        'task': 'sync_sms_services',
        'schedule': 3000,  # every 50 minutes
    },
}
# Email — Zoho Mail SMTP (falls back to console in dev)
EMAIL_BACKEND = config('EMAIL_BACKEND', default='django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = config('EMAIL_HOST', default='smtppro.zoho.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='help@priveboost.com')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='PriveBoost <help@priveboost.com>')
CONTACT_FORM_EMAIL = config('CONTACT_FORM_EMAIL', default='priveboost@gmail.com')
KORAPAY_SECRET_KEY = config('KORAPAY_SECRET_KEY', default='')
KORAPAY_PUBLIC_KEY = config('KORAPAY_PUBLIC_KEY', default='')
KORAPAY_ENCRYPTION_KEY = config('KORAPAY_ENCRYPTION_KEY', default='')
REAL_SIMPLE_SOCIAL_API_KEY = config('REAL_SIMPLE_SOCIAL_API_KEY', default='')
SMS_POOL_API_KEY = config('SMS_POOL_API_KEY', default='')
RECAPTCHA_SECRET_KEY = config('RECAPTCHA_SECRET_KEY', default='')
PLATFORM_NAME = 'PriveBoost'
FRONTEND_URL = config('FRONTEND_URL', default='https://www.priveboost.com')
PLATFORM_CURRENCY = 'NGN'
PLATFORM_WHATSAPP = config('PLATFORM_WHATSAPP', default='+2348000000000')
AUTH_USER_MODEL = 'users.User'
CSRF_TRUSTED_ORIGINS = [
    'http://localhost:8080',
    'http://localhost:8082',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8082',
    'https://priveboost.com',
    'https://www.priveboost.com',
    'https://*.ngrok-free.app',
    'https://*.ngrok-free.dev',
] + [o for o in config('EXTRA_TRUSTED_ORIGINS', default='').split(',') if o]

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

# CORS (allow production domain + React dev server + ngrok tunnels)
CORS_ALLOWED_ORIGINS = [
    'https://priveboost.com',
    'https://www.priveboost.com',
    'http://localhost:8080',
    'http://localhost:8082',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8082',
]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r'^https://[\w-]+\.ngrok-free\.app$',
    r'^https://[\w-]+\.ngrok-free\.dev$',
    r'^https://[\w-]+\.ngrok\.io$',
]
CORS_ALLOW_CREDENTIALS = True

# CSRF settings for SPA
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SAMESITE = 'Lax'

# Session settings
SESSION_COOKIE_AGE = 7 * 24 * 60 * 60          # 1 week
SESSION_EXPIRE_AT_BROWSER_CLOSE = False         # persist across browser restarts

# ── Security headers (enforced in production only) ────────────────────────────
if not DEBUG:
    # HSTS — tell browsers to only use HTTPS for 1 year, include subdomains
    SECURE_HSTS_SECONDS = 31536000               # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

    # Secure cookies (HTTPS enforced at reverse-proxy/Nginx level, not here —
    # SECURE_SSL_REDIRECT breaks internal healthchecks that hit HTTP directly)
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True