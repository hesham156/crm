from django.apps import AppConfig
class DesignConfig(AppConfig):
    name = "apps.design"
    verbose_name = "Design"

    def ready(self):
        import apps.design.signals
