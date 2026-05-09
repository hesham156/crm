"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, ArrowRight, Calendar, Flag,
  Users, LayoutGrid, Layers, Search, Filter, GitBranch,
  AlertCircle, CheckCircle2, MoveRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────────────
interface JourneyStep {
  board_name: string;
  timestamp: string;
  label: string;
}

interface TrackerTask {
  id: string;
  title: string;
  priority: "low" | "normal" | "high" | "urgent";
  client_status: string;
  due_date: string | null;
  created_at: string;
  board_id: string;
  board_name: string;
  board_color: string;
  column_name: string;
  column_color: string;
  origin_board_id: string | null;
  origin_board_name: string | null;
  assigned_to: { id: string; full_name_en: string }[];
  journey: JourneyStep[];
  boards_visited: number;
  is_cross_board: boolean;
}

// ─── Color Maps ─────────────────────────────────────────────────────────────
const PRIORITY_CFG: Record<string, { label: string; labelAr: string; color: string; bg: string }> = {
  low:    { label: "Low",    labelAr: "منخفض", color: "#94a3b8", bg: "#94a3b815" },
  normal: { label: "Normal", labelAr: "عادي",  color: "#3b82f6", bg: "#3b82f615" },
  high:   { label: "High",   labelAr: "عالي",  color: "#f97316", bg: "#f9731615" },
  urgent: { label: "Urgent", labelAr: "عاجل",  color: "#ef4444", bg: "#ef444415" },
};

const COL_COLORS: Record<string, string> = {
  gray: "#94a3b8", blue: "#3b82f6", orange: "#f97316",
  green: "#22c55e", red: "#ef4444", purple: "#8b5cf6", yellow: "#eab308",
};

// ─── Journey Badge ───────────────────────────────────────────────────────────
function JourneyBadge({ steps, isAr }: { steps: JourneyStep[]; isAr: boolean }) {
  if (steps.length === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", marginTop: "8px" }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{
            fontSize: "0.62rem", fontWeight: 600, padding: "2px 7px", borderRadius: "10px",
            background: i === steps.length - 1 ? "var(--brand-primary)" : "var(--bg-elevated)",
            color: i === steps.length - 1 ? "white" : "var(--text-muted)",
            border: "1px solid var(--border-subtle)",
            whiteSpace: "nowrap",
          }}>
            {s.board_name.split(" / ")[0]}
          </span>
          {i < steps.length - 1 && <ArrowRight size={10} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
        </div>
      ))}
    </div>
  );
}

