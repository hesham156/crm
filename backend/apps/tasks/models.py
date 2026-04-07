import uuid
from django.db import models
from django.conf import settings


class Board(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=20, default="#f97316")
    icon = models.CharField(max_length=50, default="layout")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name="created_boards"
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="boards"
    )
    is_private = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["-created_at"]


class Column(models.Model):
    COLOR_CHOICES = [
        ("gray", "Gray"),
        ("blue", "Blue"),
        ("orange", "Orange"),
        ("green", "Green"),
        ("red", "Red"),
        ("purple", "Purple"),
        ("yellow", "Yellow"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name="columns")
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=20, choices=COLOR_CHOICES, default="gray")
    position = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.board.name} → {self.name}"

    class Meta:
        ordering = ["position"]


class Tag(models.Model):
    name = models.CharField(max_length=50)
    color = models.CharField(max_length=20, default="#6366f1")

    def __str__(self):
        return self.name


class Task(models.Model):
    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("normal", "Normal"),
        ("high", "High"),
        ("urgent", "Urgent"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name="tasks")
    column = models.ForeignKey(Column, on_delete=models.CASCADE, related_name="tasks")
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="subtasks"
    )

    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name="created_tasks"
    )
    assigned_to = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="assigned_tasks"
    )
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default="normal")
    due_date = models.DateField(null=True, blank=True)
    position = models.PositiveIntegerField(default=0)
    time_logged = models.PositiveIntegerField(default=0, help_text="Minutes")
    tags = models.ManyToManyField(Tag, blank=True, related_name="tasks")
    
    # Monday-style board fields
    start_date = models.DateField(null=True, blank=True)
    client_status = models.CharField(max_length=50, blank=True, default="Pending")
    is_checked = models.BooleanField(default=False)
    
    # Dependencies
    blocked_by = models.ManyToManyField(
        "self", symmetrical=False, related_name="blocking", blank=True
    )

    # Job linkage (for print jobs)
    job = models.ForeignKey(
        "sales.Job", on_delete=models.SET_NULL, null=True, blank=True, related_name="tasks"
    )
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["position", "-created_at"]


class TaskAttachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="attachments")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    file = models.FileField(upload_to="task_attachments/%Y/%m/")
    filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(default=0, help_text="Bytes")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.filename


class Comment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    body = models.TextField()
    mentions = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="mentioned_in_comments"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Comment by {self.author} on {self.task}"

    class Meta:
        ordering = ["created_at"]


class TimeLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="time_logs")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    duration = models.PositiveIntegerField(help_text="Minutes")
    note = models.CharField(max_length=255, blank=True)
    logged_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-logged_at"]

class BoardAutomation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name="automations")
    
    # TRIGGER
    # Choices: 'client_status_change', 'column_change', 'item_created'
    trigger_type = models.CharField(max_length=50)
    trigger_value = models.CharField(max_length=255, blank=True)
    
    # ACTIONS
    # JSON array to support multiple actions in one automation
    # [{"type": "move_to_column", "value": "uuid"}, {"type": "notify_user", "value": "creator"}]
    actions = models.JSONField(default=list)
    
    label_text = models.CharField(max_length=500, blank=True)  # Human readable "When status changes to X..."
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ["-created_at"]

class TaskActivity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="activities")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    field_changed = models.CharField(max_length=50) # e.g. "status", "column", "priority"
    old_value = models.CharField(max_length=255, blank=True)
    new_value = models.CharField(max_length=255, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]
