from rest_framework import generics, filters, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import Job, Quotation, Invoice
from .serializers import JobSerializer, QuotationSerializer, InvoiceSerializer
from apps.accounts.permissions import IsSalesOrAbove, IsAdminOrManager


class JobListCreateView(generics.ListCreateAPIView):
    serializer_class = JobSerializer
    permission_classes = [IsSalesOrAbove]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "priority", "customer", "created_by"]
    search_fields = ["job_number", "title"]
    ordering_fields = ["created_at", "deadline"]

    def get_queryset(self):
        return Job.objects.select_related("customer", "created_by").all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class JobDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Job.objects.select_related("customer", "created_by").all()
    serializer_class = JobSerializer
    permission_classes = [IsSalesOrAbove]


class QuotationListCreateView(generics.ListCreateAPIView):
    serializer_class = QuotationSerializer
    permission_classes = [IsSalesOrAbove]

    def get_queryset(self):
        return Quotation.objects.filter(job_id=self.kwargs.get("job_id"))

    def perform_create(self, serializer):
        serializer.save(job_id=self.kwargs.get("job_id"), created_by=self.request.user)


class InvoiceListCreateView(generics.ListCreateAPIView):
    serializer_class = InvoiceSerializer
    permission_classes = [IsSalesOrAbove]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["job", "payment_status"]

    def get_queryset(self):
        return Invoice.objects.select_related("job").all()
