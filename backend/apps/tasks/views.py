from django.utils import timezone
from rest_framework import generics, status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Prefetch, Sum
from django.db import transaction

from .models import Board, Column, Task, Comment, TimeLog, TaskAttachment, Tag, BoardCustomField, Sprint
from .serializers import (
    BoardSerializer, ColumnSerializer, TaskSerializer,
    TaskDetailSerializer, CommentSerializer, TimeLogSerializer,
    TaskAttachmentSerializer, TagSerializer, BoardAutomationSerializer,
    BoardCustomFieldSerializer, SprintSerializer, AutomationLogSerializer
)
from .models import BoardAutomation, TaskActivity, AutomationLog
from apps.accounts.permissions import IsAdminOrManager


class BoardListCreateView(generics.ListCreateAPIView):
    serializer_class = BoardSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name"]

    def get_queryset(self):
        user = self.request.user
        if user.is_manager:
            return Board.objects.prefetch_related("columns", "members").all()
        return Board.objects.prefetch_related("columns", "members").filter(
            members=user
        ) | Board.objects.filter(created_by=user)

    def create(self, request, *args, **kwargs):
        if not request.user.is_admin:
            return Response({"detail": "Only admins can create boards."}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)


class BoardDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BoardSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Board.objects.prefetch_related("columns", "members").all()


class ColumnListCreateView(generics.ListCreateAPIView):
    serializer_class = ColumnSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        board_id = self.kwargs.get("board_id")
        return Column.objects.filter(board_id=board_id).order_by("position")

    def perform_create(self, serializer):
        board_id = self.kwargs.get("board_id")
        max_pos = Column.objects.filter(board_id=board_id).count()
        serializer.save(board_id=board_id, position=max_pos)


class ColumnDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Column.objects.all()
    serializer_class = ColumnSerializer
    permission_classes = [IsAuthenticated]


