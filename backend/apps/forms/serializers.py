from rest_framework import serializers
from .models import Form, FormStep, FormField, FormSubmission, FieldResponse


class FormFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormField
        fields = [
            "id", "field_type", "label", "description", "placeholder",
            "required", "order", "options", "settings",
        ]


class FormStepSerializer(serializers.ModelSerializer):
    fields = FormFieldSerializer(many=True, read_only=True)
    field_count = serializers.IntegerField(source="fields.count", read_only=True)

    class Meta:
        model = FormStep
        fields = ["id", "title", "order", "fields", "field_count"]


class FormSerializer(serializers.ModelSerializer):
    steps = FormStepSerializer(many=True, read_only=True)
    step_count = serializers.IntegerField(source="steps.count", read_only=True)

    class Meta:
        model = Form
        fields = [
            "id", "title", "description", "slug", "is_active", "primary_color",
            "submit_button_text", "success_message", "redirect_url",
            "auto_create_customer", "crm_mapping",
            "response_count", "created_at", "updated_at",
            "steps", "step_count",
        ]
        read_only_fields = ["slug", "response_count", "created_at", "updated_at"]


class FormListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list view (no nested steps/fields)."""
    step_count = serializers.IntegerField(source="steps.count", read_only=True)

    class Meta:
        model = Form
        fields = [
            "id", "title", "description", "slug", "is_active",
            "primary_color", "response_count", "step_count", "created_at",
        ]


class FieldResponseSerializer(serializers.ModelSerializer):
    field_type = serializers.CharField(source="field.field_type", read_only=True, default="")

    class Meta:
        model = FieldResponse
        fields = ["id", "field", "field_type", "label_snapshot", "value"]


class FormSubmissionSerializer(serializers.ModelSerializer):
    responses = FieldResponseSerializer(many=True, read_only=True)

    class Meta:
        model = FormSubmission
        fields = ["id", "submitted_at", "is_read", "customer", "ip_address", "responses"]
        read_only_fields = ["submitted_at", "ip_address"]
