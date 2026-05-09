from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GoogleSheetsIntegrationViewSet, SyncLogViewSet

router = DefaultRouter()
router.register(r'sheets', GoogleSheetsIntegrationViewSet)
router.register(r'logs', SyncLogViewSet, basename="synclog")

urlpatterns = [
    path('', include(router.urls)),
]
