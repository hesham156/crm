from django.urls import path
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Sum, Q, Avg
from django.utils import timezone
import datetime


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.sales.models import Job, Invoice
        from apps.crm.models import Customer
        from apps.tasks.models import Task, TimeLog
        from apps.design.models import DesignSubmission

        user = request.user
        today = timezone.now().date()
        month_start = today.replace(day=1)
        week_start = today - datetime.timedelta(days=today.weekday())

        # ── My Tasks (all roles) ────────────────────────────────────────────
        my_tasks_qs = Task.objects.filter(assigned_to=user, is_archived=False)
        my_tasks_total = my_tasks_qs.count()
        my_tasks_overdue = my_tasks_qs.filter(
            due_date__lt=today
        ).exclude(column__name__icontains="done").count()
        my_tasks_completed_this_week = my_tasks_qs.filter(
            column__name__icontains="done",
            updated_at__date__gte=week_start
        ).count()
        my_tasks_high_priority = my_tasks_qs.filter(
            priority__in=["high", "urgent"]
        ).exclude(column__name__icontains="done").count()

        # Time logged by user this month (minutes → hours)
        time_logged_minutes = TimeLog.objects.filter(
            user=user,
            logged_at__date__gte=month_start
        ).aggregate(total=Sum("duration"))["total"] or 0
        time_logged_hours = round(time_logged_minutes / 60, 1)

        data = {
            "role": user.role,
            "tasks": {
                "my_tasks": my_tasks_total,
                "overdue": my_tasks_overdue,
                "completed_this_week": my_tasks_completed_this_week,
                "high_priority": my_tasks_high_priority,
            },
            "time_logged_hours": time_logged_hours,
        }

        # ── Sales / Admin / Manager: Jobs & Revenue ─────────────────────────
        if user.role in ("admin", "manager", "sales"):
            # Jobs created by this user
            my_jobs_qs = Job.objects.filter(created_by=user)
            all_jobs_qs = Job.objects.all() if user.role in ("admin", "manager") else my_jobs_qs

            job_status_counts = dict(
                all_jobs_qs.values_list("status").annotate(c=Count("id")).values_list("status", "c")
            )

            # Revenue this month
            revenue_month = Invoice.objects.filter(
                created_at__date__gte=month_start
            )
            if user.role == "sales":
                revenue_month = revenue_month.filter(job__created_by=user)

            revenue_total = revenue_month.aggregate(total=Sum("total_amount"))["total"] or 0
            collected = revenue_month.filter(payment_status="paid").aggregate(
                total=Sum("total_amount")
            )["total"] or 0

            data["jobs"] = {
                "total": all_jobs_qs.count(),
                "in_progress": all_jobs_qs.exclude(status__in=["complete", "cancelled"]).count(),
                "completed_this_month": all_jobs_qs.filter(
                    status="complete", updated_at__date__gte=month_start
                ).count(),
                "my_jobs_total": my_jobs_qs.count(),
                "my_jobs_this_month": my_jobs_qs.filter(
                    created_at__date__gte=month_start
                ).count(),
                "by_status": job_status_counts,
            }
            data["revenue"] = {
                "this_month": float(revenue_total),
                "collected": float(collected),
                "pending": float(revenue_total - collected),
            }
            data["customers"] = {
                "total": Customer.objects.count(),
                "leads": Customer.objects.filter(type="lead").count(),
                "new_this_month": Customer.objects.filter(
                    created_at__date__gte=month_start
                ).count(),
            }

        # ── Designer: Design submissions ────────────────────────────────────
        if user.role in ("admin", "manager", "designer"):
            my_designs_qs = DesignSubmission.objects.filter(designer=user)
            if user.role in ("admin", "manager"):
                my_designs_qs = DesignSubmission.objects.all()

            data["designs"] = {
                "total": my_designs_qs.count(),
                "pending_review": my_designs_qs.filter(status="submitted").count(),
                "approved": my_designs_qs.filter(status="approved").count(),
                "rejected": my_designs_qs.filter(status="rejected").count(),
                "this_month": my_designs_qs.filter(
                    created_at__date__gte=month_start
                ).count(),
            }
            # Jobs awaiting design
            data["jobs_in_design"] = Job.objects.filter(status="design").count()

        # ── Production ──────────────────────────────────────────────────────
        if user.role in ("admin", "manager", "production"):
            from apps.production.models import ProductionStage
            my_stages_qs = ProductionStage.objects.all()
            data["production"] = {
                "active_stages": my_stages_qs.filter(status="in_progress").count(),
                "completed_this_month": my_stages_qs.filter(
                    status="done", completed_at__date__gte=month_start
                ).count(),
                "jobs_in_production": Job.objects.filter(status="production").count(),
                "jobs_in_delivery": Job.objects.filter(status="delivery").count(),
            }

        return Response(data)


