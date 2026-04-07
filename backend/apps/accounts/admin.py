from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Department


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ["name_en", "name_ar", "code"]
    search_fields = ["name_en", "name_ar", "code"]


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["email", "full_name_en", "role", "department", "is_active"]
    list_filter = ["role", "is_active", "department"]
    search_fields = ["email", "full_name_en", "full_name_ar"]
    ordering = ["email"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal Info", {"fields": ("full_name_en", "full_name_ar", "phone", "avatar", "language")}),
        ("Role & Department", {"fields": ("role", "department")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined", "last_seen")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "full_name_en", "role", "password1", "password2"),
        }),
    )
    readonly_fields = ["date_joined", "last_seen"]
