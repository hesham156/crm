import uuid
import random
import string
from django.db import models
from django.conf import settings


def _random_slug():
    chars = string.ascii_letters + string.digits
    return "".join(random.choices(chars, k=10))


def generate_slug():
    slug = _random_slug()
    while Form.objects.filter(slug=slug).exists():
        slug = _random_slug()
    return slug


class Form(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    slug = models.CharField(max_length=20, unique=True)

    # Appearance
    is_active = models.BooleanField(default=True)
    primary_color = models.CharField(max_length=7, default="#f97316")  # brand orange

    # Behavior
    submit_button_text = models.CharField(max_length=100, default="إرسال")
    success_message = models.TextField(default="شكراً على ردك! 🎉")
    redirect_url = models.URLField(blank=True)

    # CRM integration
    auto_create_customer = models.BooleanField(default=False)
    # Maps CRM field names → FormField UUIDs (strings)
    # e.g. {"name": "uuid...", "email": "uuid...", "phone": "uuid..."}
    crm_mapping = models.JSONField(default=dict, blank=True)

    # Counters (cached)
    response_count = models.PositiveIntegerField(default=0)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_forms",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = generate_slug()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class FormStep(models.Model):
    """A single screen/page inside a form."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    form = models.ForeignKey(Form, on_delete=models.CASCADE, related_name="steps")
    title = models.CharField(max_length=200, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.form.title} — Step {self.order + 1}"


class FormField(models.Model):
    FIELD_TYPES = [
        ("short_text",      "Short Text"),
        ("long_text",       "Long Text"),
        ("email",           "Email"),
        ("phone",           "Phone"),
        ("number",          "Number"),
        ("date",            "Date"),
        ("single_choice",   "Single Choice"),
        ("multiple_choice", "Multiple Choice"),
        ("dropdown",        "Dropdown"),
        ("rating",          "Rating"),
        ("yes_no",          "Yes / No"),
        ("statement",       "Statement / Heading"),
        ("file",            "File Upload"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    step = models.ForeignKey(FormStep, on_delete=models.CASCADE, related_name="fields")
    field_type = models.CharField(max_length=30, choices=FIELD_TYPES)
    label = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    placeholder = models.CharField(max_length=300, blank=True)
    required = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    # For single_choice / multiple_choice / dropdown
    options = models.JSONField(default=list, blank=True)

    # Type-specific settings: max_rating, max_length, min, max, etc.
    settings = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.label} ({self.field_type})"


class FormSubmission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    form = models.ForeignKey(Form, on_delete=models.CASCADE, related_name="submissions")
    submitted_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.CharField(max_length=50, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    is_read = models.BooleanField(default=False)

    # Optional CRM link
    customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="form_submissions",
    )

    class Meta:
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"{self.form.title} — {self.submitted_at:%Y-%m-%d %H:%M}"


class FieldResponse(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(FormSubmission, on_delete=models.CASCADE, related_name="responses")
    field = models.ForeignKey(FormField, on_delete=models.SET_NULL, null=True)
    label_snapshot = models.CharField(max_length=500)
    value = models.JSONField()  # str | list | int | bool

    def __str__(self):
        return f"{self.label_snapshot}: {self.value}"
