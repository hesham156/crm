from django.urls import path
from . import views

urlpatterns = [
    path("",            views.BackupListView.as_view(),     name="backup_list"),
    path("create/",     views.BackupCreateView.as_view(),   name="backup_create"),
    path("stats/",      views.BackupStatsView.as_view(),    name="backup_stats"),
    path("import/",     views.BackupImportView.as_view(),   name="backup_import"),
    path("<str:filename>/",           views.BackupDeleteView.as_view(),   name="backup_delete"),
    path("<str:filename>/download/",  views.BackupDownloadView.as_view(), name="backup_download"),
    path("<str:filename>/restore/",   views.BackupRestoreView.as_view(),  name="backup_restore"),
]
