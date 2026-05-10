import logging
import threading
from django.utils import timezone
from django.db.models import Sum
from .models import BoardAutomation, TaskActivity, Column, Task, TimeLog

logger = logging.getLogger("apps")

# Thread-local store for loop detection
_automation_stack = {}

def run_task_automations(task, trigger_type, new_value, user=None):
    """
    Centralized automation runner with circular loop protection.
    Uses a per-task execution stack to prevent the same trigger from firing recursively.
    """
    thread_id = threading.current_thread().ident
    stack_key = (thread_id,)
    if stack_key not in _automation_stack:
        _automation_stack[stack_key] = set()

    execution_key = (str(task.id), trigger_type, str(new_value))
    if execution_key in _automation_stack[stack_key]:
        logger.warning(f"Automation loop detected for task {task.id} trigger={trigger_type} value={new_value}. Skipping.")
        return

    _automation_stack[stack_key].add(execution_key)
    try:
        _run_automations_inner(task, trigger_type, new_value, user)
    finally:
        _automation_stack[stack_key].discard(execution_key)
        if not _automation_stack[stack_key]:
            del _automation_stack[stack_key]


def _run_automations_inner(task, trigger_type, new_value, user=None):
    from .models import AutomationLog

    automations = BoardAutomation.objects.filter(
        board=task.board,
        trigger_type=trigger_type,
        trigger_value=str(new_value),
        is_active=True
    )

    for auto in automations:
        actions_log = []
        overall_status = "success"
        error_msg = ""

        for action in auto.actions:
            atype = action.get("type")
            avalue = action.get("value")
            action_result = {"type": atype, "status": "success"}

            try:
                if atype == "move_to_column":
                    old_col = task.column
                    task.column_id = avalue
                    max_pos = Task.objects.filter(column_id=avalue, is_archived=False).count()
                    task.position = max_pos
                    task.save(update_fields=["column_id", "position", "updated_at"])

                    TaskActivity.objects.create(
                        task=task, user=user, field_changed="column (Automation)",
                        old_value=old_col.name if old_col else "Unknown",
                        new_value=str(avalue)
                    )
                    action_result["detail"] = f"Moved to column {avalue}"

                elif atype == "move_to_board":
                    try:
                        target_board_id = avalue.get("board_id")
                        target_col_id = avalue.get("column_id")
                        assignee_id = avalue.get("assignee_id")

                        from .models import Board
                        old_board_name = task.board.name if task.board_id else "Unknown"
                        old_col_name = task.column.name if task.column_id else "Unknown"

                        updates = ["updated_at"]

                        if target_board_id and str(task.board_id) != str(target_board_id):
                            if not task.origin_board_id:
                                task.origin_board_id = task.board_id
                                updates.append("origin_board_id")
                            task.board_id = target_board_id
                            updates.append("board_id")

                        if target_col_id:
                            task.column_id = target_col_id
                            updates.append("column_id")

                        task.save(update_fields=updates)

                        new_board = Board.objects.filter(id=target_board_id).first()
                        new_board_name = new_board.name if new_board else str(target_board_id)
                        new_col = Column.objects.filter(id=target_col_id).first()
                        new_col_name = new_col.name if new_col else str(target_col_id)

                        TaskActivity.objects.create(
                            task=task, user=user,
                            field_changed="board (Automation)",
                            old_value=f"{old_board_name} / {old_col_name}",
                            new_value=f"{new_board_name} / {new_col_name}"
                        )

                        if assignee_id:
                            task.assigned_to.add(assignee_id)
                            try:
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
                                logger.error(f"Failed to send assignment notification from automation: {e}", exc_info=True)

                        action_result["detail"] = f"Moved to board {new_board_name} / {new_col_name}"
                    except Exception as e:
                        logger.error(f"move_to_board automation failed: {e}", exc_info=True)
                        action_result["status"] = "failed"
                        action_result["error"] = str(e)
                        overall_status = "failed"
                        error_msg = str(e)

                elif atype == "auto_assign":
                    task.assigned_to.add(avalue)
                    action_result["detail"] = f"Assigned user {avalue}"

                elif atype == "unassign_person":
                    if avalue:
                        task.assigned_to.remove(avalue)
                    else:
                        task.assigned_to.clear()
                    action_result["detail"] = "Unassigned person"

                elif atype == "notify_user":
                    try:
                        recipient_ids = []
                        if avalue == "creator" and task.created_by:
                            recipient_ids = [str(task.created_by.id)]
                        elif avalue == "assignees":
                            recipient_ids = [str(uid) for uid in task.assigned_to.values_list('id', flat=True)]
                        elif avalue and avalue not in ("creator", "assignees"):
                            recipient_ids = [str(avalue)]

                        if user:
                            recipient_ids = [rid for rid in recipient_ids if rid != str(user.id)]

                        if recipient_ids:
                            from apps.notifications.models import send_notification
                            send_notification(
                                recipient_ids=recipient_ids,
                                title=f"Automation Update: {task.title[:40]}",
                                body=f"Task {task.title[:30]} was updated.",
                                type="general",
                                link=f"/tasks/{task.board_id}?taskId={task.id}",
                                sender=user
                            )
                        action_result["detail"] = f"Notified {len(recipient_ids)} user(s)"
                    except Exception as e:
                        logger.error(f"Failed to send generic notification from automation: {e}", exc_info=True)
                        action_result["status"] = "failed"
                        action_result["error"] = str(e)

                elif atype == "set_all_subitems_status":
                    try:
                        if avalue:
                            updated = task.subtasks.filter(is_archived=False).update(client_status=avalue)
                            action_result["detail"] = f"Set {updated} subitems to '{avalue}'"
                    except Exception as e:
                        logger.error(f"set_all_subitems_status failed: {e}", exc_info=True)
                        action_result["status"] = "failed"
                        action_result["error"] = str(e)

                elif atype == "move_if_all_subitems_status":
                    try:
                        if not isinstance(avalue, dict):
                            action_result["status"] = "skipped"
                            action_result["detail"] = "Invalid value"
                        else:
                            required_status = avalue.get("required_status")
                            target_col_id   = avalue.get("target_column_id")
                            if not required_status or not target_col_id:
                                action_result["status"] = "skipped"
                            else:
                                parent = task.parent if task.parent_id else task
                                all_subs = parent.subtasks.filter(is_archived=False)
                                if all_subs.exists():
                                    incomplete = all_subs.exclude(client_status=required_status)
                                    if not incomplete.exists():
                                        if str(parent.column_id) != str(target_col_id):
                                            old_col = parent.column
                                            parent.column_id = target_col_id
                                            parent.save(update_fields=["column", "updated_at"])
                                            TaskActivity.objects.create(
                                                task=parent, user=None,
                                                field_changed="column (Auto Rollup)",
                                                old_value=old_col.name if old_col else "",
                                                new_value=str(target_col_id)
                                            )
                                            action_result["detail"] = "Parent moved — all subitems complete"
                                        else:
                                            action_result["status"] = "skipped"
                                            action_result["detail"] = "Parent already in target column"
                                    else:
                                        action_result["status"] = "skipped"
                                        action_result["detail"] = f"{incomplete.count()} subitem(s) still incomplete"
                    except Exception as e:
                        logger.error(f"move_if_all_subitems_status failed: {e}", exc_info=True)
                        action_result["status"] = "failed"
                        action_result["error"] = str(e)

                elif atype == "conditional_move_to_board":
                    try:
                        if not isinstance(avalue, dict):
                            action_result["status"] = "skipped"
                        else:
                            if_in_col_id    = avalue.get("if_in_column_id")
                            target_board_id = avalue.get("target_board_id")
                            target_col_id   = avalue.get("target_column_id")
                            set_status      = avalue.get("set_status")

                            if if_in_col_id and str(task.column_id) == str(if_in_col_id):
                                from .models import Board
                                old_board_name = task.board.name if task.board_id else "Unknown"
                                old_col_name = task.column.name if task.column_id else "Unknown"

                                updates = ["updated_at"]

                                if target_board_id and str(task.board_id) != str(target_board_id):
                                    if not task.origin_board_id:
                                        task.origin_board_id = task.board_id
                                        updates.append("origin_board_id")
                                    task.board_id = target_board_id
                                    updates.append("board_id")

                                if target_col_id:
                                    task.column_id = target_col_id
                                    updates.append("column_id")
                                if set_status:
                                    task.client_status = set_status
                                    updates.append("client_status")
                                task.save(update_fields=updates)

                                new_board = Board.objects.filter(id=target_board_id).first()
                                new_board_name = new_board.name if new_board else str(target_board_id)
                                new_col = Column.objects.filter(id=target_col_id).first()
                                new_col_name = new_col.name if new_col else str(target_col_id)

                                TaskActivity.objects.create(
                                    task=task, user=None,
                                    field_changed="board (Automation)",
                                    old_value=f"{old_board_name} / {old_col_name}",
                                    new_value=f"{new_board_name} / {new_col_name}"
                                )
                                action_result["detail"] = f"Moved to {new_board_name} / {new_col_name}"
                            else:
                                action_result["status"] = "skipped"
                                action_result["detail"] = "Condition not met (task not in expected column)"
                    except Exception as e:
                        logger.error(f"conditional_move_to_board failed: {e}", exc_info=True)
                        action_result["status"] = "failed"
                        action_result["error"] = str(e)

                elif atype == "sync_to_linked_board":
                    try:
                        if not isinstance(avalue, dict):
                            action_result["status"] = "skipped"
                        else:
                            target_board_id = avalue.get("board_id")
                            target_client_status = avalue.get("set_status")
                            if task.job_id and target_board_id and target_client_status:
                                updated = Task.objects.filter(
                                    job_id=task.job_id,
                                    board_id=target_board_id,
                                    is_archived=False
                                ).update(client_status=target_client_status)
                                action_result["detail"] = f"Synced {updated} task(s) in linked board"
                            else:
                                action_result["status"] = "skipped"
                                action_result["detail"] = "No linked job or missing config"
                    except Exception as e:
                        logger.error(f"sync_to_linked_board failed: {e}", exc_info=True)
                        action_result["status"] = "failed"
                        action_result["error"] = str(e)

                elif atype == "start_timer":
                    if not task.is_timer_running:
                        task.is_timer_running = True
                        task.timer_started_at = timezone.now()
                        task.save(update_fields=["is_timer_running", "timer_started_at"])
                        TaskActivity.objects.create(
                            task=task, user=user, field_changed="Timer started (Auto)",
                            old_value="", new_value="Running"
                        )
                        action_result["detail"] = "Timer started"
                    else:
                        action_result["status"] = "skipped"
                        action_result["detail"] = "Timer already running"

                elif atype == "stop_timer":
                    if task.is_timer_running and task.timer_started_at:
                        delta = timezone.now() - task.timer_started_at
                        minutes = int(delta.total_seconds() / 60)

                        if minutes > 0:
                            TimeLog.objects.create(
                                task=task,
                                user=user,
                                duration=minutes,
                                note="Tracked via Automation"
                            )
                            task.time_logged = task.time_logs.aggregate(total=Sum("duration"))["total"] or 0

                        task.is_timer_running = False
                        task.timer_started_at = None
                        task.save(update_fields=["is_timer_running", "timer_started_at", "time_logged"])
                        TaskActivity.objects.create(
                            task=task, user=user, field_changed="Timer stopped (Auto)",
                            old_value="Running", new_value=f"+{minutes} mins"
                        )
                        action_result["detail"] = f"Timer stopped, logged {minutes} min(s)"
                    else:
                        action_result["status"] = "skipped"
                        action_result["detail"] = "Timer was not running"

                elif atype == "create_subtasks":
                    items = avalue if isinstance(avalue, list) else []
                    for idx, title in enumerate(items):
                        if title.strip():
                            Task.objects.create(
                                board=task.board,
                                column=task.column,
                                parent=task,
                                title=title.strip(),
                                created_by=user,
                                position=idx,
                                estimated_minutes=0,
                                time_logged=0
                            )
                    TaskActivity.objects.create(
                        task=task, user=user, field_changed="Auto-Checklist Generated",
                        old_value="", new_value=f"{len(items)} subitems added"
                    )
                    action_result["detail"] = f"Created {len(items)} subtask(s)"

            except Exception as e:
                logger.error(f"Error running automation action {atype}: {e}")
                action_result["status"] = "failed"
                action_result["error"] = str(e)
                overall_status = "failed"
                error_msg = str(e)

            actions_log.append(action_result)

        # Write log entry for this automation
        try:
            AutomationLog.objects.create(
                automation=auto,
                task=task,
                trigger_payload={
                    "trigger_type": trigger_type,
                    "trigger_value": str(new_value),
                    "task_title": task.title[:100],
                    "task_id": str(task.id),
                },
                actions_executed=actions_log,
                status=overall_status,
                error_message=error_msg,
            )
        except Exception as log_err:
            logger.error(f"Failed to write AutomationLog: {log_err}")
