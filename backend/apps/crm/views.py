from rest_framework import generics, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import Customer, FollowUp
from .serializers import CustomerSerializer, FollowUpSerializer
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
