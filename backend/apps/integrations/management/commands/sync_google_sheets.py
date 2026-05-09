from django.core.management.base import BaseCommand
from apps.integrations.models import GoogleSheetsIntegration
from apps.integrations.google_sheets_service import GoogleSheetsService

class Command(BaseCommand):
    help = 'Manually triggers sync for all active Google Sheets integrations'

    def handle(self, *args, **options):
        integrations = GoogleSheetsIntegration.objects.filter(is_active=True)
        if not integrations.exists():
            self.stdout.write(self.style.WARNING('No active integrations found.'))
            return

        service = GoogleSheetsService()
        for integration in integrations:
            self.stdout.write(f"Syncing integration: {integration.name}...")
            try:
                log = service.sync_integration(integration, triggered_by="manual")
                if log.status == "success":
                    self.stdout.write(self.style.SUCCESS(
                        f"Success: {log.rows_created} created, {log.rows_updated} updated, "
                        f"{log.rows_skipped} skipped, {log.rows_failed} failed."
                    ))
                else:
                    self.stdout.write(self.style.ERROR(f"Error: {log.error_message}"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Failed to sync {integration.name}: {str(e)}"))
