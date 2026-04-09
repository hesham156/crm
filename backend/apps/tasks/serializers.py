from rest_framework import serializers
from apps.accounts.serializers import UserListSerializer
from .models import Board, Column, Task, Comment, TimeLog, TaskAttachment, Tag, BoardAutomation, TaskActivity


class TaskActivitySerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name_en", read_only=True)

    class Meta:
        model = TaskActivity
        fields = ["id", "task", "user", "user_name", "field_changed", "old_value", "new_value", "timestamp"]
        read_only_fields = ["timestamp", "user"]


class BoardAutomationSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoardAutomation
        fields = [
            "id", "board", "trigger_type", "trigger_value", 
            "actions", "label_text", "is_active", "created_at"
        ]
        read_only_fields = ["created_at", "board"]


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "color"]


class ColumnSerializer(serializers.ModelSerializer):
    task_count = serializers.SerializerMethodField()

    class Meta:
        model = Column
        fields = ["id", "board", "name", "color", "position", "task_count"]
        read_only_fields = ["board", "position"]

    def get_task_count(self, obj):
        return obj.tasks.filter(is_archived=False).count()


class TaskAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source="uploaded_by.full_name_en", read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = TaskAttachment
        fields = ["id", "filename", "file_url", "file_size", "uploaded_by", "uploaded_by_name", "uploaded_at"]
        read_only_fields = ["uploaded_at"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.full_name_en", read_only=True)
    author_avatar = serializers.SerializerMethodField()
    mention_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, queryset=__import__("apps.accounts.models", fromlist=["User"]).User.objects.all(),
        source="mentions", required=False
    )

    class Meta:
        model = Comment
        fields = ["id", "task", "author", "author_name", "author_avatar", "body", "mention_ids", "created_at", "updated_at"]
        read_only_fields = ["task", "author", "created_at", "updated_at"]

    def get_author_avatar(self, obj):
        request = self.context.get("request")
        if obj.author and obj.author.avatar and request:
            return request.build_absolute_uri(obj.author.avatar.url)
        return None

    def create(self, validated_data):
        mentions = validated_data.pop("mentions", [])
        validated_data["author"] = self.context["request"].user
        comment = super().create(validated_data)
        if mentions:
            comment.mentions.set(mentions)
        return comment


class TimeLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name_en", read_only=True)

    class Meta:
        model = TimeLog
        fields = ["id", "task", "user", "user_name", "duration", "note", "logged_at"]
        read_only_fields = ["task", "user", "logged_at"]

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        timelog = super().create(validated_data)
        # Update total time on task
        task = timelog.task
        task.time_logged = sum(tl.duration for tl in task.time_logs.all())
        task.save(update_fields=["time_logged"])
        return timelog


