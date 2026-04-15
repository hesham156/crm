from django.apps import AppConfig
class SalesConfig(AppConfig):
    name = "apps.sales"
    verbose_name = "Sales"

    def ready(self):
        import apps.sales.signals
