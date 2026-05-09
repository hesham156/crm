from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from apps.accounts.permissions import IsAdminOrManager
from .models import GoogleSheetsIntegration, SyncLog
from .serializers import GoogleSheetsIntegrationSerializer, SyncLogSerializer
from .google_sheets_service import GoogleSheetsService


class GoogleSheetsIntegrationViewSet(viewsets.ModelViewSet):
    queryset = GoogleSheetsIntegration.objects.all()
    serializer_class = GoogleSheetsIntegrationSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="sync-now")
    def sync_now(self, request, pk=None):
        integration = self.get_object()
        if not integration.is_active:
            return Response({"error": "Integration is disabled."}, status=status.HTTP_400_BAD_REQUEST)

        # Always run synchronously for manual triggers — user sees result immediately
        try:
            service = GoogleSheetsService()
            log = service.sync_integration(integration, triggered_by="manual")
            return Response({
                "status": log.status,
                "rows_read": log.rows_read,
                "rows_created": log.rows_created,
                "rows_updated": log.rows_updated,
                "rows_skipped": log.rows_skipped,
                "rows_failed": log.rows_failed,
            })
        except Exception as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], url_path="test-connection")
    def test_connection(self, request):
        """Fetch sheet headers to verify credentials + sheet access."""
        spreadsheet_id = request.data.get("spreadsheet_id", "").strip()
        sheet_name = request.data.get("sheet_name", "Sheet1").strip() or "Sheet1"
        header_row = int(request.data.get("header_row", 1))

        if not spreadsheet_id:
            return Response({"error": "spreadsheet_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Extract ID from full URL
        if "/spreadsheets/d/" in spreadsheet_id:
            spreadsheet_id = spreadsheet_id.split("/spreadsheets/d/")[1].split("/")[0]

        try:
            service = GoogleSheetsService()
            headers = service.fetch_headers(spreadsheet_id, sheet_name, header_row)
            # Also fetch a count estimate
            rows = service.fetch_rows(spreadsheet_id, sheet_name, start_row=header_row + 1)
            return Response({"headers": headers, "row_count": len(rows), "status": "ok"})
        except Exception as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

class SyncLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SyncLogSerializer
    permission_classes = [IsAdminOrManager]
    
    def get_queryset(self):
        queryset = SyncLog.objects.all()
        integration_id = self.request.query_params.get('integration_id')
        if integration_id:
            queryset = queryset.filter(integration_id=integration_id)
        return queryset