class TaskSerializer(serializers.ModelSerializer):
    assigned_to = UserListSerializer(many=True, read_only=True)
    assigned_to_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, queryset=__import__("apps.accounts.models", fromlist=["User"]).User.objects.all(),
        source="assigned_to", required=False
    )
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, queryset=Tag.objects.all(), source="tags", required=False
    )
    subtasks_count = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()
    column_name = serializers.CharField(source="column.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name_en", read_only=True)
    blocked_by_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, queryset=Task.objects.all(), source="blocked_by", required=False
    )
    is_blocked = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id", "board", "column", "column_name", "parent",
            "title", "description",
            "created_by", "created_by_name",
            "assigned_to", "assigned_to_ids",
            "priority", "start_date", "due_date", "position",
            "client_status", "is_checked",
            "time_logged", "tags", "tag_ids",
            "job", "is_archived",
            "subtasks_count", "comments_count",
            "blocked_by", "blocked_by_ids", "is_blocked",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_by", "time_logged", "created_at", "updated_at", "blocked_by"]

    def get_is_blocked(self, obj):
        return obj.blocked_by.filter(is_archived=False).exclude(column__name__iexact="Done").exists()

    def get_subtasks_count(self, obj):
        return obj.subtasks.filter(is_archived=False).count()

    def get_comments_count(self, obj):
        return obj.comments.count()

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        
        column = validated_data.get("column")
        if column:
            max_pos = Task.objects.filter(column=column, is_archived=False).count()
            validated_data["position"] = max_pos
            
        task = super().create(validated_data)
        
        # Evaluate automations (Wait until transaction completes, but ok in simple synchronous flow)
        self._run_automations(task, "item_created", "")
        
        # Notify assignees
        new_assignees = set(task.assigned_to.values_list('id', flat=True))
        if new_assignees:
            try:
                from apps.notifications.models import send_notification
                send_notification(
                    recipient_ids=list(new_assignees),
                    title=f"New Task Assigned",
                    body=f"You have been assigned to task: {task.title[:30]}",
                    type="task_assigned",
                    link=f"/tasks/{task.board_id}?taskId={task.id}",
                    sender=self.context["request"].user
                )
            except Exception as e:
                import logging
                logger = logging.getLogger("apps")
                logger.error(f"Failed to send task assignment notification: {e}", exc_info=True)

        return task

    def update(self, instance, validated_data):
        # Capture old values
        old_client_status = instance.client_status
        old_column_id = instance.column_id
        old_priority = instance.priority
        old_title = instance.title
        old_assignees = set(instance.assigned_to.values_list('id', flat=True))

        # Validate blocked dependencies if they are trying to move it to a specific column like "Done".
        # For simplicity, if they change column to something with "Done", verify it's not blocked.
        new_column = validated_data.get("column")
        if new_column and old_column_id != new_column.id and new_column.name.lower() == "done":
            if self.get_is_blocked(instance):
                raise serializers.ValidationError({"column": "Cannot move task to Done while waiting on blocking tasks."})

        task = super().update(instance, validated_data)
        
        new_assignees = set(task.assigned_to.values_list('id', flat=True))
        added_assignees = new_assignees - old_assignees
        if added_assignees:
            try:
                from apps.notifications.models import send_notification
                send_notification(
                    recipient_ids=list(added_assignees),
                    title=f"New Task Assigned",
                    body=f"You have been assigned to task: {task.title[:30]}",
                    type="task_assigned",
                    link=f"/tasks/{task.board_id}?taskId={task.id}",
                    sender=self.context["request"].user
                )
            except Exception as e:
                import logging
                logger = logging.getLogger("apps")
                logger.error(f"Failed to send task assignment notification: {e}", exc_info=True)

        # Log Activity Changes
        user = self.context["request"].user
        
        if old_column_id != task.column_id:
            old_col = Column.objects.filter(id=old_column_id).first()
            TaskActivity.objects.create(
                task=task, user=user, field_changed="column",
                old_value=old_col.name if old_col else "Unknown",
                new_value=task.column.name
            )
            
        if old_client_status != task.client_status:
            TaskActivity.objects.create(
                task=task, user=user, field_changed="client_status",
                old_value=old_client_status, new_value=task.client_status
            )
            
        if old_priority != task.priority:
            TaskActivity.objects.create(
                task=task, user=user, field_changed="priority",
                old_value=old_priority, new_value=task.priority
            )
            
        if old_title != task.title:
            TaskActivity.objects.create(
                task=task, user=user, field_changed="title",
                old_value="[title updated]", new_value=task.title
            )

        # Evaluate automations
        if old_client_status != task.client_status:
            self._run_automations(task, "client_status_change", task.client_status)
        
        if old_column_id != task.column_id:
            self._run_automations(task, "column_change", str(task.column_id))
            
            # Sub-item Rollup Automation:
            # If this is a subitem and it moved to Done, check if ALL subitems are Done.
            if task.parent_id and new_column and new_column.name.lower() == "done":
                parent = task.parent
                siblings = parent.subtasks.filter(is_archived=False)
                # If no sibling exists that is NOT in a Done column
                if siblings.exists() and not siblings.exclude(column__name__iexact="Done").exists():
                    done_col = Column.objects.filter(board=parent.board, name__iexact="Done").first()
                    if done_col and parent.column_id != done_col.id:
                        old_parent_col = parent.column
                        parent.column = done_col
                        parent.save(update_fields=["column", "updated_at"])
                        
                        TaskActivity.objects.create(
                            task=parent, user=user, field_changed="column (Auto Roll-up)",
                            old_value=old_parent_col.name if old_parent_col else "Unknown",
                            new_value="Done"
                        )

        return task

    def _run_automations(self, task, trigger_type, new_value):
        automations = BoardAutomation.objects.filter(
            board=task.board,
            trigger_type=trigger_type,
            trigger_value=new_value,
            is_active=True
        )
        for auto in automations:
            for action in auto.actions:
                atype = action.get("type")
                avalue = action.get("value")
                
                if atype == "move_to_column":
                    task.column_id = avalue
                    task.save(update_fields=["column", "updated_at"])
                elif atype == "move_to_board":
                    try:
                        target_board_id = avalue.get("board_id")
                        target_col_id = avalue.get("column_id")
                        assignee_id = avalue.get("assignee_id")
                        
                        updates = ["updated_at"]
                        if target_board_id:
                            task.board_id = target_board_id
                            updates.append("board")
                        if target_col_id:
                            task.column_id = target_col_id
                            updates.append("column")
                            
                        # If moving subitem to new board, it should ideally lose its parent lock or keep it depending on rules. 
                        # We'll just move it as asked.
                        task.save(update_fields=updates)
                        
                        if assignee_id:
                            task.assigned_to.add(assignee_id)
                            try:
                                user = self.context["request"].user
                                from apps.notifications.models import send_notification
                                send_notification(
                                    recipient_ids=[assignee_id],
                                    title=f"New Task Assigned",
                                    body=f"You have been assigned to task: {task.title[:30]}",
                                    type="task_assigned",
                                    link=f"/tasks/{task.board_id}?taskId={task.id}",
                                    sender=user
                                )
                            except Exception as e:
                                import logging
                                logger = logging.getLogger("apps")
                                logger.error(f"Failed to send assignment notification from automation: {e}", exc_info=True)
                    except Exception as e:
                        pass # Silently fail automation if ids are invalid
                elif atype == "notify_user":
                    try:
                        user = self.context["request"].user
                        recipient_id = None
                        if avalue == "creator" and task.created_by:
                            recipient_id = task.created_by.id
                        elif avalue == "assignee":
                            pass # We can notify all assignees, but skipped for brevity unless specified
                            
                        if recipient_id and recipient_id != user.id:
                            from apps.notifications.models import send_notification
                            send_notification(
                                recipient_ids=[recipient_id],
                                title=f"Automation Alert",
                                body=f"Task {task.title[:30]} had an update.",
                                type="general",
                                link=f"/tasks/{task.board_id}?taskId={task.id}",
                                sender=user
                            )
                    except Exception as e:
                        import logging
                        logger = logging.getLogger("apps")
                        logger.error(f"Failed to send generic notification from automation: {e}", exc_info=True)

