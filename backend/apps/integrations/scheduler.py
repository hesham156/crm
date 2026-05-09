import logging
from apscheduler.schedulers.background import BackgroundScheduler
from django_apscheduler.jobstores import DjangoJobStore
from django.utils import timezone
from .models import GoogleSheetsIntegration
from .google_sheets_service import GoogleSheetsService

logger = logging.getLogger(__name__)

def sync_active_integrations():
    """
    Job that runs periodically to sync all active integrations.
    """
    integrations = GoogleSheetsIntegration.objects.filter(is_active=True)
    service = GoogleSheetsService()
    
    for integration in integrations:
        # Check if it's time to sync based on interval
        if integration.last_sync_at:
            time_since_last_sync = (timezone.now() - integration.last_sync_at).total_seconds() / 60.0
            if time_since_last_sync < integration.sync_interval_minutes:
                continue # Not time yet
                
        logger.info(f"Starting scheduled sync for integration: {integration.name}")
        try:
            service.sync_integration(integration, triggered_by="scheduler")
        except Exception as e:
             logger.error(f"Error syncing {integration.name}: {e}")

def start_scheduler():
    scheduler = BackgroundScheduler(timezone=timezone.get_current_timezone())
    # You can use DjangoJobStore if you want to store jobs in DB, 
    # but for a simple polling, memory store is fine.
    
    # Run the sync checker every 1 minute
    scheduler.add_job(
        sync_active_integrations,
        'interval',
        minutes=1,
        id='sync_active_integrations_job',
        replace_existing=True,
    )
    
    scheduler.start()
    logger.info("APScheduler started successfully.")
