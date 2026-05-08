"use client";

import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import { ArrowLeft, Users, Clock, AlertCircle, Flag } from "lucide-react";
import Link from "next/link";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  normal: "#f59e0b",
  low: "#94a3b8",
};

export default function WorkloadPage() {
  const { data: workload = [], isLoading } = useQuery({
    queryKey: ["workload"],
    queryFn: async () => {
      const { data } = await tasksApi.workload();
      return data;
    },
  });

  const maxTasks = Math.max(...workload.map((u: any) => u.total_tasks), 1);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <Link href="/tasks" className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "1.4rem", margin: 0 }}>Team Workload</h1>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>Task distribution across team members</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "100px", borderRadius: "var(--radius-md)" }} />
          ))}
        </div>
      ) : workload.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--space-12)", color: "var(--text-muted)" }}>
          <Users size={40} style={{ marginBottom: "var(--space-3)", opacity: 0.4 }} />
          <p>No workload data available</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {workload.map((u: any) => (
            <div
              key={u.user_id}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-5)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-4)" }}>
                {/* Avatar + Name */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", width: "200px", flexShrink: 0 }}>
                  <div
                    className="avatar"
                    style={{ width: "42px", height: "42px", background: "linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))", fontSize: "1rem" }}
                  >
                    {u.user_name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{u.user_name}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "capitalize" }}>{u.role}</div>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ flex: 1 }}>
                  {/* Load bar */}
                  <div style={{ marginBottom: "var(--space-3)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>Task load</span>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>{u.total_tasks} tasks</span>
                    </div>
                    <div style={{ height: "8px", background: "var(--bg-elevated)", borderRadius: "99px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${(u.total_tasks / maxTasks) * 100}%`,
                          height: "100%",
                          background: u.total_tasks > maxTasks * 0.7
                            ? "var(--color-danger)"
                            : u.total_tasks > maxTasks * 0.4
                            ? "var(--color-warning)"
                            : "var(--brand-primary)",
                          borderRadius: "99px",
                          transition: "width 0.5s ease",
                        }}
                      />
                    </div>
                  </div>

                  {/* Priority breakdown */}
                  <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
                    {Object.entries(u.by_priority).map(([priority, count]) =>
                      (count as number) > 0 ? (
                        <span
                          key={priority}
                          className="badge"
                          style={{ background: `${PRIORITY_COLORS[priority]}20`, color: PRIORITY_COLORS[priority], fontSize: "0.72rem" }}
                        >
                          <Flag size={9} />
                          {count} {priority}
                        </span>
                      ) : null
                    )}
                  </div>

                  {/* Metrics row */}
                  <div style={{ display: "flex", gap: "var(--space-5)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      <Clock size={13} />
                      <span><strong>{u.estimated_hours}h</strong> estimated</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      <Clock size={13} style={{ color: "var(--color-success)" }} />
                      <span><strong>{u.time_logged_hours}h</strong> logged</span>
                    </div>
                    {u.overdue_tasks > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", color: "var(--color-danger)", fontWeight: 600 }}>
                        <AlertCircle size={13} />
                        <span>{u.overdue_tasks} overdue</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
