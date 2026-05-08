"""
Management command to send due-date reminder notifications.
Run daily via cron: python manage.py send_due_date_reminders

Sends notifications for:
- Tasks due tomorrow (1-day advance warning)
- Tasks that became overdue today
"""
import logging
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.tasks.models import Task
from apps.notifications.models import send_notification

logger = logging.getLogger("apps")


class Command(BaseCommand):
    help = "Send due-date reminder notifications for upcoming and overdue tasks"

    def handle(self, *args, **options):
        today = date.today()
        tomorrow = today + timedelta(days=1)

        sent_count = 0

        # Tasks due tomorrow
        due_tomorrow = Task.objects.filter(
            due_date=tomorrow,
            is_archived=False,
        ).exclude(column__name__iexact="done").prefetch_related("assigned_to")

        for task in due_tomorrow:
            assignees = list(task.assigned_to.values_list("id", flat=True))
            if not assignees:
                continue
            try:
                send_notification(
                    recipient_ids=assignees,
                    title="Task Due Tomorrow",
                    body=f'"{task.title[:40]}" is due tomorrow.',
                    type="due_date_reminder",
                    link=f"/tasks/{task.board_id}?taskId={task.id}",
                )
                sent_count += 1
            except Exception as e:
                logger.error(f"Failed to send due-tomorrow reminder for task {task.id}: {e}")

        # Tasks that became overdue today (due date was yesterday)
        overdue_today = Task.objects.filter(
            due_date=today - timedelta(days=1),
            is_archived=False,
        ).exclude(column__name__iexact="done").prefetch_related("assigned_to")

        for task in overdue_today:
            assignees = list(task.assigned_to.values_list("id", flat=True))
            if not assignees:
                continue
            try:
                send_notification(
                    recipient_ids=assignees,
                    title="Task Overdue",
                    body=f'"{task.title[:40]}" is now overdue!',
                    type="task_overdue",
                    link=f"/tasks/{task.board_id}?taskId={task.id}",
                )
                sent_count += 1
            except Exception as e:
                logger.error(f"Failed to send overdue reminder for task {task.id}: {e}")

        self.stdout.write(self.style.SUCCESS(f"Sent {sent_count} due-date reminder notifications."))
