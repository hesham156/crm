import uuid
from django.db import models, transaction
from django.conf import settings
from apps.crm.models import Customer


class Job(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("design", "In Design"),
        ("approval", "Awaiting Approval"),
        ("production", "In Production"),
        ("delivery", "Out for Delivery"),
        ("complete", "Completed"),
        ("cancelled", "Cancelled"),
    ]
    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("normal", "Normal"),
        ("high", "High"),
        ("urgent", "Urgent"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job_number = models.CharField(max_length=20, unique=True, blank=True)
    title = models.CharField(max_length=300)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="jobs")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name="created_jobs"
    )
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default="draft")
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default="normal")
    deadline = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    client_requirements = models.TextField(blank=True)
    drive_folder_id = models.CharField(max_length=255, blank=True, null=True, help_text="Google Drive Folder ID")
    drive_folder_url = models.URLField(max_length=500, blank=True, null=True, help_text="Google Drive Folder URL")
    # Specifications for Printing
    product_type = models.CharField(max_length=100, blank=True, help_text="e.g. Sticker, Flyer, Box")
    dimensions = models.CharField(max_length=100, blank=True, help_text="e.g. 10x15 cm")
    paper_type = models.CharField(max_length=100, blank=True, help_text="e.g. Glossy 150g, Matte 300g")
    quantity = models.PositiveIntegerField(default=1, help_text="Number of copies/items")
    printing_colors = models.CharField(max_length=100, blank=True, help_text="e.g. CMYK, Pantone, B&W")
    finishing = models.TextField(blank=True, help_text="e.g. Matte Lamination, UV Spot, Die Cut")

    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.job_number:
            import datetime
            with transaction.atomic():
                year = datetime.date.today().year
                prefix = f"PS-{year}-"
                # Lock the last existing row to prevent race conditions
                last_job = (
                    Job.objects.select_for_update()
                    .filter(job_number__startswith=prefix)
                    .order_by("-job_number")
                    .first()
                )
                if last_job and last_job.job_number:
                    try:
                        last_num = int(last_job.job_number.split("-")[-1])
                    except (ValueError, IndexError):
                        last_num = 0
                else:
                    last_num = 0
                self.job_number = f"{prefix}{str(last_num + 1).zfill(4)}"
                super().save(*args, **kwargs)
        else:
            super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.job_number} - {self.title}"

    class Meta:
        ordering = ["-created_at"]


class QuotationItem(models.Model):
    """Individual line items inside a Quotation."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quotation = models.ForeignKey(
        "Quotation", on_delete=models.CASCADE, related_name="line_items",
        null=True, blank=True  # null=True for backward compat with JSON items
    )
    description = models.CharField(max_length=300)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    @property
    def total(self):
        return self.quantity * self.unit_price

    def __str__(self):
        return f"{self.description} x {self.quantity} @ {self.unit_price}"


class Quotation(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("sent", "Sent"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="quotations")
    items = models.JSONField(default=list)  # [{description, qty, unit_price}]
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=15)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="draft")
    valid_until = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Invoice(models.Model):
    PAYMENT_STATUS = [
        ("unpaid", "Unpaid"),
        ("partial", "Partial"),
        ("paid", "Paid"),
    ]
    PAYMENT_METHOD = [
        ("cash", "Cash"),
        ("bank_transfer", "Bank Transfer"),
        ("check", "Check"),
        ("credit_card", "Credit Card"),
        ("online", "Online Payment"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="invoices")
    quotation = models.ForeignKey(Quotation, on_delete=models.SET_NULL, null=True, blank=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_status = models.CharField(max_length=10, choices=PAYMENT_STATUS, default="unpaid")
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD, blank=True)
    due_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Invoice #{self.id} — {self.job.job_number} ({self.payment_status})"

    class Meta:
        ordering = ["-created_at"]
