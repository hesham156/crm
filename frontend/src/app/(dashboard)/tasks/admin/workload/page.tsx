"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { tasksApi, usersApi } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";
import Link from "next/link";
import { ArrowLeft, Clock, Users, Activity, Briefcase } from "lucide-react";
import toast from "react-hot-toast";

interface TaskItem {
  id: string;
  title: string;
  priority: string;
  client_status: string;
  due_date: string | null;
  assigned_to: { id: string; full_name_en: string }[];
  column_name: string;
  board_id: string;
  board_name: string;
  subtasks_count: number;
  estimated_minutes: number;
  time_logged: number;
}

interface ColumnItem {
  id: string;
  name: string;
  tasks: TaskItem[];
}

interface BoardItem {
  id: string;
  name: string;
  columns: ColumnItem[];
  members: { id: string; full_name_en: string; role: string }[];
}

export default function WorkloadPage() {
  const { language } = useUIStore();
  const { user } = useAuthStore();
  const isAr = language === "ar";
  
  // MAX CApacity per week in minutes (e.g. 40 hours = 2400)
  const MAX_CAPACITY = 2400;

  const { data: boards = [], isLoading: loadingBoards } = useQuery<BoardItem[]>({
    queryKey: ["admin-boards-overview"],
    queryFn: async () => {
      const { data } = await tasksApi.adminOverview();
      return data;
    },
  });

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await usersApi.list();
      return data.results || data;
    },
  });

  const workloadData = useMemo(() => {
    if (!users.length || !boards.length) return [];
    
    // Map of userId -> { user: any, tasks: TaskItem[], totalEst: number, totalLogged: number }
    const userMap = new Map<string, any>();
    
    users.forEach((u: any) => {
      userMap.set(u.id, {
        user: u,
        tasks: [],
        totalEst: 0,
        totalLogged: 0,
      });
    });

    boards.forEach(board => {
      board.columns.forEach(col => {
        // Assume tasks in 'Done' or similar columns don't count towards current workload, 
        // but for simplicity, we count anything that is not archived.
        col.tasks.forEach(task => {
          task.assigned_to.forEach(assignee => {
            if (userMap.has(assignee.id)) {
              const uData = userMap.get(assignee.id);
              uData.tasks.push(task);
              uData.totalEst += (task.estimated_minutes || 0);
              // Assume totalLogged is missing in TaskItem model of overview, we can approximate 
            }
          });
        });
      });
    });
    
    return Array.from(userMap.values()).sort((a, b) => b.totalEst - a.totalEst);
  }, [boards, users]);

  if (loadingBoards || loadingUsers) {
    return <div style={{ padding: "var(--space-6)", color: "var(--text-muted)" }}>Loading Workload Data...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "var(--space-4)" }}>
      {/* Page Header */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
          <Link href="/tasks/admin" className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "1.5rem", margin: 0 }}>
              {isAr ? "📊 عبء العمل" : "📊 Workload & Capacity"}
            </h1>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
              {isAr ? "مراقبة قدرات الموظفين وتوزيع المهام" : "Monitor team capacity and task distribution"}
            </p>
          </div>
        </div>
      </div>
      
      {/* Workload List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {workloadData.map((data: any) => {
          const capPercent = Math.min(100, Math.round((data.totalEst / MAX_CAPACITY) * 100));
          const color = capPercent > 90 ? "var(--color-danger)" : capPercent > 60 ? "var(--color-warning)" : "var(--color-success)";
          
          return (
            <div key={data.user.id} style={{ 
              background: "var(--bg-card)", 
              border: "1px solid var(--border-subtle)", 
              borderRadius: "12px", 
              padding: "var(--space-5)" 
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-4)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <div className="avatar avatar-md">{data.user.full_name_en.charAt(0)}</div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>{data.user.full_name_en}</h3>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>{data.tasks.length} active tasks</p>
                  </div>
                </div>
                
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)" }}>
                     {Math.floor(data.totalEst / 60)}h {data.totalEst % 60}m
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                     Estimated Workload
                  </div>
                </div>
              </div>
              
              {/* Capacity Bar */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "0.8rem", fontWeight: 600 }}>
                   <span>{capPercent}% Capacity (Based on 40h/week)</span>
                   <span style={{ color }}>{capPercent > 100 ? "Overloaded" : capPercent > 80 ? "Heavy" : "Available"}</span>
                </div>
                <div style={{ height: "8px", background: "var(--bg-elevated)", borderRadius: "4px", overflow: "hidden" }}>
                   <div style={{ height: "100%", width: `${Math.min(100, capPercent)}%`, background: color, transition: "width 0.5s ease" }} />
                </div>
              </div>
              
              {/* Task Breakdown */}
              {data.tasks.length > 0 && (
                <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px dashed var(--border-subtle)" }}>
                   <h4 style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "var(--space-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Task Breakdown</h4>
                   <div style={{ display: "table", width: "100%", fontSize: "0.85rem" }}>
                      {data.tasks.slice(0, 5).map((t: any) => (
                        <Link href={`/tasks/${t.board_id}?taskId=${t.id}`} key={t.id} style={{ display: "table-row", textDecoration: "none", color: "inherit" }}>
                           <div style={{ display: "table-cell", padding: "4px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                              <span style={{ fontWeight: 600 }}>{t.title}</span>
                              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{t.board_name} &bull; {t.column_name}</div>
                           </div>
                           <div style={{ display: "table-cell", padding: "4px 0", borderBottom: "1px solid var(--border-subtle)", textAlign: "right", color: "var(--text-muted)" }}>
                              {t.estimated_minutes ? `${Math.floor(t.estimated_minutes / 60)}h ${t.estimated_minutes % 60}m` : "No estimate"}
                           </div>
                        </Link>
                      ))}
                      {data.tasks.length > 5 && (
                        <div style={{ display: "table-row" }}>
                           <div style={{ display: "table-cell", padding: "4px 0", color: "var(--brand-primary)", fontSize: "0.8rem", fontWeight: 600 }}>
                              + {data.tasks.length - 5} more tasks
                           </div>
                        </div>
                      )}
                   </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  );
}
