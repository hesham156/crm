import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class Customer(models.Model):
    TYPE_CHOICES = [
        ("lead", "Lead"),
        ("prospect", "Prospect"),
        ("customer", "Customer"),
    ]
    STAGE_CHOICES = [
        ("new", "New"),
        ("contacted", "Contacted"),
        ("proposal", "Proposal Sent"),
        ("negotiation", "Negotiation"),
        ("won", "Won"),
        ("lost", "Lost"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    company = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    type = models.CharField(max_length=15, choices=TYPE_CHOICES, default="lead")
    stage = models.CharField(max_length=15, choices=STAGE_CHOICES, default="new")
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    website = models.URLField(blank=True)
    drive_folder_id = models.CharField(max_length=255, blank=True, null=True)
    drive_folder_url = models.URLField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.company})"

    class Meta:
        ordering = ["-created_at"]


class GoogleSheetsSync(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("success", "Success"),
        ("error", "Error"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, help_text="Friendly name for this sync configuration")
    spreadsheet_id = models.CharField(max_length=300, help_text="Google Sheets spreadsheet ID (from URL)")
    sheet_name = models.CharField(max_length=200, default="Sheet1", help_text="Tab/sheet name within the spreadsheet")
    header_row = models.PositiveIntegerField(default=1, help_text="Row number that contains headers (1-indexed)")
    sync_interval_minutes = models.PositiveIntegerField(default=60, help_text="How often to sync (in minutes)")
    is_enabled = models.BooleanField(default=True)
    field_mapping = models.JSONField(
        default=dict,
        help_text='Maps sheet column header to CRM field. e.g. {"Name": "name", "Email": "email"}'
    )
    match_field = models.CharField(
        max_length=50,
        default="email",
        help_text="CRM field used to identify existing records to avoid duplicates"
    )
    last_sync_at = models.DateTimeField(null=True, blank=True)
    last_sync_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    last_sync_message = models.TextField(blank=True)
    total_synced = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="sheets_syncs"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    def is_due(self):
        """Returns True if it's time to run this sync."""
        if not self.is_enabled:
            return False
        if self.last_sync_at is None:
            return True
        minutes_since = (timezone.now() - self.last_sync_at).total_seconds() / 60
        return minutes_since >= self.sync_interval_minutes


class FollowUp(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="follow_ups")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    note = models.TextField()
    follow_up_date = models.DateField(null=True, blank=True)
    is_done = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
