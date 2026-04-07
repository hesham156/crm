"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";
import Link from "next/link";
import { Plus, Columns, Search, Users, Lock, Unlock, MonitorPlay } from "lucide-react";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { formatDistanceToNow } from "date-fns";

const BOARD_COLORS = [
  "#f97316", "#8b5cf6", "#3b82f6", "#22c55e",
  "#ef4444", "#f59e0b", "#06b6d4", "#ec4899",
];

const BOARD_ICONS = [
  "layout", "printer", "palette", "package",
  "truck", "star", "zap", "target",
];

export default function TasksPage() {
  const { language } = useUIStore();
  const { user } = useAuthStore();
  const isAr = language === "ar";
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedColor, setSelectedColor] = useState(BOARD_COLORS[0]);
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  const { data: boards = [], isLoading } = useQuery({
    queryKey: ["boards"],
    queryFn: async () => {
      const { data } = await tasksApi.boards();
      return data.results || data;
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { name: "", description: "", is_private: false },
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) =>
      tasksApi.createBoard({ ...data as object, color: selectedColor }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boards"] });
      toast.success("Board created!");
      setShowCreate(false);
      reset();
    },
    onError: () => toast.error("Failed to create board"),
  });

  const filteredBoards = boards.filter((b: { name: string }) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? "اللوحات والمهام" : "Boards & Tasks"}</h1>
          <p className="page-subtitle">{isAr ? "إدارة مهام الفريق والمشاريع" : "Manage team tasks and projects"}</p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <div className="search-input-wrapper">
            <Search size={16} style={{ position: "absolute", left: "12px", color: "var(--text-muted)" }} />
            <input
              id="boards-search"
              className="form-input search-input"
              placeholder={isAr ? "بحث في اللوحات..." : "Search boards..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ height: "36px" }}
            />
          </div>
          {isAdminOrManager && (
            <Link
              href="/tasks/admin"
              className="btn btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <MonitorPlay size={16} style={{ color: "var(--brand-primary)" }} />
              {isAr ? "مراقبة الكل" : "Monitor All"}
            </Link>
          )}
          <button id="create-board-btn" className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            {isAr ? "لوحة جديدة" : "New Board"}
          </button>
        </div>
      </div>

      {/* Boards Grid */}
      {isLoading ? (
        <div className="grid-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "160px", borderRadius: "var(--radius-lg)" }} />
          ))}
        </div>
      ) : filteredBoards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Columns size={24} /></div>
          <h3>{isAr ? "لا توجد لوحات" : "No boards yet"}</h3>
          <p>{isAr ? "أنشئ أول لوحة لبدء إدارة مهامك" : "Create your first board to start managing tasks"}</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            {isAr ? "إنشاء لوحة" : "Create Board"}
          </button>
        </div>
      ) : (
        <div className="grid-3">
          {filteredBoards.map((board: {
            id: string;
            name: string;
            description: string;
            color: string;
            is_private: boolean;
            task_count: number;
            members: { id: string; full_name_en: string }[];
            created_at: string;
          }) => (
            <Link
              key={board.id}
              href={`/tasks/${board.id}`}
              className="card"
              style={{
                display: "block",
                textDecoration: "none",
                borderLeft: `4px solid ${board.color}`,
                transition: "all var(--transition-fast)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-3)" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--radius-md)",
                  background: `${board.color}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                }}>
                  📋
                </div>
                <span style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem" }}>
                  {board.is_private ? <Lock size={12} /> : <Unlock size={12} />}
                  {board.is_private ? "Private" : "Team"}
                </span>
              </div>

              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, marginBottom: "4px" }}>{board.name}</h3>
              {board.description && (
                <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "var(--space-3)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {board.description}
                </p>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-3)" }}>
                <div style={{ display: "flex" }}>
                  {board.members?.slice(0, 4).map((m) => (
                    <div key={m.id} className="avatar avatar-sm" style={{ marginLeft: "-6px", border: "2px solid var(--bg-card)" }}>
                      {m.full_name_en.charAt(0)}
                    </div>
                  ))}
                  {board.members?.length > 4 && (
                    <div className="avatar avatar-sm" style={{ marginLeft: "-6px", border: "2px solid var(--bg-card)", background: "var(--bg-active)", color: "var(--text-secondary)", fontSize: "0.65rem" }}>
                      +{board.members.length - 4}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {board.task_count} tasks
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Board Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal modal-md">
            <div className="modal-header">
              <h3 className="modal-title">{isAr ? "إنشاء لوحة جديدة" : "Create New Board"}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <div className="form-group">
                  <label className="form-label">{isAr ? "اسم اللوحة" : "Board Name"} *</label>
                  <input
                    id="board-name-input"
                    {...register("name", { required: "Board name is required" })}
                    className="form-input"
                    placeholder={isAr ? "مثال: طلبات الطباعة" : "e.g. Printing Jobs"}
                    autoFocus
                  />
                  {errors.name && <span className="form-error">{errors.name.message}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">{isAr ? "الوصف" : "Description"}</label>
                  <textarea {...register("description")} className="form-input form-textarea" style={{ minHeight: "80px" }} />
                </div>
                <div className="form-group">
                  <label className="form-label">{isAr ? "اللون" : "Color"}</label>
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    {BOARD_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background: color,
                          border: selectedColor === color ? "3px solid white" : "3px solid transparent",
                          boxShadow: selectedColor === color ? "0 0 0 2px " + color : "none",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
                  <input {...register("is_private")} type="checkbox" style={{ accentColor: "var(--brand-primary)" }} />
                  <span style={{ fontSize: "0.875rem" }}>{isAr ? "لوحة خاصة (فقط للأعضاء)" : "Private board (members only)"}</span>
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button id="board-submit" type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
                  <Plus size={16} />
                  {isAr ? "إنشاء اللوحة" : "Create Board"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
