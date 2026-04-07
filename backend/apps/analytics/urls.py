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


urlpatterns = [
    path("dashboard/", DashboardView.as_view()),
]
