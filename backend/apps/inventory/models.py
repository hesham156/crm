import uuid
from django.db import models, transaction
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
        return self.quantity > 0 and self.quantity <= self.min_quantity

    @property
    def is_out_of_stock(self):
        return self.quantity <= 0

    def _auto_sku(self):
        """Generate a SKU like INV-0001 if none provided."""
        prefix = "INV"
        last = InventoryItem.objects.filter(
            sku__startswith=f"{prefix}-"
        ).order_by("-sku").first()
        if last and last.sku:
            try:
                num = int(last.sku.split("-")[-1])
            except (ValueError, IndexError):
                num = 0
        else:
            num = 0
        return f"{prefix}-{str(num + 1).zfill(4)}"

    def save(self, *args, **kwargs):
        if not self.sku:
            self.sku = self._auto_sku()
        super().save(*args, **kwargs)

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
        with transaction.atomic():
            super().save(*args, **kwargs)
            # Update item quantity atomically
            item = InventoryItem.objects.select_for_update().get(pk=self.item_id)
            if self.type == "in":
                item.quantity += self.quantity
            elif self.type == "out":
                item.quantity = max(0, item.quantity - self.quantity)
            else:  # adjustment
                item.quantity = self.quantity
            item.save(update_fields=["quantity", "updated_at"])

            # 🔔 Low stock alert
            if item.is_low_stock or item.is_out_of_stock:
                try:
                    from apps.notifications.models import send_notification
                    from apps.accounts.models import User
                    admins = list(
                        User.objects.filter(role__in=["admin", "manager"], is_active=True)
                        .values_list("id", flat=True)
                    )
                    if admins:
                        label = "نفد" if item.is_out_of_stock else "منخفض"
                        send_notification(
                            recipient_ids=[str(uid) for uid in admins],
                            title=f"تنبيه مخزون {label}: {item.name}",
                            body=f"الكمية الحالية {item.quantity} {item.unit} (الحد الأدنى: {item.min_quantity})",
                            type="stock_alert",
                        )
                except Exception:
                    pass  # Don't break the transaction for notification failure

    class Meta:
        ordering = ["-created_at"]
