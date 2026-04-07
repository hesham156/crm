from django.urls import path
from . import views

urlpatterns = [
    path("", views.NotificationListView.as_view(), name="notifications"),
    path("mark-read/", views.MarkReadView.as_view(), name="mark_read"),
    path("unread-count/", views.UnreadCountView.as_view(), name="unread_count"),
]
