import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models
import apps.forms.models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("crm", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Form",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True)),
                ("slug", models.CharField(default=apps.forms.models.generate_slug, max_length=20, unique=True)),
                ("is_active", models.BooleanField(default=True)),
                ("primary_color", models.CharField(default="#f97316", max_length=7)),
                ("submit_button_text", models.CharField(default="إرسال", max_length=100)),
                ("success_message", models.TextField(default="شكراً على ردك! 🎉")),
                ("redirect_url", models.URLField(blank=True)),
                ("auto_create_customer", models.BooleanField(default=False)),
                ("crm_mapping", models.JSONField(blank=True, default=dict)),
                ("response_count", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_forms",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="FormStep",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("title", models.CharField(blank=True, max_length=200)),
                ("order", models.PositiveIntegerField(default=0)),
                (
                    "form",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="steps",
                        to="forms.form",
                    ),
                ),
            ],
            options={"ordering": ["order"]},
        ),
        migrations.CreateModel(
            name="FormField",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "field_type",
                    models.CharField(
                        choices=[
                            ("short_text", "Short Text"),
                            ("long_text", "Long Text"),
                            ("email", "Email"),
                            ("phone", "Phone"),
                            ("number", "Number"),
                            ("date", "Date"),
                            ("single_choice", "Single Choice"),
                            ("multiple_choice", "Multiple Choice"),
                            ("dropdown", "Dropdown"),
                            ("rating", "Rating"),
                            ("yes_no", "Yes / No"),
                            ("statement", "Statement / Heading"),
                            ("file", "File Upload"),
                        ],
                        max_length=30,
                    ),
                ),
                ("label", models.CharField(max_length=500)),
                ("description", models.TextField(blank=True)),
                ("placeholder", models.CharField(blank=True, max_length=300)),
                ("required", models.BooleanField(default=True)),
                ("order", models.PositiveIntegerField(default=0)),
                ("options", models.JSONField(blank=True, default=list)),
                ("settings", models.JSONField(blank=True, default=dict)),
                (
                    "step",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="fields",
                        to="forms.formstep",
                    ),
                ),
            ],
            options={"ordering": ["order"]},
        ),
        migrations.CreateModel(
            name="FormSubmission",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("submitted_at", models.DateTimeField(auto_now_add=True)),
                ("ip_address", models.CharField(blank=True, max_length=50)),
                ("user_agent", models.CharField(blank=True, max_length=500)),
                ("is_read", models.BooleanField(default=False)),
                (
                    "customer",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="form_submissions",
                        to="crm.customer",
                    ),
                ),
                (
                    "form",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="submissions",
                        to="forms.form",
                    ),
                ),
            ],
            options={"ordering": ["-submitted_at"]},
        ),
        migrations.CreateModel(
            name="FieldResponse",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("label_snapshot", models.CharField(max_length=500)),
                ("value", models.JSONField()),
                (
                    "field",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="forms.formfield",
                    ),
                ),
                (
                    "submission",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="responses",
                        to="forms.formsubmission",
                    ),
                ),
            ],
        ),
    ]
