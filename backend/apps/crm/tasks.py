"""
Celery tasks for CRM app.
"""
import logging
from celery import shared_task

logger = logging.getLogger("apps")


@shared_task(name="apps.crm.tasks.run_due_sheets_syncs", bind=True, max_retries=0)
def run_due_sheets_syncs(self):
    """
    Periodic task (runs every 60 s via Celery Beat).
    Finds all enabled GoogleSheetsSync configs that are due and runs them.
    """
    from .models import GoogleSheetsSync
    from .sheets_sync_service import run_sync

    due_syncs = [s for s in GoogleSheetsSync.objects.filter(is_enabled=True) if s.is_due()]
    logger.info("Sheets sync beat: %d configs due out of %d enabled", len(due_syncs), GoogleSheetsSync.objects.filter(is_enabled=True).count())

    results = []
    for sync in due_syncs:
        try:
            result = run_sync(sync)
            results.append({"id": str(sync.id), "name": sync.name, **result})
        except Exception as exc:
            results.append({"id": str(sync.id), "name": sync.name, "status": "error", "error": str(exc)})

    return results


@shared_task(name="apps.crm.tasks.run_single_sheets_sync", bind=True, max_retries=0)
def run_single_sheets_sync(self, sync_id: str):
    """
    On-demand task: run a specific sync config by UUID.
    Called from the "Run Now" API endpoint.
    """
    from .models import GoogleSheetsSync
    from .sheets_sync_service import run_sync

    try:
        sync = GoogleSheetsSync.objects.get(id=sync_id)
    except GoogleSheetsSync.DoesNotExist:
        return {"status": "error", "error": "Sync config not found"}

    try:
        return run_sync(sync)
    except Exception as exc:
        return {"status": "error", "error": str(exc)}
