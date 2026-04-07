"use client";

import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, ExternalLink, User, Calendar,
  AlertCircle, Clock, ChevronRight, LayoutGrid, Eye,
  Layers
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────
interface TaskItem {
  id: string;
  title: string;
  priority: "low" | "normal" | "high" | "urgent";
  client_status: string;
  due_date: string | null;
  assigned_to: { id: string; full_name_en: string }[];
  column_name: string;
  column_color: string;
  board_id: string;
  board_name: string;
  subtasks_count: number;
  created_at: string;
}

interface ColumnItem {
  id: string;
  name: string;
  color: string;
  position: number;
  task_count: number;
  tasks: TaskItem[];
}

interface BoardItem {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  is_private: boolean;
  task_count: number;
  members: { id: string; full_name_en: string; role: string }[];
  created_at: string;
  columns: ColumnItem[];
}

// ─── Color Helpers ───────────────────────────────────────────────────────
const COL_COLORS: Record<string, string> = {
  gray:   "#94a3b8",
  blue:   "#3b82f6",
  orange: "#f97316",
  green:  "#22c55e",
  red:    "#ef4444",
  purple: "#8b5cf6",
  yellow: "#eab308",
};

const PRIORITY_CONFIG: Record<string, { label: string; labelAr: string; color: string; bg: string }> = {
  low:    { label: "Low",    labelAr: "منخفض", color: "#94a3b8", bg: "#94a3b820" },
  normal: { label: "Normal", labelAr: "متوسط", color: "#3b82f6", bg: "#3b82f620" },
  high:   { label: "High",   labelAr: "عالي",  color: "#f97316", bg: "#f9731620" },
  urgent: { label: "Urgent", labelAr: "عاجل",  color: "#ef4444", bg: "#ef444420" },
};

