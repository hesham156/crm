from rest_framework import generics, filters, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from .models import Job, Quotation, Invoice
from .serializers import JobSerializer, QuotationSerializer, InvoiceSerializer
from apps.accounts.permissions import IsSalesOrAbove, IsAdminOrManager


class StandardPagination(PageNumberPagination):
    """50 items per page, max 200."""
    page_size            = 50
    page_size_query_param = "page_size"
    max_page_size        = 200


class JobListCreateView(generics.ListCreateAPIView):
    serializer_class   = JobSerializer
    permission_classes = [IsSalesOrAbove]
    pagination_class   = StandardPagination
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ["status", "priority", "customer", "created_by"]
    search_fields      = ["job_number", "title"]
    ordering_fields    = ["created_at", "deadline"]

    def get_queryset(self):
        user = self.request.user
        qs   = Job.objects.select_related("customer", "created_by")
        # Sales users see only their own jobs. Managers/Admins see all.
        if not user.is_manager:
            qs = qs.filter(created_by=user)
        return qs.all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class JobDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = JobSerializer
    permission_classes = [IsSalesOrAbove]

    def get_queryset(self):
        user = self.request.user
        qs   = Job.objects.select_related("customer", "created_by")
        # Sales can only PATCH/DELETE their own jobs
        if not user.is_manager:
            qs = qs.filter(created_by=user)
        return qs


class QuotationListCreateView(generics.ListCreateAPIView):
    serializer_class = QuotationSerializer
    permission_classes = [IsSalesOrAbove]

    def get_queryset(self):
        return Quotation.objects.filter(job_id=self.kwargs.get("job_id"))

    def perform_create(self, serializer):
        serializer.save(job_id=self.kwargs.get("job_id"), created_by=self.request.user)


class InvoiceListCreateView(generics.ListCreateAPIView):
    serializer_class   = InvoiceSerializer
    permission_classes = [IsSalesOrAbove]
    pagination_class   = StandardPagination
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["job", "payment_status"]

    def get_queryset(self):
        qs = Invoice.objects.select_related("job").all()
        if not self.request.user.is_manager:
            qs = qs.filter(job__created_by=self.request.user)
        return qs
