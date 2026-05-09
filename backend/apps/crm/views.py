from rest_framework import generics, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from .models import Customer, FollowUp, GoogleSheetsSync
from .serializers import CustomerSerializer, FollowUpSerializer, GoogleSheetsSyncSerializer
from apps.accounts.permissions import IsSalesOrAbove


class CustomerListCreateView(generics.ListCreateAPIView):
    serializer_class = CustomerSerializer
    permission_classes = [IsSalesOrAbove]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["type", "stage", "assigned_to"]
    search_fields = ["name", "company", "email", "phone"]

    def get_queryset(self):
        return Customer.objects.select_related("assigned_to").all()

    def perform_create(self, serializer):
        serializer.save()


class CustomerDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Customer.objects.select_related("assigned_to").all()
    serializer_class = CustomerSerializer
    permission_classes = [IsSalesOrAbove]


class FollowUpListCreateView(generics.ListCreateAPIView):
    serializer_class = FollowUpSerializer
    permission_classes = [IsSalesOrAbove]

    def get_queryset(self):
        return FollowUp.objects.filter(customer_id=self.kwargs["customer_id"])

    def perform_create(self, serializer):
        serializer.save(customer_id=self.kwargs["customer_id"], created_by=self.request.user)


# ─── Google Sheets Sync ───────────────────────────────────────────────────────

class GoogleSheetsSyncListCreateView(generics.ListCreateAPIView):
    """List all sync configurations or create a new one."""
    serializer_class = GoogleSheetsSyncSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return GoogleSheetsSync.objects.all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class GoogleSheetsSyncDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete a sync configuration."""
    serializer_class = GoogleSheetsSyncSerializer
    permission_classes = [IsAuthenticated]
    queryset = GoogleSheetsSync.objects.all()


class SheetsSyncTestConnectionView(APIView):
    """
    POST /crm/sheets-sync/test/
    Body: { "spreadsheet_id": "...", "sheet_name": "Sheet1", "header_row": 1 }
    Returns the headers found in the sheet so the user can build a field mapping.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from utils.google_sheets import test_connection

        spreadsheet_id = request.data.get("spreadsheet_id", "").strip()
        sheet_name = request.data.get("sheet_name", "Sheet1").strip() or "Sheet1"
        header_row = int(request.data.get("header_row", 1))

        if not spreadsheet_id:
            return Response({"error": "spreadsheet_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = test_connection(spreadsheet_id, sheet_name, header_row)
            return Response(result)
        except Exception as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class SheetsSyncRunNowView(APIView):
    """
    POST /crm/sheets-sync/<pk>/run/
    Immediately executes the sync (synchronously in the request, or via Celery if available).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        sync = get_object_or_404(GoogleSheetsSync, pk=pk)
        try:
            # Try to run via Celery async task; fall back to synchronous if broker unavailable
            from .tasks import run_single_sheets_sync
            try:
                task = run_single_sheets_sync.delay(str(sync.id))
                return Response({"status": "queued", "task_id": task.id})
            except Exception:
                # Celery broker not available — run synchronously
                from .sheets_sync_service import run_sync
                result = run_sync(sync)
                return Response(result)
        except Exception as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
