from django.urls import path
from . import views

urlpatterns = [
    path("customers/", views.CustomerListCreateView.as_view(), name="customers"),
    path("customers/<uuid:pk>/", views.CustomerDetailView.as_view(), name="customer_detail"),
    path("customers/<uuid:customer_id>/followups/", views.FollowUpListCreateView.as_view(), name="followups"),
]
