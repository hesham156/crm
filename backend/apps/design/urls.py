from django.urls import path
from django.db import IntegrityError
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from .models import DesignSubmission
from rest_framework import serializers
from apps.accounts.permissions import IsDesignerOrAbove


class DesignSubmissionSerializer(serializers.ModelSerializer):
    designer_name = serializers.CharField(source="designer.full_name_en", read_only=True)
    file_url_display = serializers.SerializerMethodField()

    class Meta:
        model = DesignSubmission
        fields = [
            "id", "job", "designer", "designer_name", "version",
            "file", "file_url", "file_url_display", "filename",
            "status", "reviewer", "reviewer_notes",
            "submitted_at", "reviewed_at", "created_at"
        ]
        read_only_fields = ["designer", "version", "created_at"]

    def get_file_url_display(self, obj):
        req = self.context.get("request")
        if obj.file and req:
            try:
                return req.build_absolute_uri(obj.file.url)
            except Exception:
                pass
        return obj.file_url or None


class DesignSubmissionListCreate(generics.ListCreateAPIView):
    serializer_class = DesignSubmissionSerializer
    permission_classes = [IsDesignerOrAbove]

    def get_queryset(self):
        qs = DesignSubmission.objects.select_related("job", "designer").all()
        job_id = self.request.query_params.get("job")
        if job_id:
            qs = qs.filter(job_id=job_id)
        return qs

    def perform_create(self, serializer):
        job = serializer.validated_data.get("job")
        version = DesignSubmission.objects.filter(job=job).count() + 1
        try:
            serializer.save(designer=self.request.user, version=version)
        except IntegrityError:
            # Race condition: recalculate version and retry once
            version = DesignSubmission.objects.filter(job=job).count() + 1
            try:
                serializer.save(designer=self.request.user, version=version)
            except IntegrityError as e:
                raise ValidationError({"detail": f"Could not create submission: {e}"})


class DesignSubmissionDetail(generics.RetrieveUpdateAPIView):
    queryset = DesignSubmission.objects.all()
    serializer_class = DesignSubmissionSerializer
    permission_classes = [IsAuthenticated]


class SubmitForReview(APIView):
    permission_classes = [IsDesignerOrAbove]

    def post(self, request, pk):
        try:
            sub = DesignSubmission.objects.get(pk=pk)
            sub.status = "submitted"
            sub.submitted_at = timezone.now()
            sub.save()
            return Response(DesignSubmissionSerializer(sub, context={"request": request}).data)
        except DesignSubmission.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)


class ApproveRejectDesign(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, action):
        try:
            sub = DesignSubmission.objects.get(pk=pk)
            if action not in ("approve", "reject"):
                return Response({"detail": "Invalid action."}, status=400)
            sub.status = "approved" if action == "approve" else "rejected"
            sub.reviewer = request.user
            sub.reviewer_notes = request.data.get("notes", "")
            sub.reviewed_at = timezone.now()
            sub.save()
            return Response(DesignSubmissionSerializer(sub, context={"request": request}).data)
        except DesignSubmission.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)


urlpatterns = [
    path("submissions/", DesignSubmissionListCreate.as_view()),
    path("submissions/<uuid:pk>/", DesignSubmissionDetail.as_view()),
    path("submissions/<uuid:pk>/submit/", SubmitForReview.as_view()),
    path("submissions/<uuid:pk>/<str:action>/", ApproveRejectDesign.as_view()),
]
