# config package
# Make Celery app available when Django starts (needed for @shared_task)
from .celery import app as celery_app  # noqa: F401

__all__ = ("celery_app",)
