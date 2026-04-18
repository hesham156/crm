"""
ProSticker ERP — Django Settings
"""
import os
from datetime import timedelta
from pathlib import Path

from decouple import config, Csv

# Build paths
BASE_DIR = Path(__file__).resolve().parent.parent

# ─── Security ─────────────────────────────────────────────────────────────────
SECRET_KEY = config("DJANGO_SECRET_KEY", default="dev-secret-key-change-in-production")
DEBUG = config("DJANGO_DEBUG", default=True, cast=bool)
ALLOWED_HOSTS = config("DJANGO_ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())

# ─── Application Definition ───────────────────────────────────────────────────
DJANGO_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "channels",
    "storages",
]

LOCAL_APPS = [
    "apps.accounts",
    "apps.tasks",
    "apps.crm",
    "apps.sales",
    "apps.design",
    "apps.production",
    "apps.inventory",
    "apps.notifications",
    "apps.audit",
    "apps.analytics",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ─── Middleware ────────────────────────────────────────────────────────────────
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.audit.middleware.AuditLogMiddleware",
]

ROOT_URLCONF = "config.urls"
AUTH_USER_MODEL = "accounts.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ─── Templates ────────────────────────────────────────────────────────────────
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ─── ASGI / WSGI ──────────────────────────────────────────────────────────────
ASGI_APPLICATION = "config.asgi.application"
WSGI_APPLICATION = "config.wsgi.application"

# ─── Database ─────────────────────────────────────────────────────────────────
import dj_database_url

DATABASES = {
    "default": dj_database_url.config(
        default=config(
            "DATABASE_URL",
            default="postgresql://prosticker:prosticker_dev_pass@localhost:5432/prosticker_dev",
        )
    )
}

# ─── Cache / Channels ─────────────────────────────────────────────────────────
REDIS_URL = config("REDIS_URL", default="redis://localhost:6379/0")
USE_REDIS = config("USE_REDIS", default=False, cast=bool)

if USE_REDIS:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
        }
    }
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [REDIS_URL],
            },
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "unique-snowflake",
        }
    }
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }

# ─── Storage ──────────────────────────────────────────────────────────────────
# Always define local media paths as a safe fallback
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

USE_MINIO = config("AWS_S3_ENDPOINT_URL", default=None) is not None

if USE_MINIO:
    try:
        DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
        AWS_ACCESS_KEY_ID = config("AWS_ACCESS_KEY_ID")
        AWS_SECRET_ACCESS_KEY = config("AWS_SECRET_ACCESS_KEY")
        AWS_STORAGE_BUCKET_NAME = config("AWS_STORAGE_BUCKET_NAME", default="prosticker-files")
        AWS_S3_ENDPOINT_URL = config("AWS_S3_ENDPOINT_URL")
        AWS_S3_USE_SSL = config("AWS_S3_USE_SSL", default=False, cast=bool)
        # AWS_S3_CUSTOM_DOMAIN = "files.wafarle.com/prosticker-files"
        # This makes public file URLs use http://files.wafarle.com/prosticker-files/<path>
        AWS_S3_CUSTOM_DOMAIN = config("AWS_S3_CUSTOM_DOMAIN", default=None)
        AWS_S3_URL_PROTOCOL = config("AWS_S3_URL_PROTOCOL", default="http")
        AWS_DEFAULT_ACL = "public-read"
        AWS_S3_SIGNATURE_VERSION = "s3v4"
        AWS_QUERYSTRING_AUTH = False
        AWS_S3_OBJECT_PARAMETERS = {"CacheControl": "max-age=86400"}
    except Exception as e:
        import warnings
        warnings.warn(f"MinIO/S3 storage configuration failed, falling back to local storage: {e}")
        USE_MINIO = False

# ─── Static Files ─────────────────────────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# Only include STATICFILES_DIRS if the dir actually exists (avoids check errors)
_static_dir = BASE_DIR / "static"
if _static_dir.exists():
    STATICFILES_DIRS = [_static_dir]

# ─── Auth & JWT ───────────────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    # 🔒 Rate limiting: 10 login attempts/min, 1000 API calls/day per user
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon":  "100/day",
        "user":  "10000/day",
        "login": "10/min",    # ← used by LoginThrottle in accounts/views.py
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=config("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", default=60, cast=int)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=config("JWT_REFRESH_TOKEN_LIFETIME_DAYS", default=7, cast=int)
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# ─── CORS ─────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:3000,http://127.0.0.1:3000,http://files.wafarle.com,http://prosticker.wafarle.com",
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True

# ─── Email (SendGrid) ─────────────────────────────────────────────────────────
SENDGRID_API_KEY = config("SENDGRID_API_KEY", default="")
if SENDGRID_API_KEY:
    EMAIL_BACKEND = "sendgrid_backend.SendgridBackend"
    SENDGRID_SANDBOX_MODE_IN_DEBUG = False
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="noreply@prosticker.com")
# ─── WhatsApp (Kapso CLI) ──────────────────────────────────────────────────────
KAPSO_API_KEY  = config("KAPSO_API_KEY",  default="")
KAPSO_PHONE_ID = config("KAPSO_PHONE_ID", default="")
# Configurable template name — override in .env to avoid hardcoding
WHATSAPP_TEMPLATE_NAME = config("WHATSAPP_TEMPLATE_NAME", default="test2")
# ─── Internationalization ─────────────────────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Riyadh"
USE_I18N = True
USE_TZ = True

# ─── Logging ──────────────────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {"format": "{levelname} {asctime} {module} {message}", "style": "{"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "apps": {"handlers": ["console"], "level": "DEBUG", "propagate": False},
    },
}

# ─── Google Drive ─────────────────────────────────────────────────────────────
GOOGLE_DRIVE_CREDENTIALS_PATH = os.path.join(BASE_DIR, config("GOOGLE_DRIVE_CREDENTIALS_PATH", default="credentials.json"))
GOOGLE_DRIVE_ROOT_FOLDER_ID = config("GOOGLE_DRIVE_ROOT_FOLDER_ID", default=None)


