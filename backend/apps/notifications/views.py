from rest_framework import generics, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Notification
from .serializers import NotificationSerializer

from django.db.models import Q

class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Notification.objects.filter(
            recipient=self.request.user
        ).select_related("sender")

        tab = self.request.query_params.get("tab", "all")
        if tab == "mentioned":
            qs = qs.filter(type="mention")
        elif tab == "assigned":
            qs = qs.filter(type="task_assigned")

        unread_only = self.request.query_params.get("unread_only", "false")
        if unread_only.lower() == "true":
            qs = qs.filter(is_read=False)

        search = self.request.query_params.get("search", "")
        if search:
            qs = qs.filter(
                Q(title__icontains=search) |
                Q(body__icontains=search) |
                Q(sender__full_name_en__icontains=search) |
                Q(sender__full_name_ar__icontains=search)
            )

        return qs[:50]


class MarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ids = request.data.get("ids", [])
        if ids:
            Notification.objects.filter(
                recipient=request.user, id__in=ids
            ).update(is_read=True)
        else:
            # Mark all
            Notification.objects.filter(
                recipient=request.user, is_read=False
            ).update(is_read=True)
        return Response({"detail": "Marked as read."})


class UnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).count()
        return Response({"count": count})
