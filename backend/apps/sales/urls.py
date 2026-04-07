from django.urls import path
from . import views

urlpatterns = [
    path("jobs/", views.JobListCreateView.as_view(), name="jobs"),
    path("jobs/<uuid:pk>/", views.JobDetailView.as_view(), name="job_detail"),
    path("jobs/<uuid:job_id>/quotations/", views.QuotationListCreateView.as_view(), name="job_quotations"),
    path("invoices/", views.InvoiceListCreateView.as_view(), name="invoices"),
]
