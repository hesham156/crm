from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt


@csrf_exempt
def data_deletion_view(request):
    """
    Facebook/Meta Data Deletion Callback URL.
    Required for Facebook Login compliance.
    Responds to both GET (status check) and POST (deletion request).
    """
    if request.method == "POST":
        return JsonResponse({
            "url": f"{request.scheme}://{request.get_host()}/data-deletion",
            "confirmation_code": "prosticker_data_deleted",
            "status": "success",
            "message": "Your data deletion request has been received and will be processed within 30 days.",
        }, status=200)

    # GET - status page
    return JsonResponse({
        "status": "ok",
        "message": "Data Deletion Request endpoint is active.",
        "instructions": "Send a POST request to this URL to initiate a data deletion request.",
    }, status=200)

urlpatterns = [
    path("admin/", admin.site.urls),

    # Meta/Facebook compliance
    path("data-deletion", data_deletion_view, name="data-deletion"),
    path("data-deletion/", data_deletion_view, name="data-deletion-slash"),

    # Auth
    path("api/auth/", include("apps.accounts.urls")),

    # Core modules
    path("api/tasks/", include("apps.tasks.urls")),
    path("api/crm/", include("apps.crm.urls")),
    path("api/sales/", include("apps.sales.urls")),
    path("api/design/", include("apps.design.urls")),
    path("api/production/", include("apps.production.urls")),
    path("api/inventory/", include("apps.inventory.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/analytics/", include("apps.analytics.urls")),
    path("api/backup/",       include("apps.backup.urls")),
    path("api/integrations/", include("apps.integrations.urls")),
    path("api/forms/", include("apps.forms.urls")),
]

# Serve media & static files (nginx handles this in production, but needed as fallback)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
