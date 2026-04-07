from django.urls import path
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import ProductionStage
from rest_framework import serializers
from apps.accounts.permissions import IsProductionOrAbove


class ProductionStageSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source="assigned_to.full_name_en", read_only=True)

    class Meta:
        model = ProductionStage
        fields = [
            "id", "job", "stage_type", "status",
            "assigned_to", "assigned_to_name", "position",
            "started_at", "completed_at", "notes"
        ]


class StageListCreate(generics.ListCreateAPIView):
    serializer_class = ProductionStageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        job_id = self.request.query_params.get("job")
        qs = ProductionStage.objects.select_related("job", "assigned_to")
        if job_id:
            qs = qs.filter(job_id=job_id)
        return qs


class StageDetail(generics.RetrieveUpdateAPIView):
    queryset = ProductionStage.objects.all()
    serializer_class = ProductionStageSerializer
    permission_classes = [IsAuthenticated]


class StartStage(APIView):
    permission_classes = [IsProductionOrAbove]

    def post(self, request, pk):
        try:
            stage = ProductionStage.objects.get(pk=pk)
            stage.status = "in_progress"
            stage.started_at = timezone.now()
            stage.save()
            return Response(ProductionStageSerializer(stage).data)
        except ProductionStage.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)


class CompleteStage(APIView):
    permission_classes = [IsProductionOrAbove]

    def post(self, request, pk):
        try:
            stage = ProductionStage.objects.get(pk=pk)
            stage.status = "done"
            stage.completed_at = timezone.now()
            stage.save()
            return Response(ProductionStageSerializer(stage).data)
        except ProductionStage.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)


urlpatterns = [
    path("stages/", StageListCreate.as_view()),
    path("stages/<uuid:pk>/", StageDetail.as_view()),
    path("stages/<uuid:pk>/start/", StartStage.as_view()),
    path("stages/<uuid:pk>/complete/", CompleteStage.as_view()),
]
