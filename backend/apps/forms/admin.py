from django.contrib import admin
from .models import Form, FormStep, FormField, FormSubmission, FieldResponse


class FormStepInline(admin.TabularInline):
    model = FormStep
    extra = 0


class FormFieldInline(admin.TabularInline):
    model = FormField
    extra = 0


@admin.register(Form)
class FormAdmin(admin.ModelAdmin):
    list_display = ["title", "slug", "is_active", "response_count", "created_by", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["title", "slug"]
    inlines = [FormStepInline]
    readonly_fields = ["slug", "response_count", "created_at", "updated_at"]


@admin.register(FormStep)
class FormStepAdmin(admin.ModelAdmin):
    list_display = ["form", "title", "order"]
    inlines = [FormFieldInline]


@admin.register(FormField)
class FormFieldAdmin(admin.ModelAdmin):
    list_display = ["label", "field_type", "step", "required", "order"]
    list_filter = ["field_type", "required"]


class FieldResponseInline(admin.TabularInline):
    model = FieldResponse
    extra = 0
    readonly_fields = ["field", "label_snapshot", "value"]


@admin.register(FormSubmission)
class FormSubmissionAdmin(admin.ModelAdmin):
    list_display = ["form", "submitted_at", "is_read", "customer", "ip_address"]
    list_filter = ["is_read"]
    inlines = [FieldResponseInline]
    readonly_fields = ["submitted_at"]
