import uuid
from django.db import models
from django.conf import settings


class GoogleSheetsIntegration(models.Model):
    """
    Stores configuration for a Google Sheets → CRM sync integration.
    Each record represents one Google Sheet linked to this system.
    """

    CONFLICT_CHOICES = [
        ("skip",   "Skip — Ignore duplicate emails"),
        ("update", "Update — Overwrite existing customer data"),
    ]

    CUSTOMER_TYPE_CHOICES = [
        ("lead",     "Lead"),
        ("prospect", "Prospect"),
        ("customer", "Customer"),
    ]

    CUSTOMER_STAGE_CHOICES = [
        ("new",         "New"),
        ("contacted",   "Contacted"),
        ("proposal",    "Proposal Sent"),
        ("negotiation", "Negotiation"),
        ("won",         "Won"),
        ("lost",        "Lost"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # ── Basic Info ──────────────────────────────────────────────────────────────
    name = models.CharField(max_length=200, help_text="A friendly label for this integration")
    spreadsheet_id = models.CharField(
        max_length=500,
        help_text="Google Sheets ID (from the URL) or the full URL"
    )
    sheet_name = models.CharField(
        max_length=200,
        default="Sheet1",
        help_text="The tab/sheet name inside the spreadsheet"
    )
    header_row = models.PositiveSmallIntegerField(
        default=1,
        help_text="Which row contains the column headers (usually 1)"
    )

    # ── Column Mapping ──────────────────────────────────────────────────────────
    # Maps CRM fields → column letter or header name in the sheet
    # Example: {"name": "A", "email": "B", "phone": "C", "company": "D"}
    column_mapping = models.JSONField(
        default=dict,
        help_text=(
            "Map CRM fields to sheet columns. "
            "Keys: name, email, phone, company, address, notes, website, type, stage. "
            "Values: column letter (A/B/C) or header name."
        )
    )

    # ── Sync Settings ───────────────────────────────────────────────────────────
    sync_interval_minutes = models.PositiveSmallIntegerField(
        default=5,
        help_text="How often (in minutes) to check the sheet for new rows"
    )
    conflict_strategy = models.CharField(
        max_length=10,
        choices=CONFLICT_CHOICES,
        default="skip",
        help_text="What to do when a customer with the same email already exists"
    )
    is_active = models.BooleanField(default=True, help_text="Enable/disable this integration")

    # ── Default Values ──────────────────────────────────────────────────────────
    # Applied when the sheet row doesn't have the field mapped
    default_customer_type = models.CharField(
        max_length=15,
        choices=CUSTOMER_TYPE_CHOICES,
        default="lead",
    )
    default_customer_stage = models.CharField(
        max_length=15,
        choices=CUSTOMER_STAGE_CHOICES,
        default="new",
    )
    default_assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sheet_integrations",
        help_text="Default user to assign imported customers to"
    )

    # ── State Tracking ──────────────────────────────────────────────────────────
    last_synced_row = models.PositiveIntegerField(
        default=0,
        help_text="Index of the last sheet row that was successfully synced"
    )
    last_sync_at = models.DateTimeField(null=True, blank=True)
    last_sync_status = models.CharField(
        max_length=20,
        choices=[("success", "Success"), ("error", "Error"), ("pending", "Pending")],
        default="pending"
    )
    last_sync_message = models.TextField(blank=True)

    # ── Meta ────────────────────────────────────────────────────────────────────
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_integrations"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Google Sheets Integration"
        verbose_name_plural = "Google Sheets Integrations"

    def __str__(self):
        return f"{self.name} ({'Active' if self.is_active else 'Inactive'})"

    def get_spreadsheet_id(self):
        """Extract pure spreadsheet ID even if a full URL was provided."""
        sid = self.spreadsheet_id.strip()
        if "/spreadsheets/d/" in sid:
            sid = sid.split("/spreadsheets/d/")[1].split("/")[0]
        return sid


class SyncLog(models.Model):
    """
    Audit log for every sync attempt (success or error).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    integration = models.ForeignKey(
        GoogleSheetsIntegration,
        on_delete=models.CASCADE,
        related_name="logs"
    )
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    rows_read = models.PositiveIntegerField(default=0)
    rows_created = models.PositiveIntegerField(default=0)
    rows_updated = models.PositiveIntegerField(default=0)
    rows_skipped = models.PositiveIntegerField(default=0)
    rows_failed = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=20,
        choices=[("success", "Success"), ("error", "Error"), ("running", "Running")],
        default="running"
    )
    error_message = models.TextField(blank=True)
    triggered_by = models.CharField(
        max_length=20,
        choices=[("scheduler", "Scheduler"), ("manual", "Manual")],
        default="scheduler"
    )

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"[{self.status}] {self.integration.name} @ {self.started_at:%Y-%m-%d %H:%M}"
