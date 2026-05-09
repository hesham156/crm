from django.apps import AppConfig


class IntegrationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.integrations"
    verbose_name = "Integrations"

    def ready(self):
        # Start the APScheduler when Django starts (only in main process)
        import os
        if os.environ.get("RUN_MAIN") == "true" or not os.environ.get("RUN_MAIN"):
            try:
                from .scheduler import start_scheduler
                start_scheduler()
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Scheduler failed to start: {e}")
