"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import { ArchiveRestore, Trash2, ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/useAuthStore";

export default function ArchivedTasksPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [search, setSearch] = useState("");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["archived-tasks"],
    queryFn: async () => {
      const { data } = await tasksApi.archivedTasks();
      return data.results || data;
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (taskId: string) => tasksApi.updateTask(taskId, { is_archived: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["archived-tasks"] });
      toast.success("Task restored");
    },
    onError: () => toast.error("Failed to restore task"),
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => tasksApi.deleteTask(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["archived-tasks"] });
      toast.success("Task permanently deleted");
    },
    onError: () => toast.error("Failed to delete task"),
  });

  const filtered = tasks.filter((t: any) =>
    t.title?.toLowerCase().includes(search.toLowerCase())
  );

  const PRIORITY_COLORS: Record<string, string> = {
    low: "var(--priority-low)",
    normal: "var(--priority-normal)",
    high: "var(--priority-high)",
    urgent: "var(--priority-urgent)",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <Link href="/tasks" className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "1.4rem", margin: 0 }}>Archived Tasks</h1>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>{tasks.length} tasks archived</p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: "400px" }}>
          <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            className="form-input"
            placeholder="Search archived tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: "34px" }}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "64px", borderRadius: "var(--radius-md)" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--space-12)", color: "var(--text-muted)" }}>
          <ArchiveRestore size={40} style={{ marginBottom: "var(--space-3)", opacity: 0.4 }} />
          <p>{search ? "No matching archived tasks" : "No archived tasks"}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {filtered.map((task: any) => (
            <div
              key={task.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                padding: "var(--space-3) var(--space-4)",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                borderLeft: `3px solid ${PRIORITY_COLORS[task.priority] || "var(--border-subtle)"}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {task.title}
                </p>
                <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "2px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  <span>{task.column_name}</span>
                  {task.due_date && <span>Due: {format(new Date(task.due_date), "MMM d")}</span>}
                  {task.assigned_to?.length > 0 && (
                    <span>{task.assigned_to.map((a: any) => a.full_name_en).join(", ")}</span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => restoreMutation.mutate(task.id)}
                  disabled={restoreMutation.isPending}
                  data-tooltip="Restore task"
                >
                  <ArchiveRestore size={14} />
                  Restore
                </button>
                {user?.role === "admin" && (
                  <button
                    className="btn btn-sm"
                    style={{ color: "var(--color-danger)", background: "transparent", border: "1px solid var(--color-danger)" }}
                    onClick={() => {
                      if (confirm("Permanently delete this task?")) deleteMutation.mutate(task.id);
                    }}
                    disabled={deleteMutation.isPending}
                    data-tooltip="Delete permanently"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
