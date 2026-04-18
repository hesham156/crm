import uuid
from django.db import models
from django.conf import settings


class Notification(models.Model):
    TYPE_CHOICES = [
        ("task_assigned",       "Task Assigned"),
        ("task_updated",        "Task Updated"),
        ("task_comment",        "New Comment"),
        ("task_due",            "Task Due"),
        ("file_uploaded",       "File Uploaded"),
        ("approval_requested",  "Approval Requested"),
        ("approval_done",       "Approval Done"),
        ("job_created",         "Job Created"),
        ("job_updated",         "Job Updated"),
        ("mention",             "Mention"),
        ("system",              "System"),
        # New types
        ("general",             "General"),          # used by automation notify_user
        ("quality_review",      "Quality Review"),   # used by review_entry automation
        ("design_approved",     "Design Approved"),  # used by design approval flow
        ("design_rejected",     "Design Rejected"),  # used by design rejection flow
        ("stock_alert",         "Low Stock Alert"),  # used by inventory alerts
        ("invoice_paid",        "Invoice Paid"),     # used by payment tracking
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
    """Helper to bulk-create notifications and push via WebSocket and WhatsApp."""
    from apps.accounts.models import User
    import json
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync
    from .whatsapp import send_whatsapp_template

    channel_layer = get_channel_layer()
    users = User.objects.filter(id__in=recipient_ids)
    user_map = {user.id: user for user in users}

    # Role-Based Allowed WhatsApp Notifications
    ROLE_WHATSAPP_NOTIFICATIONS = {
        "admin": ["task_assigned", "approval_requested", "job_created", "mention"],
        "manager": ["task_assigned", "approval_requested", "job_created", "mention"],
        "sales": ["job_updated", "task_assigned", "mention"],
        "designer": ["task_assigned", "file_uploaded", "mention", "approval_done"],
        "production": ["task_assigned", "job_updated", "mention"],
    }

    for user_id in recipient_ids:
        user = user_map.get(user_id)
        
        notif = Notification.objects.create(
            recipient_id=user_id, sender=sender,
            type=type, title=title, body=body, link=link,
        )

        # WhatsApp Template Integration (template configurable via WHATSAPP_TEMPLATE_NAME in .env)
        if user and user.phone:
            allowed_types = ROLE_WHATSAPP_NOTIFICATIONS.get(user.role, [])
            if type in allowed_types:
                from django.conf import settings as django_settings
                wa_template = getattr(django_settings, "WHATSAPP_TEMPLATE_NAME", "test2")
                send_whatsapp_template(
                    phone=user.phone,
                    template_name=wa_template,
                    named_params={
                        "name":     user.full_name_en,
                        "order_id": title,
                        "product":  body or type,
                    },
                    language_code="en_US",
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
