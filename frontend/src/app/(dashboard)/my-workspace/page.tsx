"use client";

import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { Calendar, AlertCircle, CheckCircle, Clock } from "lucide-react";
import TaskDetailModal from "@/components/kanban/TaskDetailModal";
import { useState } from "react";
import { isBefore, startOfToday, parseISO, isToday } from "date-fns";

export default function MyWorkspacePage() {
  const { user } = useAuthStore();
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  // Fetch all tasks where this user is assigned
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", "my-workspace", user?.id],
    queryFn: async () => {
      // Fetching across all boards by assigned user. If the backend supports ?assigned_to=
      const { data } = await tasksApi.list({ assigned_to: user?.id, is_archived: false });
      return data.results || data;
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: "var(--space-8)" }}>
        <div className="skeleton" style={{ width: "80%", height: "400px", borderRadius: "var(--radius-lg)" }} />
      </div>
    );
  }

  // Organize Tasks
  const todayDate = startOfToday();
  const overdueTasks = tasks.filter((t: any) => t.due_date && isBefore(parseISO(t.due_date), todayDate) && t.client_status !== "Done");
  const todayTasks = tasks.filter((t: any) => t.due_date && isToday(parseISO(t.due_date)) && t.client_status !== "Done");
  const otherTasks = tasks.filter((t: any) => !overdueTasks.includes(t) && !todayTasks.includes(t) && t.client_status !== "Done");
  const completedTasks = tasks.filter((t: any) => t.client_status === "Done" || t.column_name?.toLowerCase() === "done");

  const Section = ({ title, icon, color, items }: any) => (
    <div style={{ marginBottom: "var(--space-8)" }}>
      <h3 style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "1.25rem", color: "var(--text-primary)", marginBottom: "var(--space-4)" }}>
        {icon} <span style={{ fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: "0.85rem", background: "var(--bg-inset)", padding: "2px 8px", borderRadius: "12px", color: "var(--text-secondary)" }}>{items.length}</span>
      </h3>
      
      {items.length === 0 ? (
        <div style={{ background: "var(--bg-elevated)", border: "1px dashed var(--border-subtle)", padding: "var(--space-4)", borderRadius: "var(--radius-md)", color: "var(--text-muted)", textAlign: "center" }}>
          No tasks here!
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "var(--space-4)" }}>
          {items.map((task: any) => (
            <div 
              key={task.id} 
              onClick={() => setSelectedTask(task)}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-4)",
                cursor: "pointer",
                transition: "all 0.2s",
                position: "relative",
                borderLeft: `4px solid ${color}`
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "none"}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--brand-primary)", background: "rgba(249,115,22,0.1)", padding: "2px 8px", borderRadius: "12px" }}>
                  {task.board_name || "Board"}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{task.column_name}</span>
              </div>
              <h4 style={{ margin: "0 0 8px", fontSize: "1rem" }}>{task.title}</h4>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Clock size={12} /> {task.due_date || "No Date"}</span>
                <span>{task.client_status || "Pending"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: "var(--space-6) var(--space-8)", maxWidth: "1400px", margin: "0 auto", height: "calc(100vh - 64px)", overflowY: "auto" }}>
      <div style={{ marginBottom: "var(--space-8)" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: "0 0 var(--space-2)" }}>Welcome back, {user?.full_name_en?.split(" ")[0] || "User"} 👋</h1>
        <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "1.1rem" }}>Here's what you need to focus on today.</p>
      </div>

      <Section title="Overdue" icon={<AlertCircle color="#ef4444" />} color="#ef4444" items={overdueTasks} />
      <Section title="Today" icon={<Calendar color="#3b82f6" />} color="#3b82f6" items={todayTasks} />
      <Section title="Upcoming & Other Tasks" icon={<Clock color="#f59e0b" />} color="#f59e0b" items={otherTasks} />
      <Section title="Completed Recently" icon={<CheckCircle color="#10b981" />} color="#10b981" items={completedTasks.slice(0, 5)} />

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          boardId={selectedTask.board}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
