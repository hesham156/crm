from rest_framework import serializers
from apps.crm.serializers import CustomerSerializer
from .models import Job, Quotation, Invoice


class JobSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name_en", read_only=True)
    linked_tasks = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = [
            "id", "job_number", "title", "customer", "customer_name",
            "created_by", "created_by_name", "status", "priority",
            "deadline", "description", "client_requirements",
            "drive_folder_id", "drive_folder_url",
            "total_amount", "created_at", "updated_at", "linked_tasks"
        ]
        read_only_fields = ["job_number", "created_by", "created_at", "updated_at"]

    def get_linked_tasks(self, obj):
        tasks = obj.tasks.filter(is_archived=False)
        return [{
            "id": t.id,
            "title": t.title,
            "board_name": t.board.name,
            "column_name": t.column.name,
            "column_color": t.column.color,
            "priority": t.priority,
            "status": t.client_status,
            "assigned_to": [{"id": str(u.id), "name": u.full_name_en, "avatar": request.build_absolute_uri(u.avatar.url) if (request:=self.context.get("request")) and u.avatar else None} for u in t.assigned_to.all()]
        } for t in tasks]


class QuotationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quotation
        fields = [
            "id", "job", "items", "subtotal", "tax_percent",
            "discount", "total", "status", "valid_until", "notes",
            "created_by", "created_at", "updated_at"
        ]
        read_only_fields = ["created_by"]


class InvoiceSerializer(serializers.ModelSerializer):
    job_number = serializers.CharField(source="job.job_number", read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id", "job", "job_number", "quotation",
            "total_amount", "amount_paid", "payment_status",
            "due_date", "notes", "created_at"
        ]