class TaskDetailSerializer(TaskSerializer):
    """Full task with comments, attachments, and activities."""
    comments = CommentSerializer(many=True, read_only=True)
    attachments = TaskAttachmentSerializer(many=True, read_only=True)
    time_logs = TimeLogSerializer(many=True, read_only=True)
    activities = TaskActivitySerializer(many=True, read_only=True)
    subtasks = serializers.SerializerMethodField()
    blocked_by_details = serializers.SerializerMethodField()

    class Meta(TaskSerializer.Meta):
        fields = TaskSerializer.Meta.fields + ["comments", "attachments", "time_logs", "activities", "subtasks", "blocked_by_details"]

    def get_subtasks(self, obj):
        return TaskSerializer(
            obj.subtasks.filter(is_archived=False), many=True, context=self.context
        ).data

    def get_blocked_by_details(self, obj):
        return [{"id": t.id, "title": t.title, "column": t.column.name, "is_archived": t.is_archived} for t in obj.blocked_by.all()]


class BoardSerializer(serializers.ModelSerializer):
    columns = ColumnSerializer(many=True, read_only=True)
    automations = BoardAutomationSerializer(many=True, read_only=True)
    members = UserListSerializer(many=True, read_only=True)
    member_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True,
        queryset=__import__("apps.accounts.models", fromlist=["User"]).User.objects.all(),
        source="members", required=False
    )
    task_count = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.full_name_en", read_only=True)

    class Meta:
        model = Board
        fields = [
            "id", "name", "description", "color", "icon",
            "created_by", "created_by_name",
            "members", "member_ids",
            "is_private", "task_count",
            "created_at", "updated_at",
            "columns", "automations"
        ]
        read_only_fields = ["created_by", "created_at", "updated_at"]

    def get_task_count(self, obj):
        return obj.tasks.filter(is_archived=False).count()

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        members = validated_data.pop("members", [])
        board = super().create(validated_data)
        board.members.set(members)
        # Create default columns
        default_columns = [
            ("To Do", "gray", 0),
            ("In Progress", "blue", 1),
            ("Review", "orange", 2),
            ("Done", "green", 3),
        ]
        for name, color, pos in default_columns:
            Column.objects.create(board=board, name=name, color=color, position=pos)
        return board