// ─── Mini Task Card ──────────────────────────────────────────────────────
function MiniTaskCard({ task, isAr, boardColor }: { task: TaskItem; isAr: boolean; boardColor: string }) {
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normal;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();

  return (
    <Link
      href={`/tasks/${task.board_id}?taskId=${task.id}`}
      style={{
        display: "block",
        textDecoration: "none",
        background: "var(--bg-elevated)",
        borderRadius: "8px",
        padding: "10px 12px",
        marginBottom: "6px",
        border: "1px solid var(--border-subtle)",
        transition: "all 0.15s ease",
        borderLeft: `3px solid ${boardColor}`,
        cursor: "pointer",
      }}
      className="admin-task-card"
    >
      {/* Title */}
      <div style={{
        fontSize: "0.78rem",
        fontWeight: 600,
        color: "var(--text-primary)",
        lineHeight: 1.35,
        marginBottom: "6px",
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
      }}>
        {task.title}
      </div>

      {/* Meta row */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
        {/* Priority badge */}
        <span style={{
          fontSize: "0.65rem",
          fontWeight: 700,
          padding: "2px 6px",
          borderRadius: "4px",
          color: priority.color,
          background: priority.bg,
          letterSpacing: "0.02em",
        }}>
          {isAr ? priority.labelAr : priority.label}
        </span>

        {/* Client status */}
        {task.client_status && (
          <span style={{
            fontSize: "0.65rem",
            color: "var(--text-muted)",
            background: "var(--bg-base)",
            padding: "2px 6px",
            borderRadius: "4px",
            border: "1px solid var(--border-subtle)",
          }}>
            {task.client_status}
          </span>
        )}

        {/* Subtasks */}
        {task.subtasks_count > 0 && (
          <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "2px" }}>
            <Layers size={10} />
            {task.subtasks_count}
          </span>
        )}

        {/* Due date */}
        {task.due_date && (
          <span style={{
            fontSize: "0.65rem",
            color: isOverdue ? "#ef4444" : "var(--text-muted)",
            display: "flex", alignItems: "center", gap: "2px", marginLeft: "auto",
          }}>
            <Calendar size={10} />
            {new Date(task.due_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
          </span>
        )}
      </div>

      {/* Assignees */}
      {task.assigned_to.length > 0 && (
        <div style={{ display: "flex", gap: "2px", marginTop: "6px" }}>
          {task.assigned_to.slice(0, 3).map((a) => (
            <div
              key={a.id}
              title={a.full_name_en}
              style={{
                width: "20px", height: "20px", borderRadius: "50%",
                background: "linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.6rem", fontWeight: 700, color: "white",
              }}
            >
              {a.full_name_en.charAt(0)}
            </div>
          ))}
          {task.assigned_to.length > 3 && (
            <div style={{
              width: "20px", height: "20px", borderRadius: "50%",
              background: "var(--bg-base)", border: "1px solid var(--border-subtle)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.55rem", color: "var(--text-muted)",
            }}>
              +{task.assigned_to.length - 3}
            </div>
          )}
        </div>
      )}
    </Link>
  );
}

// ─── Board Column (one board = one big column) ─────────────────────────────
function BoardColumn({ board, isAr, filter }: { board: BoardItem; isAr: boolean; filter: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const totalTasks = board.columns.reduce((s, c) => s + c.task_count, 0);

  // Flatten & filter tasks
  const allTasks = board.columns.flatMap(c => c.tasks);
  const filtered = filter
    ? allTasks.filter(t =>
        t.title.toLowerCase().includes(filter.toLowerCase()) ||
        t.client_status.toLowerCase().includes(filter.toLowerCase())
      )
    : null;

  return (
    <div style={{
      minWidth: collapsed ? "60px" : "290px",
      maxWidth: collapsed ? "60px" : "290px",
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      background: "var(--bg-card)",
      borderRadius: "12px",
      border: "1px solid var(--border-subtle)",
      overflow: "hidden",
      transition: "all 0.2s ease",
    }}>
      {/* Board Header */}
      <div style={{
        padding: "14px 14px 12px",
        borderBottom: "2px solid",
        borderBottomColor: board.color,
        background: `linear-gradient(135deg, ${board.color}15, ${board.color}05)`,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        cursor: collapsed ? "pointer" : "default",
        writingMode: collapsed ? "vertical-rl" : "horizontal-tb",
      }}
        onClick={collapsed ? () => setCollapsed(false) : undefined}
      >
        <div style={{
          width: "28px", height: "28px", borderRadius: "8px",
          background: board.color, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <LayoutGrid size={14} color="white" />
        </div>

        {!collapsed && (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: "0.88rem", fontWeight: 700,
                color: "var(--text-primary)", whiteSpace: "nowrap",
                overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {board.name}
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                {totalTasks} {isAr ? "مهمة" : "tasks"} • {board.members.length} {isAr ? "عضو" : "members"}
              </div>
            </div>

            <div style={{ display: "flex", gap: "4px" }}>
              <Link
                href={`/tasks/${board.id}`}
                title={isAr ? "فتح اللوحة" : "Open Board"}
                style={{ color: "var(--text-muted)", display: "flex", alignItems: "center" }}
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink size={13} />
              </Link>
              <button
                onClick={() => setCollapsed(true)}
                title={isAr ? "طي" : "Collapse"}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-muted)", padding: "0", display: "flex", alignItems: "center",
                }}
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Columns & Tasks */}
      {!collapsed && (
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px 14px" }}>
          {filter && filtered ? (
            // Filtered flat view
            filtered.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.75rem", padding: "20px 0" }}>
                {isAr ? "لا توجد نتائج" : "No results"}
              </div>
            ) : (
              filtered.map(task => (
                <MiniTaskCard key={task.id} task={task} isAr={isAr} boardColor={board.color} />
              ))
            )
          ) : (
            // Grouped by column
            board.columns.map(col => (
              <div key={col.id} style={{ marginBottom: "14px" }}>
                {/* Column label */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  marginBottom: "6px",
                }}>
                  <div style={{
                    width: "8px", height: "8px", borderRadius: "50%",
                    background: COL_COLORS[col.color] || col.color, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {col.name}
                  </span>
                  <span style={{
                    fontSize: "0.65rem", color: "var(--text-muted)",
                    background: "var(--bg-elevated)", padding: "1px 6px", borderRadius: "10px",
                    marginLeft: "auto",
                  }}>
                    {col.task_count}
                  </span>
                </div>

                {/* Tasks */}
                {col.tasks.length === 0 ? (
                  <div style={{
                    fontSize: "0.7rem", color: "var(--text-muted)",
                    textAlign: "center", padding: "8px",
                    border: "1px dashed var(--border-subtle)", borderRadius: "6px",
                  }}>
                    {isAr ? "لا توجد مهام" : "Empty"}
                  </div>
                ) : (
                  col.tasks.map(task => (
                    <MiniTaskCard key={task.id} task={task} isAr={isAr} boardColor={board.color} />
                  ))
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AdminBoardsOverviewPage() {
  const { language } = useUIStore();
  const { user } = useAuthStore();
  const isAr = language === "ar";
  const [filter, setFilter] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: boards = [], isLoading, refetch, isFetching } = useQuery<BoardItem[]>({
    queryKey: ["admin-boards-overview"],
    queryFn: async () => {
      const { data } = await tasksApi.adminOverview();
      return data;
    },
    refetchInterval: 60_000, // auto-refresh every minute
  });

  // Stats
  const totalBoards = boards.length;
  const totalTasks = boards.reduce((s, b) => s + b.task_count, 0);
  const totalMembers = new Set(boards.flatMap(b => b.members.map(m => m.id))).size;
  const urgentTasks = boards
    .flatMap(b => b.columns.flatMap(c => c.tasks))
    .filter(t => t.priority === "urgent").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - var(--topbar-height) - var(--space-12))" }}>
      {/* Page Header */}
      <div style={{ marginBottom: "var(--space-4)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
          <Link href="/tasks" className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} />
          </Link>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "1.3rem", margin: 0 }}>
              {isAr ? "🎛️ لوحة مراقبة الأدمن" : "🎛️ Admin Boards Overview"}
            </h1>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>
              {isAr ? "متابعة جميع اللوحات والمهام في مكان واحد" : "Monitor all boards and tasks in one view"}
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
            <div className="search-input-wrapper">
              <Eye size={14} style={{ position: "absolute", left: "10px", color: "var(--text-muted)" }} />
              <input
                id="admin-overview-search"
                className="form-input search-input"
                style={{ height: "34px", paddingLeft: "32px", width: "200px" }}
                placeholder={isAr ? "فلتر المهام..." : "Filter tasks..."}
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
            </div>
            <button
              id="admin-overview-refresh"
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

        {/* Stats Bar */}
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          {[
            { icon: <LayoutGrid size={14} />, value: totalBoards, label: isAr ? "لوحة" : "Boards", color: "var(--brand-primary)" },
            { icon: <Layers size={14} />,     value: totalTasks,  label: isAr ? "مهمة" : "Tasks",  color: "#22c55e" },
            { icon: <User size={14} />,        value: totalMembers,label: isAr ? "عضو" : "Members", color: "#8b5cf6" },
            { icon: <AlertCircle size={14} />, value: urgentTasks, label: isAr ? "عاجل" : "Urgent", color: "#ef4444" },
          ].map((stat, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: "8px",
              background: "var(--bg-card)", borderRadius: "8px",
              padding: "8px 14px", border: "1px solid var(--border-subtle)",
              flex: 1,
            }}>
              <div style={{ color: stat.color }}>{stat.icon}</div>
              <div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Boards Horizontal Scroll Area */}
      {isLoading ? (
        <div style={{ display: "flex", gap: "var(--space-4)", flex: 1 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ minWidth: "290px", height: "100%", borderRadius: "12px" }} />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div className="empty-state" style={{ flex: 1 }}>
          <div className="empty-icon"><LayoutGrid size={24} /></div>
          <h3>{isAr ? "لا توجد لوحات" : "No boards found"}</h3>
          <p>{isAr ? "لم يتم إنشاء أي لوحات بعد" : "No boards have been created yet"}</p>
          <Link href="/tasks" className="btn btn-primary">
            {isAr ? "إدارة اللوحات" : "Manage Boards"}
          </Link>
        </div>
      ) : (
        <div
          ref={scrollRef}
          style={{
            display: "flex",
            gap: "12px",
            flex: 1,
            overflowX: "auto",
            overflowY: "hidden",
            paddingBottom: "8px",
          }}
          className="admin-boards-scroll"
        >
          {boards.map(board => (
            <BoardColumn
              key={board.id}
              board={board}
              isAr={isAr}
              filter={filter}
            />
          ))}
        </div>
      )}

      <style>{`
        .admin-task-card:hover {
          border-color: var(--brand-primary) !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .admin-boards-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .admin-boards-scroll::-webkit-scrollbar-track {
          background: var(--bg-elevated);
          border-radius: 3px;
        }
        .admin-boards-scroll::-webkit-scrollbar-thumb {
          background: var(--border-subtle);
          border-radius: 3px;
        }
        .admin-boards-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--text-muted);
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
