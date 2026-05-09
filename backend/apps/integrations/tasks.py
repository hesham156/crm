"""
Celery tasks for the integrations app.
"""
import logging
from celery import shared_task

logger = logging.getLogger("apps")


@shared_task(name="apps.integrations.tasks.run_due_integrations", bind=True, max_retries=0)
def run_due_integrations(self):
    """
    Periodic task (every 60 s via Celery Beat).
    Finds all active GoogleSheetsIntegration configs that are due and syncs them.
    """
    from django.utils import timezone
    from .models import GoogleSheetsIntegration
    from .google_sheets_service import GoogleSheetsService

    active = GoogleSheetsIntegration.objects.filter(is_active=True)
    now = timezone.now()
    results = []

    for integration in active:
        # Check if it's time to sync
        if integration.last_sync_at:
            elapsed = (now - integration.last_sync_at).total_seconds() / 60.0
            if elapsed < integration.sync_interval_minutes:
                continue  # Not due yet

        logger.info("Celery: syncing integration '%s'", integration.name)
        try:
            service = GoogleSheetsService()
            log = service.sync_integration(integration, triggered_by="scheduler")
            results.append({
                "id": str(integration.id),
                "name": integration.name,
                "status": log.status,
                "rows_created": log.rows_created,
                "rows_updated": log.rows_updated,
            })
        except Exception as exc:
            logger.error("Integration sync error [%s]: %s", integration.name, exc)
            results.append({"id": str(integration.id), "name": integration.name, "status": "error", "error": str(exc)})

    return results


@shared_task(name="apps.integrations.tasks.run_single_integration", bind=True, max_retries=0)
def run_single_integration(self, integration_id: str):
    """On-demand sync for a specific integration."""
    from .models import GoogleSheetsIntegration
    from .google_sheets_service import GoogleSheetsService

    try:
        integration = GoogleSheetsIntegration.objects.get(id=integration_id)
    except GoogleSheetsIntegration.DoesNotExist:
        return {"status": "error", "error": "Integration not found"}

    try:
        service = GoogleSheetsService()
        log = service.sync_integration(integration, triggered_by="manual")
        return {
            "status": log.status,
            "rows_read": log.rows_read,
            "rows_created": log.rows_created,
            "rows_updated": log.rows_updated,
            "rows_skipped": log.rows_skipped,
            "rows_failed": log.rows_failed,
        }
    except Exception as exc:
        return {"status": "error", "error": str(exc)}
