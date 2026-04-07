from django.urls import path
from rest_framework import generics, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import serializers
from .models import InventoryItem, InventoryTransaction, InventoryCategory


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryCategory
        fields = ["id", "name", "description"]


class ItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = InventoryItem
        fields = [
            "id", "name", "sku", "category", "category_name",
            "unit", "quantity", "min_quantity", "cost_per_unit",
            "supplier", "notes", "is_low_stock", "created_at"
        ]


class TransactionSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = InventoryTransaction
        fields = ["id", "item", "item_name", "type", "quantity", "reference_job", "performed_by", "notes", "created_at"]
        read_only_fields = ["performed_by"]

    def create(self, validated_data):
        validated_data["performed_by"] = self.context["request"].user
        return super().create(validated_data)


class ItemListCreate(generics.ListCreateAPIView):
    queryset = InventoryItem.objects.select_related("category").all()
    serializer_class = ItemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["category", "unit"]
    search_fields = ["name", "sku", "supplier"]


class ItemDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = InventoryItem.objects.all()
    serializer_class = ItemSerializer
    permission_classes = [IsAuthenticated]


class TransactionListCreate(generics.ListCreateAPIView):
    queryset = InventoryTransaction.objects.select_related("item").all()
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]


class LowStockReport(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = InventoryItem.objects.filter(quantity__lte=models.F("min_quantity"))
        return Response(ItemSerializer(items, many=True).data)


from django.db import models

urlpatterns = [
    path("categories/", generics.ListCreateAPIView.as_view(
        queryset=InventoryCategory.objects.all(),
        serializer_class=CategorySerializer,
        permission_classes=[IsAuthenticated]
    )),
    path("items/", ItemListCreate.as_view()),
    path("items/<uuid:pk>/", ItemDetail.as_view()),
    path("transactions/", TransactionListCreate.as_view()),
    path("reports/low-stock/", LowStockReport.as_view()),
]
