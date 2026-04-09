from django.utils import timezone
from rest_framework import generics, status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Prefetch

from .models import Board, Column, Task, Comment, TimeLog, TaskAttachment, Tag
from .serializers import (
    BoardSerializer, ColumnSerializer, TaskSerializer,
    TaskDetailSerializer, CommentSerializer, TimeLogSerializer,
    TaskAttachmentSerializer, TagSerializer, BoardAutomationSerializer
)
from .models import BoardAutomation, TaskActivity
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
        try:
            task = Task.objects.get(pk=pk)
        except Task.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        new_column_id = request.data.get("column_id")
        new_position = request.data.get("position", 0)

        if new_column_id:
            old_column_id = task.column_id

            # Shift positions in old column
            Task.objects.filter(
                column_id=old_column_id, position__gt=task.position, is_archived=False
            ).update(position=models.F("position") - 1)

            # Shift positions in new column
            Task.objects.filter(
                column_id=new_column_id, position__gte=new_position, is_archived=False
            ).exclude(pk=pk).update(position=models.F("position") + 1)

            task.column_id = new_column_id
            task.position = new_position
            task.save(update_fields=["column_id", "position"])

            if str(old_column_id) != str(new_column_id):
                # Log Activity
                old_col = Column.objects.filter(id=old_column_id).first()
                new_col = Column.objects.filter(id=new_column_id).first()
                TaskActivity.objects.create(
                    task=task, user=request.user, field_changed="column",
                    old_value=old_col.name if old_col else "Unknown",
                    new_value=new_col.name if new_col else "Unknown"
                )
                
                # Check Automations
                automations = BoardAutomation.objects.filter(
                    board=task.board,
                    trigger_type="column_change",
                    trigger_value=str(new_column_id),
                    is_active=True
                )
                for auto in automations:
                    for action in auto.actions:
                        if action.get("type") == "move_to_column":
                            # Note: To avoid infinite loop, we move it but don't recursively check
                            target_col_id = action.get("value")
                            if target_col_id:
                                task.column_id = target_col_id
                                max_pos = Task.objects.filter(column_id=target_col_id, is_archived=False).count()
                                task.position = max_pos
                                task.save(update_fields=["column_id", "position"])
                                
                                TaskActivity.objects.create(
                                    task=task, user=None, field_changed="column (Automation)",
                                    old_value=task.column.name,
                                    new_value=str(target_col_id)
                                )

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


class TaskAttachmentView(generics.ListCreateAPIView):
    serializer_class = TaskAttachmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        task_id = self.kwargs.get("task_id")
        return TaskAttachment.objects.filter(task_id=task_id)

    def perform_create(self, serializer):
        task_id = self.kwargs.get("task_id")
        file = self.request.FILES.get("file")
        serializer.save(
            task_id=task_id,
            uploaded_by=self.request.user,
            filename=file.name if file else "",
            file_size=file.size if file else 0,
        )


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
                        'created_at': task.created_at.isoformat(),
                    })
                board_data['columns'].append(col_data)
            result.append(board_data)

        return Response(result)
