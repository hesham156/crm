from django.urls import path
from . import views

urlpatterns = [
    path("boards/", views.BoardListCreateView.as_view(), name="boards"),
    path("boards/<uuid:pk>/", views.BoardDetailView.as_view(), name="board_detail"),
    path("boards/<uuid:board_id>/columns/", views.ColumnListCreateView.as_view(), name="columns"),
    path("boards/<uuid:board_id>/automations/", views.BoardAutomationListCreateView.as_view(), name="board_automations"),
    path("columns/<uuid:pk>/", views.ColumnDetailView.as_view(), name="column_detail"),
    path("automations/<uuid:pk>/", views.BoardAutomationDetailView.as_view(), name="automation_detail"),
    path("tasks/", views.TaskListCreateView.as_view(), name="tasks"),
    path("tasks/<uuid:pk>/", views.TaskDetailView.as_view(), name="task_detail"),
    path("tasks/<uuid:pk>/move/", views.TaskMoveView.as_view(), name="task_move"),
    path("tasks/<uuid:pk>/timer/", views.TaskTimerToggleView.as_view(), name="task_timer"),
    path("tasks/<uuid:task_id>/comments/", views.CommentListCreateView.as_view(), name="task_comments"),
    path("tasks/<uuid:task_id>/time-log/", views.TimeLogCreateView.as_view(), name="task_timelog"),
    path("tasks/<uuid:task_id>/attachments/", views.TaskAttachmentView.as_view(), name="task_attachments"),
    path("tags/", views.TagListCreateView.as_view(), name="tags"),
    path("admin-overview/", views.AdminBoardsOverviewView.as_view(), name="admin_overview"),
]