// ─── Task Row Card ────────────────────────────────────────────────────────────
function TaskRow({ task, isAr }: { task: TrackerTask; isAr: boolean }) {
  const priority = PRIORITY_CFG[task.priority] || PRIORITY_CFG.normal;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
  const colColor = COL_COLORS[task.column_color] || task.column_color;

  return (
    <Link
      href={`/tasks/${task.board_id}?taskId=${task.id}`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div className="tracker-row" style={{
        background: "var(--bg-card)",
        borderRadius: "10px",
        padding: "12px 16px",
        marginBottom: "8px",
        border: "1px solid var(--border-subtle)",
        borderLeft: `4px solid ${task.board_color}`,
        transition: "all 0.15s ease",
        cursor: "pointer",
      }}>
        {/* Top row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
          {/* Cross-board indicator */}
          {task.is_cross_board && (
            <div title={isAr ? "تنقل بين البوردات" : "Cross-board task"} style={{
              width: "24px", height: "24px", borderRadius: "6px",
              background: "linear-gradient(135deg, #8b5cf620, #3b82f620)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <GitBranch size={13} style={{ color: "#8b5cf6" }} />
            </div>
          )}

          {/* Title & journey */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)",
              overflow: "hidden", display: "-webkit-box",
              WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
            }}>
              {task.title}
            </div>
            <JourneyBadge steps={task.journey} isAr={isAr} />
          </div>

          {/* Current board + column */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            <span style={{
              fontSize: "0.68rem", fontWeight: 700, padding: "3px 8px",
              borderRadius: "6px", background: `${task.board_color}18`,
              color: task.board_color, border: `1px solid ${task.board_color}30`,
              whiteSpace: "nowrap",
            }}>
              {task.board_name}
            </span>
            <span style={{
              fontSize: "0.65rem", padding: "2px 6px", borderRadius: "5px",
              background: `${colColor}15`, color: colColor,
              border: `1px solid ${colColor}30`, whiteSpace: "nowrap",
            }}>
              {task.column_name}
            </span>
          </div>
        </div>

        {/* Bottom meta row */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
          {/* Priority */}
          <span style={{
            fontSize: "0.62rem", fontWeight: 700, padding: "2px 6px", borderRadius: "4px",
            color: priority.color, background: priority.bg,
          }}>
            <Flag size={9} style={{ marginRight: "2px", display: "inline" }} />
            {isAr ? priority.labelAr : priority.label}
          </span>

          {/* Client status */}
          {task.client_status && (
            <span style={{
              fontSize: "0.62rem", padding: "2px 6px", borderRadius: "4px",
              background: "var(--bg-elevated)", color: "var(--text-muted)",
              border: "1px solid var(--border-subtle)",
            }}>
              {task.client_status}
            </span>
          )}

          {/* Boards visited */}
          {task.boards_visited > 1 && (
            <span style={{
              fontSize: "0.62rem", padding: "2px 6px", borderRadius: "4px",
              background: "#8b5cf615", color: "#8b5cf6", border: "1px solid #8b5cf630",
              display: "flex", alignItems: "center", gap: "3px",
            }}>
              <MoveRight size={9} />
              {task.boards_visited} {isAr ? "بوردات" : "boards"}
            </span>
          )}

          {/* Assignees */}
          {task.assigned_to.length > 0 && (
            <div style={{ display: "flex", gap: "2px", marginLeft: "auto" }}>
              {task.assigned_to.slice(0, 3).map((a) => (
                <div key={a.id} title={a.full_name_en} style={{
                  width: "20px", height: "20px", borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.6rem", fontWeight: 700, color: "white",
                }}>
                  {a.full_name_en.charAt(0)}
                </div>
              ))}
            </div>
          )}

          {/* Due date */}
          {task.due_date && (
            <span style={{
              fontSize: "0.62rem", color: isOverdue ? "#ef4444" : "var(--text-muted)",
              display: "flex", alignItems: "center", gap: "2px",
            }}>
              <Calendar size={10} />
              {new Date(task.due_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              {isOverdue && " ⚠️"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Board Group ─────────────────────────────────────────────────────────────
function BoardGroup({ boardName, boardColor, tasks, isAr }: {
  boardName: string; boardColor: string;
  tasks: TrackerTask[]; isAr: boolean;
}) {
  const crossBoard = tasks.filter(t => t.is_cross_board).length;
  return (
    <div style={{
      background: "var(--bg-elevated)",
      borderRadius: "12px",
      padding: "14px",
      border: `1px solid ${boardColor}30`,
      borderTop: `3px solid ${boardColor}`,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <div style={{
          width: "28px", height: "28px", borderRadius: "8px", background: boardColor,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <LayoutGrid size={14} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>{boardName}</div>
          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
            {tasks.length} {isAr ? "مهمة" : "tasks"}
            {crossBoard > 0 && (
              <span style={{ marginLeft: "6px", color: "#8b5cf6" }}>
                • {crossBoard} {isAr ? "منتقلة" : "cross-board"}
              </span>
            )}
          </div>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div style={{
          textAlign: "center", color: "var(--text-muted)", fontSize: "0.75rem",
          padding: "20px", border: "1px dashed var(--border-subtle)", borderRadius: "8px",
        }}>
          {isAr ? "لا توجد مهام" : "No tasks"}
        </div>
      ) : (
        tasks.map(t => <TaskRow key={t.id} task={t} isAr={isAr} />)
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TaskTrackerPage() {
  const { language } = useUIStore();
  const { user } = useAuthStore();
  const isAr = language === "ar";
  const [search, setSearch] = useState("");
  const [filterCrossBoard, setFilterCrossBoard] = useState(false);
  const [filterPriority, setFilterPriority] = useState("");

  const { data: tasks = [], isLoading, refetch, isFetching } = useQuery<TrackerTask[]>({
    queryKey: ["task-tracker"],
    queryFn: async () => {
      const { data } = await tasksApi.taskTracker();
      return data;
    },
    refetchInterval: 60_000,
  });

  // ── Stats ──
  const crossBoardCount = tasks.filter(t => t.is_cross_board).length;
  const urgentCount = tasks.filter(t => t.priority === "urgent").length;
  const overdueCount = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date()).length;

  // ── Filter ──
  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (filterCrossBoard && !t.is_cross_board) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) &&
          !t.board_name.toLowerCase().includes(search.toLowerCase()) &&
          !t.column_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tasks, filterCrossBoard, filterPriority, search]);

  // ── Group by current board ──
  const grouped = useMemo(() => {
    const map = new Map<string, { boardName: string; boardColor: string; tasks: TrackerTask[] }>();
    for (const t of filtered) {
      if (!map.has(t.board_id)) {
        map.set(t.board_id, { boardName: t.board_name, boardColor: t.board_color, tasks: [] });
      }
      map.get(t.board_id)!.tasks.push(t);
    }
    return Array.from(map.values());
  }, [filtered]);

  if (!["admin", "manager"].includes(user?.role || "")) {
    return (
      <div className="empty-state">
        <AlertCircle size={32} style={{ color: "#ef4444" }} />
        <h3>{isAr ? "غير مصرح" : "Access Denied"}</h3>
        <p>{isAr ? "هذه الصفحة للمديرين فقط" : "This page is for managers only"}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: "var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <Link href="/tasks" className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>
              {isAr ? "🔀 متابعة رحلة المهام" : "🔀 Task Pipeline Tracker"}
            </h1>
            <p className="page-subtitle" style={{ margin: 0 }}>
              {isAr ? "تتبع انتقال المهام بين البوردات في مكان واحد" : "Track task journeys across all boards"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <Link href="/tasks/admin" className="btn btn-secondary btn-sm">
            <LayoutGrid size={14} />
            {isAr ? "مراقبة الكل" : "Monitor All"}
          </Link>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => refetch()}
            disabled={isFetching}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RefreshCw size={14} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
            {isAr ? "تحديث" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        {[
          { icon: <Layers size={14} />,      value: tasks.length,    label: isAr ? "إجمالي المهام" : "Total Tasks",    color: "var(--brand-primary)" },
          { icon: <GitBranch size={14} />,   value: crossBoardCount, label: isAr ? "منتقلة بين بوردات" : "Cross-Board", color: "#8b5cf6" },
          { icon: <AlertCircle size={14} />, value: urgentCount,     label: isAr ? "عاجل" : "Urgent",                  color: "#ef4444" },
          { icon: <Calendar size={14} />,    value: overdueCount,    label: isAr ? "متأخرة" : "Overdue",               color: "#f97316" },
        ].map((s, i) => (
          <div key={i} style={{
            background: "var(--bg-card)", borderRadius: "10px",
            padding: "12px 16px", border: "1px solid var(--border-subtle)",
            display: "flex", alignItems: "center", gap: "10px",
          }}>
            <div style={{ color: s.color }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{
        display: "flex", gap: "var(--space-2)", alignItems: "center",
        marginBottom: "var(--space-4)", flexWrap: "wrap",
      }}>
        {/* Search */}
        <div className="search-input-wrapper" style={{ flex: 1, minWidth: "200px" }}>
          <Search size={14} style={{ position: "absolute", left: "10px", color: "var(--text-muted)" }} />
          <input
            id="tracker-search"
            className="form-input search-input"
            style={{ height: "36px", paddingLeft: "32px" }}
            placeholder={isAr ? "ابحث عن مهمة أو بورد..." : "Search task or board..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Cross-board filter */}
        <button
          id="filter-cross-board"
          className={`btn btn-sm ${filterCrossBoard ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setFilterCrossBoard(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: "5px" }}
        >
          <GitBranch size={13} />
          {isAr ? "منتقلة فقط" : "Cross-board only"}
        </button>

        {/* Priority filter */}
        <select
          id="filter-priority"
          className="form-input form-select"
          style={{ height: "36px", width: "auto", minWidth: "130px" }}
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
        >
          <option value="">{isAr ? "كل الأولويات" : "All priorities"}</option>
          <option value="urgent">{isAr ? "عاجل" : "Urgent"}</option>
          <option value="high">{isAr ? "عالي" : "High"}</option>
          <option value="normal">{isAr ? "عادي" : "Normal"}</option>
          <option value="low">{isAr ? "منخفض" : "Low"}</option>
        </select>

        {/* Results count */}
        {(search || filterCrossBoard || filterPriority) && (
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {filtered.length} {isAr ? "نتيجة" : "results"}
          </span>
        )}
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", gap: "var(--space-4)", alignItems: "center",
        marginBottom: "var(--space-3)",
        padding: "8px 14px", background: "var(--bg-elevated)",
        borderRadius: "8px", border: "1px solid var(--border-subtle)",
        fontSize: "0.72rem", color: "var(--text-muted)",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <GitBranch size={12} style={{ color: "#8b5cf6" }} />
          {isAr ? "منتقلة بين بوردات" : "Cross-board task"}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <ArrowRight size={12} />
          {isAr ? "مسار الانتقال: من → إلى" : "Journey path: From → To"}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <CheckCircle2 size={12} style={{ color: "var(--brand-primary)" }} />
          {isAr ? "البورد الحالي بالزر الملون" : "Current board = colored badge"}
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "var(--space-4)" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "300px", borderRadius: "12px" }} />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Layers size={24} /></div>
          <h3>{isAr ? "لا توجد مهام" : "No tasks found"}</h3>
          <p>{isAr ? "جرب تغيير الفلاتر" : "Try changing your filters"}</p>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
          gap: "var(--space-4)",
        }}>
          {grouped.map(g => (
            <BoardGroup
              key={g.boardName}
              boardName={g.boardName}
              boardColor={g.boardColor}
              tasks={g.tasks}
              isAr={isAr}
            />
          ))}
        </div>
      )}

      <style>{`
        .tracker-row:hover {
          border-color: var(--brand-primary) !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
