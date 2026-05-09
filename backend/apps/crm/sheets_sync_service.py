"""
Google Sheets → CRM sync service.
Reads a configured sheet and creates/updates Customer records.
"""
import logging
from django.utils import timezone
from utils.google_sheets import read_sheet

logger = logging.getLogger("apps")

# CRM fields that can be populated from a sheet
ALLOWED_CRM_FIELDS = {
    "name", "company", "email", "phone",
    "type", "stage", "address", "notes", "website",
}

VALID_TYPES = {"lead", "prospect", "customer"}
VALID_STAGES = {"new", "contacted", "proposal", "negotiation", "won", "lost"}


def _normalise_value(field: str, raw: str) -> str:
    """Normalise a raw cell value for a specific CRM field."""
    value = raw.strip()
    if field == "type":
        return value.lower() if value.lower() in VALID_TYPES else "lead"
    if field == "stage":
        return value.lower() if value.lower() in VALID_STAGES else "new"
    return value


def run_sync(sync_config):
    """
    Execute one GoogleSheetsSync configuration.

    Returns a dict: {"status": "success", "created": N, "updated": N, "total": N}
    Raises on fatal errors (credentials missing, sheet not found, etc.)
    — but always writes the outcome back to sync_config before raising.
    """
    from .models import Customer  # local import to avoid circular import

    try:
        headers, rows = read_sheet(
            sync_config.spreadsheet_id,
            sync_config.sheet_name,
            sync_config.header_row,
        )

        if not headers:
            raise ValueError("No headers found in the sheet. Check the sheet name and header row setting.")

        field_mapping: dict = sync_config.field_mapping  # {header_label: crm_field}
        match_field: str = sync_config.match_field or "email"

        created = 0
        updated = 0
        skipped = 0

        for row in rows:
            # Build {header: cell_value} dict, padding short rows with ""
            row_dict = {header: (row[i] if i < len(row) else "") for i, header in enumerate(headers)}

            # Map headers → CRM fields
            customer_data = {}
            for header_label, crm_field in field_mapping.items():
                if crm_field and crm_field in ALLOWED_CRM_FIELDS:
                    raw = row_dict.get(header_label, "").strip()
                    if raw:
                        customer_data[crm_field] = _normalise_value(crm_field, raw)

            if not customer_data:
                skipped += 1
                continue

            match_value = customer_data.get(match_field, "").strip()
            if not match_value:
                skipped += 1
                continue

            try:
                # Find existing record
                if match_field == "email":
                    existing = Customer.objects.filter(email__iexact=match_value).first()
                else:
                    existing = Customer.objects.filter(name__iexact=match_value).first()

                if existing:
                    changed = False
                    for field, value in customer_data.items():
                        if value and getattr(existing, field, None) != value:
                            setattr(existing, field, value)
                            changed = True
                    if changed:
                        existing.save()
                    updated += 1
                else:
                    Customer.objects.create(**customer_data)
                    created += 1

            except Exception as row_err:
                logger.warning("Sheets sync: failed to process row %s — %s", row_dict, row_err)
                skipped += 1

        total = created + updated
        message = f"Synced {total} records ({created} new, {updated} updated, {skipped} skipped)"
        _save_result(sync_config, "success", message, total)
        logger.info("Sheets sync [%s]: %s", sync_config.name, message)
        return {"status": "success", "created": created, "updated": updated, "skipped": skipped, "total": total}

    except Exception as exc:
        error_msg = str(exc)
        logger.error("Sheets sync [%s] failed: %s", sync_config.name, error_msg)
        _save_result(sync_config, "error", error_msg, sync_config.total_synced)
        raise


def _save_result(sync_config, status: str, message: str, total: int):
    """Persist sync result fields without touching other fields."""
    sync_config.last_sync_at = timezone.now()
    sync_config.last_sync_status = status
    sync_config.last_sync_message = message
    sync_config.total_synced = total
    sync_config.save(update_fields=["last_sync_at", "last_sync_status", "last_sync_message", "total_synced"])
