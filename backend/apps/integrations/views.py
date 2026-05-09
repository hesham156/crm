from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.accounts.permissions import IsAdminOrManager
from .models import GoogleSheetsIntegration, SyncLog
from .serializers import GoogleSheetsIntegrationSerializer, SyncLogSerializer
from .google_sheets_service import GoogleSheetsService

class GoogleSheetsIntegrationViewSet(viewsets.ModelViewSet):
    queryset = GoogleSheetsIntegration.objects.all()
    serializer_class = GoogleSheetsIntegrationSerializer
    permission_classes = [IsAdminOrManager]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='sync-now')
    def sync_now(self, request, pk=None):
        integration = self.get_object()
        if not integration.is_active:
            return Response(
                {"error": "Integration is disabled."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        service = GoogleSheetsService()
        log = service.sync_integration(integration, triggered_by="manual")
        
        return Response({
            "status": log.status,
            "message": "Sync completed.",
            "rows_read": log.rows_read,
            "rows_created": log.rows_created,
            "rows_updated": log.rows_updated,
            "rows_skipped": log.rows_skipped,
            "rows_failed": log.rows_failed,
        })

class SyncLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SyncLogSerializer
    permission_classes = [IsAdminOrManager]
    
    def get_queryset(self):
        queryset = SyncLog.objects.all()
        integration_id = self.request.query_params.get('integration_id')
        if integration_id:
            queryset = queryset.filter(integration_id=integration_id)
        return queryset
