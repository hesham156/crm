from rest_framework import serializers
from apps.accounts.serializers import UserListSerializer
from .models import Customer, FollowUp


class CustomerSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source="assigned_to.full_name_en", read_only=True)

    class Meta:
        model = Customer
        fields = [
            "id", "name", "company", "email", "phone",
            "type", "stage", "assigned_to", "assigned_to_name",
            "address", "notes", "website", "drive_folder_id", "drive_folder_url", "created_at", "updated_at"
        ]


class FollowUpSerializer(serializers.ModelSerializer):
    class Meta:
        model = FollowUp
        fields = ["id", "customer", "created_by", "note", "follow_up_date", "is_done", "created_at"]
        read_only_fields = ["created_by"]
