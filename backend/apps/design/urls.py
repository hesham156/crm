import os
import tempfile
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
import logging

logger = logging.getLogger("apps")


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
        # Disable ModelSerializer uniqueness validation since we calculate version
        # dynamically in perform_create and catch IntegrityErrors there.
        validators = []

    def get_file_url_display(self, obj):
        # Prefer Google Drive URL if available
        if obj.file_url:
            return obj.file_url
        req = self.context.get("request")
        if obj.file and req:
            try:
                return req.build_absolute_uri(obj.file.url)
            except Exception:
                pass
        return None


def _upload_to_drive(file_obj, filename, parent_id=None):
    """
    Upload a file-like object to Google Drive.
    Returns (file_id, web_view_link) or (None, None) on failure.
    """
    try:
        from utils.google_drive import get_drive_service
        from googleapiclient.http import MediaIoBaseUpload
        import mimetypes

        service = get_drive_service()
        if not service:
            logger.warning("Google Drive service unavailable — skipping Drive upload.")
            return None, None

        mime_type, _ = mimetypes.guess_type(filename)
        mime_type = mime_type or "application/octet-stream"

        file_metadata = {"name": filename}
        if parent_id:
            file_metadata["parents"] = [parent_id]

        media = MediaIoBaseUpload(file_obj, mimetype=mime_type, resumable=True)
        created = service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id, webViewLink"
        ).execute()

        file_id = created.get("id")
        # Make readable by anyone with the link
        service.permissions().create(
            fileId=file_id,
            body={"type": "anyone", "role": "reader"},
            fields="id"
        ).execute()

        return file_id, created.get("webViewLink")
    except Exception as e:
        logger.error(f"Google Drive upload error: {e}", exc_info=True)
        return None, None


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

        # ── Handle Google Drive upload ────────────────────────────────────────
        uploaded_file = self.request.FILES.get("file")
        file_url = ""
        filename = serializer.validated_data.get("filename", "")

        if uploaded_file:
            filename = filename or uploaded_file.name
            parent_id = job.drive_folder_id if job else None
            _, drive_link = _upload_to_drive(uploaded_file, filename, parent_id=parent_id)
            if drive_link:
                file_url = drive_link
                logger.info(f"Design uploaded to Drive: {drive_link}")
            else:
                logger.warning("Drive upload failed — will save file locally as fallback.")

        # ── Save submission ───────────────────────────────────────────────────
        try:
            if file_url:
                # Drive upload succeeded — store URL, clear the file field
                serializer.save(
                    designer=self.request.user,
                    version=version,
                    file_url=file_url,
                    filename=filename,
                    file=None,  # Don't store locally
                )
            else:
                # Fallback: store locally (needs local media storage)
                serializer.save(
                    designer=self.request.user,
                    version=version,
                    filename=filename or (uploaded_file.name if uploaded_file else ""),
                )
        except IntegrityError:
            # Race condition: recalculate version and retry once
            version = DesignSubmission.objects.filter(job=job).count() + 1
            try:
                serializer.save(
                    designer=self.request.user,
                    version=version,
                    file_url=file_url,
                    filename=filename,
                    file=None if file_url else serializer.validated_data.get("file"),
                )
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
            sub = DesignSubmission.objects.select_related("designer", "job").get(pk=pk)
            if action not in ("approve", "reject"):
                return Response({"detail": "Invalid action."}, status=400)

            is_approved = action == "approve"
            sub.status = "approved" if is_approved else "rejected"
            sub.reviewer = request.user
            sub.reviewer_notes = request.data.get("notes", "")
            sub.reviewed_at = timezone.now()
            sub.save()

            # 🔔 Notify the designer
            if sub.designer_id and sub.designer_id != request.user.id:
                try:
                    from apps.notifications.models import send_notification
                    notif_type = "design_approved" if is_approved else "design_rejected"
                    status_ar  = "تمت الموافقة" if is_approved else "مرفوض"
                    job_ref    = sub.job.job_number if sub.job else "غير محدد"
                    notes_txt  = f" | ملاحظة: {sub.reviewer_notes}" if sub.reviewer_notes else ""
                    send_notification(
                        recipient_ids=[str(sub.designer_id)],
                        title=f"تصميمك {status_ar} — طلب {job_ref}",
                        body=f"تصميم الإصدار {sub.version} لطلب {job_ref} {status_ar}.{notes_txt}",
                        type=notif_type,
                        link=f"/design?job={sub.job_id}",
                        sender=request.user,
                    )
                except Exception as e:
                    logger.warning(f"Failed to send design review notification: {e}")

            return Response(DesignSubmissionSerializer(sub, context={"request": request}).data)
        except DesignSubmission.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)


urlpatterns = [
    path("submissions/", DesignSubmissionListCreate.as_view()),
    path("submissions/<uuid:pk>/", DesignSubmissionDetail.as_view()),
    path("submissions/<uuid:pk>/submit/", SubmitForReview.as_view()),
    path("submissions/<uuid:pk>/<str:action>/", ApproveRejectDesign.as_view()),
]
