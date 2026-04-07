from rest_framework import serializers
from .models import Notification
from apps.accounts.serializers import UserListSerializer


class NotificationSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.full_name_en", read_only=True)

    class Meta:
        model = Notification
        fields = ["id", "type", "title", "body", "link", "is_read", "sender_name", "created_at"]
