from django.urls import path
from . import views

urlpatterns = [
    path("customers/", views.CustomerListCreateView.as_view(), name="customers"),
    path("customers/<uuid:pk>/", views.CustomerDetailView.as_view(), name="customer_detail"),
    path("customers/<uuid:customer_id>/followups/", views.FollowUpListCreateView.as_view(), name="followups"),

    # Google Sheets → CRM sync
    path("sheets-sync/", views.GoogleSheetsSyncListCreateView.as_view(), name="sheets_sync_list"),
    path("sheets-sync/test/", views.SheetsSyncTestConnectionView.as_view(), name="sheets_sync_test"),
    path("sheets-sync/<uuid:pk>/", views.GoogleSheetsSyncDetailView.as_view(), name="sheets_sync_detail"),
    path("sheets-sync/<uuid:pk>/run/", views.SheetsSyncRunNowView.as_view(), name="sheets_sync_run"),
]
