"use client";

import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import { ArrowLeft, AlertCircle, Clock, CheckCircle2, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { format, isPast, isToday, subDays } from "date-fns";
import { useMemo } from "react";

export default function TaskReportsPage() {
  const { data: boards = [] } = useQuery({
    queryKey: ["boards"],
    queryFn: async () => {
      const { data } = await tasksApi.boards();
      return data.results || data;
    },
  });

  const { data: allTasks = [], isLoading } = useQuery({
    queryKey: ["all-tasks-report"],
    queryFn: async () => {
      const { data } = await tasksApi.tasks({ is_archived: false });
      return data.results || data;
    },
  });

  const { data: workload = [] } = useQuery({
    queryKey: ["workload"],
    queryFn: async () => {
      const { data } = await tasksApi.workload();
      return data;
    },
  });

  const stats = useMemo(() => {
    const today = new Date();
    const overdue = allTasks.filter((t: any) =>
      t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)) &&
      t.column_name?.toLowerCase() !== "done"
    );
    const dueToday = allTasks.filter((t: any) => t.due_date && isToday(new Date(t.due_date)));
    const noAssignee = allTasks.filter((t: any) => !t.assigned_to?.length);
    const completedRecently = allTasks.filter((t: any) =>
      t.column_name?.toLowerCase() === "done" &&
      t.updated_at && new Date(t.updated_at) > subDays(today, 7)
    );
    const highPriority = allTasks.filter((t: any) => t.priority === "urgent" || t.priority === "high");
    const noDeadline = allTasks.filter((t: any) => !t.due_date);

    return { overdue, dueToday, noAssignee, completedRecently, highPriority, noDeadline };
  }, [allTasks]);

  const PRIORITY_COLORS: Record<string, string> = {
    urgent: "#ef4444",
    high: "#f97316",
    normal: "#f59e0b",
    low: "#94a3b8",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <Link href="/tasks" className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "1.4rem", margin: 0 }}>Task Reports</h1>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>Analytics and insights for your task management</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "var(--space-4)" }}>
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: "100px", borderRadius: "var(--radius-md)" }} />)}
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
            <StatCard icon={<AlertCircle size={20} color="#ef4444" />} label="Overdue Tasks" value={stats.overdue.length} color="#ef4444" />
            <StatCard icon={<Clock size={20} color="#f97316" />} label="Due Today" value={stats.dueToday.length} color="#f97316" />
            <StatCard icon={<CheckCircle2 size={20} color="#22c55e" />} label="Completed This Week" value={stats.completedRecently.length} color="#22c55e" />
            <StatCard icon={<TrendingUp size={20} color="#8b5cf6" />} label="High/Urgent Priority" value={stats.highPriority.length} color="#8b5cf6" />
            <StatCard icon={<Users size={20} color="#3b82f6" />} label="Unassigned Tasks" value={stats.noAssignee.length} color="#3b82f6" />
            <StatCard icon={<Clock size={20} color="#94a3b8" />} label="No Deadline" value={stats.noDeadline.length} color="#94a3b8" />
          </div>

          {/* Overdue Tasks */}
          {stats.overdue.length > 0 && (
            <Section title="⚠️ Overdue Tasks" count={stats.overdue.length}>
              {stats.overdue.slice(0, 10).map((task: any) => (
                <TaskRow key={task.id} task={task} priorityColors={PRIORITY_COLORS} />
              ))}
            </Section>
          )}

          {/* High Priority */}
          {stats.highPriority.length > 0 && (
            <Section title="🔴 High & Urgent Priority" count={stats.highPriority.length}>
              {stats.highPriority.slice(0, 10).map((task: any) => (
                <TaskRow key={task.id} task={task} priorityColors={PRIORITY_COLORS} />
              ))}
            </Section>
          )}

          {/* Unassigned */}
          {stats.noAssignee.length > 0 && (
            <Section title="👤 Unassigned Tasks" count={stats.noAssignee.length}>
              {stats.noAssignee.slice(0, 10).map((task: any) => (
                <TaskRow key={task.id} task={task} priorityColors={PRIORITY_COLORS} />
              ))}
            </Section>
          )}

          {/* Team Performance */}
          {workload.length > 0 && (
            <Section title="📊 Team Performance" count={workload.length}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "var(--space-3)" }}>
                {workload.slice(0, 8).map((u: any) => (
                  <div key={u.user_id} style={{ padding: "var(--space-3)", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                    <div className="avatar" style={{ width: "36px", height: "36px", margin: "0 auto var(--space-2)", background: "var(--brand-primary)", fontSize: "0.9rem" }}>
                      {u.user_name.charAt(0)}
                    </div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700 }}>{u.user_name}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{u.total_tasks} tasks</div>
                    {u.overdue_tasks > 0 && (
                      <div style={{ fontSize: "0.7rem", color: "#ef4444", marginTop: "2px" }}>{u.overdue_tasks} overdue</div>
                    )}
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>{u.time_logged_hours}h logged</div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div style={{ padding: "var(--space-4)", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
      <div style={{ width: "44px", height: "44px", borderRadius: "var(--radius-md)", background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "1.5rem", fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>{label}</div>
      </div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "var(--space-6)" }}>
      <h3 style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "var(--space-3)" }}>
        {title} <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "0.85rem" }}>({count})</span>
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>{children}</div>
    </div>
  );
}

function TaskRow({ task, priorityColors }: { task: any; priorityColors: Record<string, string> }) {
  return (
    <Link
      href={`/tasks/${task.board}?taskId=${task.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-2) var(--space-3)",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderLeft: `3px solid ${priorityColors[task.priority] || "var(--border-subtle)"}`,
        borderRadius: "var(--radius-md)",
        textDecoration: "none",
        color: "var(--text-primary)",
      }}
    >
      <span style={{ flex: 1, fontSize: "0.875rem", fontWeight: 500 }}>{task.title}</span>
      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{task.column_name}</span>
      {task.due_date && (
        <span style={{ fontSize: "0.72rem", color: isPast(new Date(task.due_date)) ? "#ef4444" : "var(--text-muted)", whiteSpace: "nowrap" }}>
          {format(new Date(task.due_date), "MMM d")}
        </span>
      )}
      {task.assigned_to?.length > 0 && (
        <div className="avatar avatar-sm" style={{ fontSize: "0.6rem", width: "22px", height: "22px", flexShrink: 0 }}>
          {task.assigned_to[0].full_name_en?.charAt(0)}
        </div>
      )}
    </Link>
  );
}
