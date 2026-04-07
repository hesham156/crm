from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),

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
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
