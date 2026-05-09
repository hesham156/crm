from django.urls import path
from . import views

urlpatterns = [
    # ── Protected (auth) ──────────────────────────────────────────────────────
    path("", views.FormListCreateView.as_view(), name="form_list"),
    path("<uuid:pk>/", views.FormDetailView.as_view(), name="form_detail"),
    path("<uuid:pk>/duplicate/", views.FormDuplicateView.as_view(), name="form_duplicate"),
    path("<uuid:form_id>/steps/", views.StepListCreateView.as_view(), name="step_list"),
    path("steps/<uuid:pk>/", views.StepDetailView.as_view(), name="step_detail"),
    path("steps/<uuid:step_id>/fields/", views.FieldListCreateView.as_view(), name="field_list"),
    path("steps/<uuid:step_id>/reorder/", views.FieldReorderView.as_view(), name="field_reorder"),
    path("fields/<uuid:pk>/", views.FieldDetailView.as_view(), name="field_detail"),
    path("<uuid:form_id>/submissions/", views.SubmissionListView.as_view(), name="submission_list"),
    path("submissions/<uuid:pk>/", views.SubmissionDetailView.as_view(), name="submission_detail"),

    # ── Public (no auth) ─────────────────────────────────────────────────────
    # NOTE: upload must come BEFORE the <slug> patterns or Django matches "upload" as a slug
    path("public/upload/", views.PublicFileUploadView.as_view(), name="public_upload"),
    path("public/<str:slug>/", views.PublicFormView.as_view(), name="public_form"),
    path("public/<str:slug>/submit/", views.PublicFormSubmitView.as_view(), name="public_submit"),
]
