import uuid
from django.db import models
from django.conf import settings
from apps.sales.models import Job


class ProductionStage(models.Model):
    STAGE_TYPES = [
        ("prepress", "Pre-press"),
        ("printing", "Printing"),
        ("cutting", "Cutting"),
        ("lamination", "Lamination"),
        ("finishing", "Finishing"),
        ("packaging", "Packaging"),
        ("delivery", "Delivery"),
    ]
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("in_progress", "In Progress"),
        ("paused", "Paused"),
        ("done", "Done"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="production_stages")
    stage_type = models.CharField(max_length=20, choices=STAGE_TYPES)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default="pending")
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    position = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.job.job_number} - {self.stage_type} ({self.status})"

    class Meta:
        ordering = ["position"]