class BoardAutomationListCreateView(generics.ListCreateAPIView):
    serializer_class = BoardAutomationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        board_id = self.kwargs.get("board_id")
        return BoardAutomation.objects.filter(board_id=board_id)

    def create(self, request, *args, **kwargs):
        if not request.user.is_admin:
            return Response({"detail": "Only admins can create automations."}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        board_id = self.kwargs.get("board_id")
        serializer.save(board_id=board_id)


class BoardAutomationDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = BoardAutomation.objects.all()
    serializer_class = BoardAutomationSerializer
    permission_classes = [IsAuthenticated]


class TaskListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["board", "column", "priority", "is_archived", "assigned_to"]
    search_fields = ["title", "description"]
    ordering_fields = ["position", "due_date", "created_at"]

    def get_queryset(self):
        return Task.objects.select_related(
            "board", "column", "created_by"
        ).prefetch_related("assigned_to", "tags").filter(is_archived=False)


class TaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "GET":
            return TaskDetailSerializer
        return TaskSerializer

    def get_queryset(self):
        return Task.objects.select_related(
            "board", "column", "created_by"
        ).prefetch_related("assigned_to", "tags", "comments", "attachments", "time_logs")


class TaskMoveView(APIView):
    """Handle Kanban drag & drop — move task to new column/position."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        new_column_id = request.data.get("column_id")
        new_position = int(request.data.get("position", 0))

        with transaction.atomic():
            try:
                task = Task.objects.select_for_update().get(pk=pk)
            except Task.DoesNotExist:
                return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

            if new_column_id:
                old_column_id = task.column_id

                if str(old_column_id) != str(new_column_id):
                    new_col = Column.objects.filter(id=new_column_id).first()
                    if new_col and new_col.name.lower() == "done":
                        is_blocked = task.blocked_by.filter(is_archived=False).exclude(column__name__iexact="Done").exists()
                        if is_blocked:
                            return Response({"detail": "Cannot move task to Done while waiting on blocking tasks."}, status=status.HTTP_400_BAD_REQUEST)

                # Shift positions in old column
                Task.objects.select_for_update().filter(
                    column_id=old_column_id, position__gt=task.position, is_archived=False
                ).update(position=models.F("position") - 1)

                # Shift positions in new column
                Task.objects.select_for_update().filter(
                    column_id=new_column_id, position__gte=new_position, is_archived=False
                ).exclude(pk=pk).update(position=models.F("position") + 1)

                task.column_id = new_column_id
                task.position = new_position
                task.save(update_fields=["column_id", "position"])

                if str(old_column_id) != str(new_column_id):
                    old_col = Column.objects.filter(id=old_column_id).first()
                    new_col = Column.objects.filter(id=new_column_id).first()
                    TaskActivity.objects.create(
                        task=task, user=request.user, field_changed="column",
                        old_value=old_col.name if old_col else "Unknown",
                        new_value=new_col.name if new_col else "Unknown"
                    )

                    from .automation_service import run_task_automations
                    run_task_automations(task, "column_change", str(new_column_id), user=request.user)

        return Response(TaskSerializer(task, context={"request": request}).data)


class CommentListCreateView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        task_id = self.kwargs.get("task_id")
        return Comment.objects.select_related("author").filter(task_id=task_id)

    def perform_create(self, serializer):
        task_id = self.kwargs.get("task_id")
        comment = serializer.save(task_id=task_id, author=self.request.user)
        
        mentions = comment.mentions.all()
        if mentions.exists():
            from apps.notifications.models import send_notification
            recipient_ids = [m.id for m in mentions]
            task = comment.task
            try:
                send_notification(
                    recipient_ids=recipient_ids,
                    title=f"You were mentioned by {self.request.user.full_name_en}",
                    body=f"{task.title}: {comment.body[:50]}...",
                    type="mention",
                    link=f"/tasks/{task.board_id}?taskId={task.id}",
                    sender=self.request.user
                )
            except Exception as e:
                import logging
                logger = logging.getLogger("apps")
                logger.error(f"Failed to send mention notification: {e}", exc_info=True)


class TimeLogCreateView(generics.CreateAPIView):
    serializer_class = TimeLogSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        task_id = self.kwargs.get("task_id")
        serializer.save(task_id=task_id, user=self.request.user)

class TaskTimerToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            task = Task.objects.get(pk=pk)
        except Task.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get("action")
        if action == "start":
            if not task.is_timer_running:
                task.is_timer_running = True
                task.timer_started_at = timezone.now()
                task.save(update_fields=["is_timer_running", "timer_started_at"])
        elif action == "stop":
            if task.is_timer_running and task.timer_started_at:
                delta = timezone.now() - task.timer_started_at
                minutes = int(delta.total_seconds() / 60)
                if minutes > 0:
                    TimeLog.objects.create(
                        task=task,
                        user=request.user,
                        duration=minutes,
                        note="Tracked via timer"
                    )
                    task.time_logged = task.time_logs.aggregate(total=Sum("duration"))["total"] or 0
                task.is_timer_running = False
                task.timer_started_at = None
                task.save(update_fields=["is_timer_running", "timer_started_at", "time_logged"])
        else:
            return Response({"detail": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST)

        return Response(TaskSerializer(task, context={"request": request}).data)

class TaskAttachmentView(generics.ListCreateAPIView):
    serializer_class = TaskAttachmentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        task_id = self.kwargs.get("task_id")
        return TaskAttachment.objects.filter(task_id=task_id)

    def perform_create(self, serializer):
        task_id = self.kwargs.get("task_id")
        attachment_type = self.request.data.get("attachment_type", "file")

        if attachment_type == "link":
            external_url = self.request.data.get("external_url", "")
            filename = self.request.data.get("filename") or external_url
            serializer.save(
                task_id=task_id,
                uploaded_by=self.request.user,
                attachment_type="link",
                file=None,
                external_url=external_url,
                filename=filename,
                file_size=0,
            )
        else:
            file = self.request.FILES.get("file")
            if not file:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({"file": "No file was provided."})
            serializer.save(
                task_id=task_id,
                uploaded_by=self.request.user,
                attachment_type="file",
                file=file,
                filename=file.name,
                file_size=file.size,
                external_url="",
            )



class TaskAttachmentDeleteView(generics.DestroyAPIView):
    serializer_class = TaskAttachmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TaskAttachment.objects.all()


class CommentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Edit or delete a comment (author only)."""
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Comment.objects.select_related("author").all()

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            if obj.author != request.user and not request.user.is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You can only edit or delete your own comments.")


class TaskBulkActionView(APIView):
    """Bulk archive / delete / assign / set priority for multiple tasks."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        task_ids = request.data.get("task_ids", [])
        action = request.data.get("action")
        payload = request.data.get("payload", {})

        if not task_ids or not action:
            return Response({"detail": "task_ids and action are required."}, status=status.HTTP_400_BAD_REQUEST)

        tasks = Task.objects.filter(id__in=task_ids)

        if action == "archive":
            tasks.update(is_archived=True)
        elif action == "unarchive":
            tasks.update(is_archived=False)
        elif action == "delete":
            if not request.user.is_admin:
                return Response({"detail": "Only admins can bulk delete tasks."}, status=status.HTTP_403_FORBIDDEN)
            tasks.delete()
        elif action == "set_priority":
            priority = payload.get("priority")
            if priority not in ["low", "normal", "high", "urgent"]:
                return Response({"detail": "Invalid priority."}, status=status.HTTP_400_BAD_REQUEST)
            tasks.update(priority=priority)
        elif action == "move_column":
            column_id = payload.get("column_id")
            if not column_id:
                return Response({"detail": "column_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            tasks.update(column_id=column_id)
        elif action == "assign":
            user_ids = payload.get("user_ids", [])
            from apps.accounts.models import User
            assignees = User.objects.filter(id__in=user_ids)
            for task in tasks:
                task.assigned_to.set(assignees)
        else:
            return Response({"detail": f"Unknown action: {action}"}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"updated": len(task_ids)})


class WorkloadView(APIView):
    """Per-user task count + estimated hours for a board."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        board_id = request.query_params.get("board")
        qs = Task.objects.filter(is_archived=False, parent__isnull=True)
        if board_id:
            qs = qs.filter(board_id=board_id)

        from apps.accounts.models import User
        users = User.objects.filter(is_active=True).prefetch_related("task_assignments")

        result = []
        for user in users:
            user_tasks = qs.filter(assigned_to=user)
            overdue = user_tasks.filter(
                due_date__lt=timezone.now().date(), is_archived=False
            ).exclude(column__name__iexact="done").count()
            result.append({
                "user_id": str(user.id),
                "user_name": user.full_name_en,
                "role": user.role,
                "total_tasks": user_tasks.count(),
                "estimated_hours": round((user_tasks.aggregate(s=Sum("estimated_minutes"))["s"] or 0) / 60, 1),
                "time_logged_hours": round((user_tasks.aggregate(s=Sum("time_logged"))["s"] or 0) / 60, 1),
                "overdue_tasks": overdue,
                "by_priority": {
                    "urgent": user_tasks.filter(priority="urgent").count(),
                    "high": user_tasks.filter(priority="high").count(),
                    "normal": user_tasks.filter(priority="normal").count(),
                    "low": user_tasks.filter(priority="low").count(),
                },
            })

        result.sort(key=lambda x: x["total_tasks"], reverse=True)
        return Response(result)


class ArchivedTaskListView(generics.ListAPIView):
    """List archived tasks for a board."""
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        board_id = self.request.query_params.get("board")
        qs = Task.objects.select_related("board", "column", "created_by").prefetch_related("assigned_to", "tags").filter(is_archived=True)
        if board_id:
            qs = qs.filter(board_id=board_id)
        return qs.order_by("-updated_at")


class TaskSpawnRecurrenceView(APIView):
    """Manually spawn the next occurrence of a recurring task."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from datetime import timedelta
        from django.utils import timezone

        try:
            task = Task.objects.get(pk=pk)
        except Task.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if task.recurrence_rule == "none":
            return Response({"detail": "Task is not recurring."}, status=status.HTTP_400_BAD_REQUEST)

        # Calculate next due date
        base_date = task.due_date or timezone.now().date()
        if task.recurrence_rule == "daily":
            next_due = base_date + timedelta(days=1)
        elif task.recurrence_rule == "weekly":
            next_due = base_date + timedelta(weeks=1)
        elif task.recurrence_rule == "monthly":
            from dateutil.relativedelta import relativedelta
            next_due = base_date + relativedelta(months=1)
        else:  # custom
            next_due = base_date + timedelta(days=task.recurrence_interval)

        if task.recurrence_end_date and next_due > task.recurrence_end_date:
            return Response({"detail": "Recurrence end date reached."}, status=status.HTTP_400_BAD_REQUEST)

        # Find the first column (To Do) in the board
        first_column = Column.objects.filter(board=task.board).order_by("position").first()

        new_task = Task.objects.create(
            board=task.board,
            column=first_column or task.column,
            title=task.title,
            description=task.description,
            priority=task.priority,
            estimated_minutes=task.estimated_minutes,
            client_status="Pending",
            due_date=next_due,
            recurring_parent=task,
            created_by=request.user,
        )
        new_task.assigned_to.set(task.assigned_to.all())
        new_task.tags.set(task.tags.all())

        return Response(TaskSerializer(new_task, context={"request": request}).data, status=status.HTTP_201_CREATED)


class BoardCustomFieldListCreateView(generics.ListCreateAPIView):
    serializer_class = BoardCustomFieldSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        board_id = self.kwargs.get("board_id")
        return BoardCustomField.objects.filter(board_id=board_id).order_by("position")

    def perform_create(self, serializer):
        board_id = self.kwargs.get("board_id")
        max_pos = BoardCustomField.objects.filter(board_id=board_id).count()
        serializer.save(board_id=board_id, position=max_pos)


class BoardCustomFieldDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = BoardCustomField.objects.all()
    serializer_class = BoardCustomFieldSerializer
    permission_classes = [IsAuthenticated]


class SprintListCreateView(generics.ListCreateAPIView):
    serializer_class = SprintSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        board_id = self.kwargs.get("board_id")
        return Sprint.objects.filter(board_id=board_id).order_by("-created_at")

    def perform_create(self, serializer):
        board_id = self.kwargs.get("board_id")
        serializer.save(board_id=board_id, created_by=self.request.user)


class SprintDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SprintSerializer
    permission_classes = [IsAuthenticated]
    queryset = Sprint.objects.all()

    def perform_update(self, serializer):
        sprint = serializer.save()
        # When completing a sprint, calculate velocity from completed story points
        if sprint.status == "completed":
            done_columns = Column.objects.filter(board=sprint.board, name__iexact="done")
            done_column_ids = list(done_columns.values_list("id", flat=True))
            total_points = sprint.tasks.filter(
                column_id__in=done_column_ids
            ).aggregate(total=Sum("story_points"))["total"] or 0
            Sprint.objects.filter(pk=sprint.pk).update(velocity=total_points)


class TagListCreateView(generics.ListCreateAPIView):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]


# Fix missing import
from django.db import models


class AdminBoardsOverviewView(APIView):
    """Admin-only view returning all boards with columns + tasks for monitoring."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Only admins/managers can access
        if not (request.user.is_manager or request.user.role in ['admin', 'manager']):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        boards = Board.objects.prefetch_related(
            Prefetch(
                'columns',
                queryset=Column.objects.order_by('position').prefetch_related(
                    Prefetch(
                        'tasks',
                        queryset=Task.objects.filter(
                            is_archived=False, parent__isnull=True
                        ).prefetch_related('assigned_to', 'tags').order_by('position', '-created_at')
                    )
                )
            ),
            'members'
        ).all().order_by('-created_at')

        result = []
        for board in boards:
            board_data = {
                'id': str(board.id),
                'name': board.name,
                'description': board.description,
                'color': board.color,
                'icon': board.icon,
                'is_private': board.is_private,
                'task_count': board.tasks.filter(is_archived=False).count(),
                'members': [
                    {'id': str(m.id), 'full_name_en': m.full_name_en, 'role': m.role}
                    for m in board.members.all()
                ],
                'created_at': board.created_at.isoformat(),
                'columns': []
            }
            for col in board.columns.all():
                col_data = {
                    'id': str(col.id),
                    'name': col.name,
                    'color': col.color,
                    'position': col.position,
                    'task_count': col.tasks.filter(is_archived=False, parent__isnull=True).count(),
                    'tasks': []
                }
                for task in col.tasks.all():
                    assignees = [
                        {'id': str(a.id), 'full_name_en': a.full_name_en}
                        for a in task.assigned_to.all()
                    ]
                    col_data['tasks'].append({
                        'id': str(task.id),
                        'title': task.title,
                        'priority': task.priority,
                        'client_status': task.client_status,
                        'due_date': task.due_date.isoformat() if task.due_date else None,
                        'assigned_to': assignees,
                        'column_name': col.name,
                        'column_color': col.color,
                        'board_id': str(board.id),
                        'board_name': board.name,
                        'subtasks_count': task.subtasks.filter(is_archived=False).count(),
                        'estimated_minutes': task.estimated_minutes,
                        'created_at': task.created_at.isoformat(),
                    })
                board_data['columns'].append(col_data)
            result.append(board_data)

        return Response(result)


class GlobalTaskTrackerView(APIView):
    """
    Returns ALL non-archived tasks across all boards with journey info.
    Used by the Pipeline Tracker page for cross-board task visibility.
    Accessible to admins and managers.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_manager or request.user.role in ['admin', 'manager']):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        tasks = Task.objects.select_related(
            "board", "column", "created_by", "origin_board"
        ).prefetch_related(
            "assigned_to",
            "activities"
        ).filter(is_archived=False, parent__isnull=True).order_by("-created_at")

        result = []
        for task in tasks:
            # Pull board-transition activities to build the journey
            board_activities = [
                a for a in task.activities.all()
                if "board" in (a.field_changed or "").lower()
            ]

            journey_steps = []
            # First step = origin board
            if task.origin_board_id:
                journey_steps.append({
                    "board_name": task.origin_board.name if task.origin_board else "Unknown",
                    "timestamp": task.created_at.isoformat(),
                    "label": "Created",
                })
            # Middle steps = each board transition logged in activities
            for act in board_activities:
                journey_steps.append({
                    "board_name": act.new_value,
                    "timestamp": act.timestamp.isoformat(),
                    "label": act.field_changed,
                })

            result.append({
                "id": str(task.id),
                "title": task.title,
                "priority": task.priority,
                "client_status": task.client_status,
                "due_date": task.due_date.isoformat() if task.due_date else None,
                "created_at": task.created_at.isoformat(),
                # Current position
                "board_id": str(task.board_id),
                "board_name": task.board.name if task.board else "Unknown",
                "board_color": task.board.color if task.board else "#94a3b8",
                "column_name": task.column.name if task.column else "Unknown",
                "column_color": task.column.color if task.column else "gray",
                # Origin info
                "origin_board_id": str(task.origin_board_id) if task.origin_board_id else None,
                "origin_board_name": task.origin_board.name if task.origin_board else None,
                # Assignees
                "assigned_to": [
                    {"id": str(a.id), "full_name_en": a.full_name_en}
                    for a in task.assigned_to.all()
                ],
                # Full journey
                "journey": journey_steps,
                "boards_visited": len(set([s["board_name"] for s in journey_steps])),
                "is_cross_board": bool(task.origin_board_id and str(task.origin_board_id) != str(task.board_id)),
            })

        return Response(result)


class AutomationLogListView(generics.ListAPIView):
    serializer_class = AutomationLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        board_id = self.kwargs.get("board_id")
        qs = AutomationLog.objects.select_related("automation", "task").filter(
            automation__board_id=board_id
        )
        automation_id = self.request.query_params.get("automation_id")
        if automation_id:
            qs = qs.filter(automation_id=automation_id)
        return qs[:200]

