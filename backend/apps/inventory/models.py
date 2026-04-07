import uuid
from django.db import models
from django.conf import settings


class InventoryCategory(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class InventoryItem(models.Model):
    UNIT_CHOICES = [
        ("piece", "Piece"),
        ("roll", "Roll"),
        ("kg", "Kilogram"),
        ("liter", "Liter"),
        ("sheet", "Sheet"),
        ("box", "Box"),
        ("meter", "Meter"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=50, unique=True, blank=True)
    category = models.ForeignKey(InventoryCategory, on_delete=models.SET_NULL, null=True, blank=True)
    unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default="piece")
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    min_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cost_per_unit = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    supplier = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.quantity} {self.unit})"

    @property
    def is_low_stock(self):
        return self.quantity <= self.min_quantity

    class Meta:
        ordering = ["name"]


class InventoryTransaction(models.Model):
    TYPE_CHOICES = [
        ("in", "Stock In"),
        ("out", "Stock Out"),
        ("adjustment", "Adjustment"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="transactions")
    type = models.CharField(max_length=15, choices=TYPE_CHOICES)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    reference_job = models.ForeignKey(
        "sales.Job", on_delete=models.SET_NULL, null=True, blank=True
    )
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Update item quantity
        item = self.item
        if self.type == "in":
            item.quantity += self.quantity
        elif self.type == "out":
            item.quantity -= self.quantity
        else:
            item.quantity = self.quantity
        item.save(update_fields=["quantity"])

    class Meta:
        ordering = ["-created_at"]
