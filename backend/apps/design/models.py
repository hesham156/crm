import uuid
from django.db import models
from django.conf import settings
from apps.sales.models import Job


class DesignSubmission(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("submitted", "Submitted for Review"),
        ("approved", "Approved"),
        ("rejected", "Rejected / Needs Revision"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="design_submissions")
    designer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name="design_submissions"
    )
    version = models.PositiveIntegerField(default=1)
    file = models.FileField(upload_to="designs/%Y/%m/", null=True, blank=True)
    file_url = models.URLField(max_length=1000, blank=True, help_text="MinIO/Drive URL")
    filename = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default="draft")
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="reviewed_designs"
    )
    reviewer_notes = models.TextField(blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.job.job_number} - v{self.version} ({self.status})"

    class Meta:
        ordering = ["-created_at"]
        unique_together = [["job", "version"]]
