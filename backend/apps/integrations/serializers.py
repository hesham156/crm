from rest_framework import serializers
from apps.accounts.serializers import UserListSerializer
from .models import GoogleSheetsIntegration, SyncLog

class GoogleSheetsIntegrationSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.full_name_en", read_only=True)
    default_assigned_to_name = serializers.CharField(source="default_assigned_to.full_name_en", read_only=True)

    class Meta:
        model = GoogleSheetsIntegration
        fields = '__all__'
        read_only_fields = [
            "last_synced_row", 
            "last_sync_at", 
            "last_sync_status", 
            "last_sync_message",
            "created_by"
        ]

class SyncLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncLog
        fields = '__all__'
