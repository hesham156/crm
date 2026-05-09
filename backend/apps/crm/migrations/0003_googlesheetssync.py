import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("crm", "0002_customer_drive_folder_id_customer_drive_folder_url"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="GoogleSheetsSync",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(help_text="Friendly name for this sync configuration", max_length=200)),
                ("spreadsheet_id", models.CharField(help_text="Google Sheets spreadsheet ID (from URL)", max_length=300)),
                ("sheet_name", models.CharField(default="Sheet1", help_text="Tab/sheet name within the spreadsheet", max_length=200)),
                ("header_row", models.PositiveIntegerField(default=1, help_text="Row number that contains headers (1-indexed)")),
                ("sync_interval_minutes", models.PositiveIntegerField(default=60, help_text="How often to sync (in minutes)")),
                ("is_enabled", models.BooleanField(default=True)),
                (
                    "field_mapping",
                    models.JSONField(
                        default=dict,
                        help_text='Maps sheet column header to CRM field. e.g. {"Name": "name", "Email": "email"}',
                    ),
                ),
                (
                    "match_field",
                    models.CharField(
                        default="email",
                        help_text="CRM field used to identify existing records to avoid duplicates",
                        max_length=50,
                    ),
                ),
                ("last_sync_at", models.DateTimeField(blank=True, null=True)),
                (
                    "last_sync_status",
                    models.CharField(
                        choices=[("pending", "Pending"), ("success", "Success"), ("error", "Error")],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("last_sync_message", models.TextField(blank=True)),
                ("total_synced", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="sheets_syncs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
