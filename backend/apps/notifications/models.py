import uuid
from django.db import models
from django.conf import settings


class Notification(models.Model):
    TYPE_CHOICES = [
        ("task_assigned", "Task Assigned"),
        ("task_updated", "Task Updated"),
        ("task_comment", "New Comment"),
        ("task_due", "Task Due"),
        ("file_uploaded", "File Uploaded"),
        ("approval_requested", "Approval Requested"),
        ("approval_done", "Approval Done"),
        ("job_created", "Job Created"),
        ("job_updated", "Job Updated"),
        ("mention", "Mention"),
        ("system", "System"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="sent_notifications"
    )
    type = models.CharField(max_length=30, choices=TYPE_CHOICES, default="system")
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    link = models.CharField(max_length=500, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.type}] {self.title} → {self.recipient}"

    class Meta:
        ordering = ["-created_at"]


def send_notification(recipient_ids, title, body="", type="system", link="", sender=None):
    """Helper to bulk-create notifications and push via WebSocket."""
    from apps.accounts.models import User
    import json
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync

    channel_layer = get_channel_layer()

    for user_id in recipient_ids:
        notif = Notification.objects.create(
            recipient_id=user_id, sender=sender,
            type=type, title=title, body=body, link=link,
        )
        # Push via WebSocket
        if channel_layer:
            try:
                async_to_sync(channel_layer.group_send)(
                    f"notifications_{user_id}",
                    {
                        "type": "send_notification",
                        "notification": {
                            "id": str(notif.id),
                            "type": notif.type,
                            "title": notif.title,
                            "body": notif.body,
                            "link": notif.link,
                            "is_read": notif.is_read,
                            "created_at": notif.created_at.isoformat(),
                        },
                    },
                )
            except Exception:
                pass