class TimePerUserView(APIView):
    """GET /analytics/time-per-user/?days=30  — time logged per employee this period."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.tasks.models import TimeLog
        from apps.accounts.models import User

        days = int(request.query_params.get("days", 30))
        since = timezone.now().date() - datetime.timedelta(days=days)

        rows = (
            TimeLog.objects
            .filter(logged_at__date__gte=since)
            .values("user_id", "user__full_name_en", "user__role")
            .annotate(
                total_minutes=Sum("duration"),
                log_count=Count("id"),
            )
            .order_by("-total_minutes")
        )

        data = [
            {
                "user_id": str(r["user_id"]),
                "name": r["user__full_name_en"] or "—",
                "role": r["user__role"],
                "hours": round((r["total_minutes"] or 0) / 60, 1),
                "log_count": r["log_count"],
            }
            for r in rows
        ]
        return Response({"period_days": days, "results": data})


class OverdueTasksView(APIView):
    """GET /analytics/overdue-tasks/  — all overdue non-archived tasks."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.tasks.models import Task

        today = timezone.now().date()
        qs = (
            Task.objects
            .filter(due_date__lt=today, is_archived=False)
            .exclude(column__name__icontains="done")
            .select_related("board", "column", "created_by")
            .prefetch_related("assigned_to")
            .order_by("due_date")[:100]
        )

        data = [
            {
                "id": str(t.id),
                "title": t.title,
                "board": t.board.name,
                "column": t.column.name,
                "due_date": str(t.due_date),
                "days_overdue": (today - t.due_date).days,
                "priority": t.priority,
                "assignees": [u.full_name_en for u in t.assigned_to.all()],
            }
            for t in qs
        ]
        return Response({"count": len(data), "results": data})


class RevenueTrendView(APIView):
    """GET /analytics/revenue-trend/?months=6  — monthly revenue for the last N months."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.sales.models import Invoice

        months = min(int(request.query_params.get("months", 6)), 12)
        today = timezone.now().date()
        result = []

        for i in range(months - 1, -1, -1):
            # first day of target month
            first = (today.replace(day=1) - datetime.timedelta(days=1)).replace(day=1)
            # go back i more months
            m = today.month - i
            y = today.year + (m - 1) // 12
            m = ((m - 1) % 12) + 1
            month_start = today.replace(year=y, month=m, day=1)
            if m == 12:
                month_end = today.replace(year=y + 1, month=1, day=1)
            else:
                month_end = today.replace(year=y, month=m + 1, day=1)

            agg = Invoice.objects.filter(
                created_at__date__gte=month_start,
                created_at__date__lt=month_end,
            ).aggregate(
                total=Sum("total_amount"),
                collected=Sum("amount_paid"),
            )

            result.append({
                "month": month_start.strftime("%b %Y"),
                "month_iso": str(month_start),
                "total": float(agg["total"] or 0),
                "collected": float(agg["collected"] or 0),
            })

        return Response({"months": months, "results": result})


urlpatterns = [
    path("dashboard/", DashboardView.as_view()),
    path("time-per-user/", TimePerUserView.as_view()),
    path("overdue-tasks/", OverdueTasksView.as_view()),
    path("revenue-trend/", RevenueTrendView.as_view()),
]
