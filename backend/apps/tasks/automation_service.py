import logging
from django.utils import timezone
from .models import BoardAutomation, TaskActivity, Column, Task, TimeLog

logger = logging.getLogger("apps")

def run_task_automations(task, trigger_type, new_value, user=None):
    """
    Centralized automation runner for ProSticker ERP.
    """
    automations = BoardAutomation.objects.filter(
        board=task.board,
        trigger_type=trigger_type,
        trigger_value=str(new_value),
        is_active=True
    )
    
    for auto in automations:
        for action in auto.actions:
            atype = action.get("type")
            avalue = action.get("value")
            
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
                
                elif atype == "move_to_board":
                    try:
                        target_board_id = avalue.get("board_id")
                        target_col_id = avalue.get("column_id")
                        assignee_id = avalue.get("assignee_id")
                        
                        updates = ["updated_at"]
                        if target_board_id:
                            task.board_id = target_board_id
                            updates.append("board_id")
                        if target_col_id:
                            task.column_id = target_col_id
                            updates.append("column_id")
                            
                        task.save(update_fields=updates)
                        
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
                    except Exception as e:
                        pass # Silently fail automation if ids are invalid

                elif atype == "auto_assign":
                    task.assigned_to.add(avalue)
                
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
                    except Exception as e:
                        logger.error(f"Failed to send generic notification from automation: {e}", exc_info=True)

                elif atype == "set_all_subitems_status":
                    try:
                        if avalue:
                            task.subtasks.filter(is_archived=False).update(client_status=avalue)
                    except Exception as e:
                        logger.error(f"set_all_subitems_status failed: {e}", exc_info=True)

                elif atype == "move_if_all_subitems_status":
                    try:
                        if not isinstance(avalue, dict):
                            continue
                        required_status = avalue.get("required_status")
                        target_col_id   = avalue.get("target_column_id")
                        if not required_status or not target_col_id:
                            continue

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
                    except Exception as e:
                        logger.error(f"move_if_all_subitems_status failed: {e}", exc_info=True)

                elif atype == "conditional_move_to_board":
                    try:
                        if not isinstance(avalue, dict):
                            continue
                        if_in_col_id    = avalue.get("if_in_column_id")
                        target_board_id = avalue.get("target_board_id")
                        target_col_id   = avalue.get("target_column_id")
                        set_status      = avalue.get("set_status")

                        if if_in_col_id and str(task.column_id) == str(if_in_col_id):
                            updates = ["updated_at"]
                            if target_board_id:
                                task.board_id = target_board_id
                                updates.append("board_id")
                            if target_col_id:
                                task.column_id = target_col_id
                                updates.append("column_id")
                            if set_status:
                                task.client_status = set_status
                                updates.append("client_status")
                            task.save(update_fields=updates)
                            TaskActivity.objects.create(
                                task=task, user=None,
                                field_changed="board/column (Missing & Redo Automation)",
                                old_value="", new_value=f"board:{target_board_id} col:{target_col_id}"
                            )
                    except Exception as e:
                        logger.error(f"conditional_move_to_board failed: {e}", exc_info=True)

                elif atype == "sync_to_linked_board":
                    try:
                        if not isinstance(avalue, dict):
                            continue
                        target_board_id = avalue.get("board_id")
                        target_client_status = avalue.get("set_status")
                        if task.job_id and target_board_id and target_client_status:
                            Task.objects.filter(
                                job_id=task.job_id,
                                board_id=target_board_id,
                                is_archived=False
                            ).update(client_status=target_client_status)
                    except Exception as e:
                        logger.error(f"sync_to_linked_board failed: {e}", exc_info=True)

                elif atype == "start_timer":
                    if not task.is_timer_running:
                        task.is_timer_running = True
                        task.timer_started_at = timezone.now()
                        task.save(update_fields=["is_timer_running", "timer_started_at"])
                        TaskActivity.objects.create(
                            task=task, user=user, field_changed="Timer started (Auto)",
                            old_value="", new_value="Running"
                        )

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
                            task.time_logged = sum(tl.duration for tl in task.time_logs.all())
                            
                        task.is_timer_running = False
                        task.timer_started_at = None
                        task.save(update_fields=["is_timer_running", "timer_started_at", "time_logged"])
                        TaskActivity.objects.create(
                            task=task, user=user, field_changed="Timer stopped (Auto)",
                            old_value="Running", new_value=f"+{minutes} mins"
                        )
                        
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
                                position=idx
                            )
                    TaskActivity.objects.create(
                        task=task, user=user, field_changed="Auto-Checklist Generated",
                        old_value="", new_value=f"{len(items)} subitems added"
                    )
                        
                        
            except Exception as e:
                logger.error(f"Error running automation action {atype}: {e}")
