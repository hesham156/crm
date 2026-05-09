from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.db import models, transaction
from django.core.files.storage import default_storage
from django.conf import settings
import os, uuid
from .models import Form, FormStep, FormField, FormSubmission, FieldResponse
from .serializers import (
    FormSerializer, FormListSerializer, FormStepSerializer,
    FormFieldSerializer, FormSubmissionSerializer,
)


# ─── Forms (auth required) ────────────────────────────────────────────────────

class FormListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return FormListSerializer if self.request.method == "GET" else FormSerializer

    def get_queryset(self):
        return Form.objects.filter(created_by=self.request.user).prefetch_related("steps")

    def perform_create(self, serializer):
        form = serializer.save(created_by=self.request.user)
        # Auto-create first step so builder is ready immediately
        FormStep.objects.create(form=form, title="", order=0)


class FormDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FormSerializer

    def get_queryset(self):
        return Form.objects.filter(
            created_by=self.request.user
        ).prefetch_related("steps__fields")


class FormDuplicateView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        original = get_object_or_404(Form, pk=pk, created_by=request.user)
        new_form = Form.objects.create(
            title=f"{original.title} (نسخة)",
            description=original.description,
            primary_color=original.primary_color,
            submit_button_text=original.submit_button_text,
            success_message=original.success_message,
            redirect_url=original.redirect_url,
            auto_create_customer=original.auto_create_customer,
            crm_mapping=original.crm_mapping,
            created_by=request.user,
        )
        for step in original.steps.prefetch_related("fields").all():
            new_step = FormStep.objects.create(form=new_form, title=step.title, order=step.order)
            for field in step.fields.all():
                FormField.objects.create(
                    step=new_step,
                    field_type=field.field_type,
                    label=field.label,
                    description=field.description,
                    placeholder=field.placeholder,
                    required=field.required,
                    order=field.order,
                    options=field.options,
                    settings=field.settings,
                )
        return Response(FormSerializer(new_form).data, status=status.HTTP_201_CREATED)


# ─── Steps ────────────────────────────────────────────────────────────────────

class StepListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FormStepSerializer

    def get_queryset(self):
        return FormStep.objects.filter(
            form_id=self.kwargs["form_id"],
            form__created_by=self.request.user,
        ).prefetch_related("fields")

    def perform_create(self, serializer):
        form = get_object_or_404(Form, id=self.kwargs["form_id"], created_by=self.request.user)
        order = form.steps.count()
        serializer.save(form=form, order=order)


class StepDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FormStepSerializer
    queryset = FormStep.objects.prefetch_related("fields").all()


# ─── Fields ───────────────────────────────────────────────────────────────────

class FieldListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FormFieldSerializer

    def get_queryset(self):
        return FormField.objects.filter(step_id=self.kwargs["step_id"])

    def perform_create(self, serializer):
        step = get_object_or_404(FormStep, id=self.kwargs["step_id"])
        order = step.fields.count()
        serializer.save(step=step, order=order)


class FieldDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FormFieldSerializer
    queryset = FormField.objects.all()


class FieldReorderView(APIView):
    """POST {fields: [{id, order}, ...]} — bulk reorder within a step."""
    permission_classes = [IsAuthenticated]

    def post(self, request, step_id):
        step = get_object_or_404(FormStep, id=step_id)
        for item in request.data.get("fields", []):
            FormField.objects.filter(id=item["id"], step=step).update(order=item["order"])
        return Response({"status": "reordered"})


# ─── Submissions ──────────────────────────────────────────────────────────────

class SubmissionListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FormSubmissionSerializer

    def get_queryset(self):
        return FormSubmission.objects.filter(
            form_id=self.kwargs["form_id"],
            form__created_by=self.request.user,
        ).prefetch_related("responses__field")


class SubmissionDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FormSubmissionSerializer

    def get_queryset(self):
        return FormSubmission.objects.filter(
            form__created_by=self.request.user
        ).prefetch_related("responses__field")


# ─── Public File Upload (no auth) ────────────────────────────────────────────

class PublicFileUploadView(APIView):
    """Upload a file for a form field. Returns URL + metadata. No auth needed."""
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        # Validate size (10 MB max)
        if file.size > 10 * 1024 * 1024:
            return Response({"error": "الملف أكبر من 10 MB"}, status=status.HTTP_400_BAD_REQUEST)

        # Generate unique path under form_uploads/
        ext = os.path.splitext(file.name)[1].lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"
        path = default_storage.save(f"form_uploads/{unique_name}", file)

        url = request.build_absolute_uri(settings.MEDIA_URL + path)
        return Response({
            "url": url,
            "name": file.name,
            "size": file.size,
            "type": file.content_type,
        }, status=status.HTTP_201_CREATED)


# ─── Public (no auth) ─────────────────────────────────────────────────────────

class PublicFormView(APIView):
    """Returns form structure for public rendering. No auth needed."""
    permission_classes = [AllowAny]

    def get(self, request, slug):
        form = get_object_or_404(Form, slug=slug, is_active=True)
        return Response(FormSerializer(form).data)


class PublicFormSubmitView(APIView):
    """Receives form submissions. No auth needed."""
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request, slug):
        form = get_object_or_404(Form, slug=slug, is_active=True)

        ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", ""))[:50]
        ua = request.META.get("HTTP_USER_AGENT", "")[:500]

        submission = FormSubmission.objects.create(form=form, ip_address=ip, user_agent=ua)

        responses_data = request.data.get("responses", [])
        for resp in responses_data:
            field_id = resp.get("field_id")
            value = resp.get("value", "")
            try:
                field = FormField.objects.select_related("step__form").get(
                    id=field_id, step__form=form
                )
                FieldResponse.objects.create(
                    submission=submission,
                    field=field,
                    label_snapshot=field.label,
                    value=value,
                )
            except (FormField.DoesNotExist, Exception):
                pass

        # Increment response counter atomically
        Form.objects.filter(id=form.id).update(response_count=models.F("response_count") + 1)

        # Auto-create CRM customer
        if form.auto_create_customer and form.crm_mapping:
            customer = _build_crm_customer(form, responses_data)
            if customer:
                submission.customer = customer
                submission.save(update_fields=["customer"])

        return Response(
            {
                "status": "success",
                "submission_id": str(submission.id),
                "message": form.success_message,
                "redirect_url": form.redirect_url,
            },
            status=status.HTTP_201_CREATED,
        )


def _build_crm_customer(form, responses_data):
    """Extract CRM-mapped fields from submission and create/return a Customer."""
    from apps.crm.models import Customer

    by_field = {str(r.get("field_id")): r.get("value", "") for r in responses_data}
    crm_data = {}
    allowed = {"name", "email", "phone", "company", "address", "notes", "website"}

    for crm_field, field_id in form.crm_mapping.items():
        if crm_field not in allowed:
            continue
        val = by_field.get(str(field_id), "")
        if val:
            crm_data[crm_field] = str(val) if not isinstance(val, str) else val

    if not crm_data.get("name"):
        return None

    email = crm_data.get("email", "")
    if email:
        existing = Customer.objects.filter(email__iexact=email).first()
        if existing:
            return existing

    try:
        return Customer.objects.create(**crm_data)
    except Exception:
        return None
