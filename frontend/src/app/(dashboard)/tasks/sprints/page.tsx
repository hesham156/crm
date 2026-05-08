"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import { ArrowLeft, Plus, Zap, Calendar, Target, CheckCircle2, Clock, Trash2, Edit2, X, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { format, isBefore, parseISO } from "date-fns";

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  planning: { bg: "#3b82f620", text: "#3b82f6", label: "Planning" },
  active:   { bg: "#22c55e20", text: "#22c55e", label: "Active" },
  completed:{ bg: "#94a3b820", text: "#94a3b8", label: "Completed" },
};

export default function SprintsPage() {
  const qc = useQueryClient();
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingSprint, setEditingSprint] = useState<any>(null);
  const [expandedSprints, setExpandedSprints] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: "", goal: "", start_date: "", end_date: "", status: "planning" });

  const { data: boards = [] } = useQuery({
    queryKey: ["boards"],
    queryFn: async () => {
      const { data } = await tasksApi.boards();
      return data.results || data;
    },
  });

  const { data: sprints = [], isLoading } = useQuery({
    queryKey: ["sprints", selectedBoardId],
    queryFn: async () => {
      if (!selectedBoardId) return [];
      const { data } = await tasksApi.sprints(selectedBoardId);
      return data.results || data;
    },
    enabled: !!selectedBoardId,
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => tasksApi.createSprint(selectedBoardId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprints", selectedBoardId] });
      setShowCreate(false);
      setForm({ name: "", goal: "", start_date: "", end_date: "", status: "planning" });
      toast.success("Sprint created!");
    },
    onError: () => toast.error("Failed to create sprint"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => tasksApi.updateSprint(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprints", selectedBoardId] });
      setEditingSprint(null);
      toast.success("Sprint updated!");
    },
    onError: () => toast.error("Failed to update sprint"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.deleteSprint(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprints", selectedBoardId] });
      toast.success("Sprint deleted");
    },
    onError: () => toast.error("Failed to delete sprint"),
  });

  const handleSubmit = () => {
    if (!form.name.trim()) return toast.error("Sprint name is required");
    if (!selectedBoardId) return toast.error("Select a board first");
    if (editingSprint) {
      updateMutation.mutate({ id: editingSprint.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const startEdit = (sprint: any) => {
    setEditingSprint(sprint);
    setForm({
      name: sprint.name,
      goal: sprint.goal || "",
      start_date: sprint.start_date || "",
      end_date: sprint.end_date || "",
      status: sprint.status,
    });
    setShowCreate(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedSprints((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeSprints = sprints.filter((s: any) => s.status === "active");
  const planningSprints = sprints.filter((s: any) => s.status === "planning");
  const completedSprints = sprints.filter((s: any) => s.status === "completed");

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <Link href="/tasks" className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Sprint Management</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
            Plan and track agile sprints with velocity metrics
          </p>
        </div>
        {selectedBoardId && (
          <button
            className="btn btn-primary"
            style={{ marginLeft: "auto" }}
            onClick={() => { setEditingSprint(null); setForm({ name: "", goal: "", start_date: "", end_date: "", status: "planning" }); setShowCreate(true); }}
          >
            <Plus size={16} /> New Sprint
          </button>
        )}
      </div>

      {/* Board Selector */}
      <div style={{ marginBottom: "var(--space-6)", background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)" }}>
        <label className="form-label">Select Board</label>
        <select
          className="form-input form-select"
          value={selectedBoardId}
          onChange={(e) => setSelectedBoardId(e.target.value)}
          style={{ maxWidth: 400 }}
        >
          <option value="">-- Choose a board --</option>
          {boards.map((b: any) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Create / Edit Form */}
      {showCreate && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--brand-primary)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)", marginBottom: "var(--space-6)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
            <h3 style={{ fontWeight: 600, margin: 0 }}>{editingSprint ? "Edit Sprint" : "New Sprint"}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowCreate(false); setEditingSprint(null); }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Sprint Name *</label>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Sprint 1, Q2 Sprint, etc."
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Goal</label>
              <textarea
                className="form-input"
                rows={2}
                value={form.goal}
                onChange={(e) => setForm(f => ({ ...f, goal: e.target.value }))}
                placeholder="What is the goal of this sprint?"
                style={{ resize: "vertical" }}
              />
            </div>
            <div>
              <label className="form-label">Start Date</label>
              <input type="date" className="form-input" value={form.start_date} onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">End Date</label>
              <input type="date" className="form-input" value={form.end_date} onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input form-select" value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={() => { setShowCreate(false); setEditingSprint(null); }}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingSprint ? "Save Changes" : "Create Sprint"}
            </button>
          </div>
        </div>
      )}

      {/* Sprint List */}
      {!selectedBoardId ? (
        <div style={{ textAlign: "center", padding: "var(--space-12)", color: "var(--text-muted)" }}>
          <Zap size={48} style={{ marginBottom: "var(--space-3)", opacity: 0.3 }} />
          <p>Select a board to manage its sprints</p>
        </div>
      ) : isLoading ? (
        <div style={{ textAlign: "center", padding: "var(--space-12)", color: "var(--text-muted)" }}>Loading...</div>
      ) : sprints.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--space-12)", color: "var(--text-muted)" }}>
          <Zap size={48} style={{ marginBottom: "var(--space-3)", opacity: 0.3 }} />
          <p style={{ marginBottom: "var(--space-2)" }}>No sprints yet</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Create First Sprint
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {/* Active Sprints */}
          {activeSprints.length > 0 && (
            <SprintGroup
              title="Active"
              sprints={activeSprints}
              expandedSprints={expandedSprints}
              onToggleExpand={toggleExpand}
              onEdit={startEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
              onStatusChange={(id, status) => updateMutation.mutate({ id, data: { status } })}
            />
          )}

          {/* Planning Sprints */}
          {planningSprints.length > 0 && (
            <SprintGroup
              title="Planning"
              sprints={planningSprints}
              expandedSprints={expandedSprints}
              onToggleExpand={toggleExpand}
              onEdit={startEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
              onStatusChange={(id, status) => updateMutation.mutate({ id, data: { status } })}
            />
          )}

          {/* Completed Sprints */}
          {completedSprints.length > 0 && (
            <SprintGroup
              title="Completed"
              sprints={completedSprints}
              expandedSprints={expandedSprints}
              onToggleExpand={toggleExpand}
              onEdit={startEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
              onStatusChange={(id, status) => updateMutation.mutate({ id, data: { status } })}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SprintGroup({ title, sprints, expandedSprints, onToggleExpand, onEdit, onDelete, onStatusChange }: {
  title: string;
  sprints: any[];
  expandedSprints: Set<string>;
  onToggleExpand: (id: string) => void;
  onEdit: (sprint: any) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  return (
    <div>
      <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-3)" }}>
        {title} ({sprints.length})
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {sprints.map((sprint: any) => (
          <SprintCard
            key={sprint.id}
            sprint={sprint}
            isExpanded={expandedSprints.has(sprint.id)}
            onToggle={() => onToggleExpand(sprint.id)}
            onEdit={() => onEdit(sprint)}
            onDelete={() => onDelete(sprint.id)}
            onStatusChange={(s) => onStatusChange(sprint.id, s)}
          />
        ))}
      </div>
    </div>
  );
}

function SprintCard({ sprint, isExpanded, onToggle, onEdit, onDelete, onStatusChange }: {
  sprint: any;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
}) {
  const statusInfo = STATUS_COLORS[sprint.status] || STATUS_COLORS.planning;
  const totalPoints = sprint.total_points || 0;
  const completedPoints = sprint.completed_points || 0;
  const progress = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;
  const taskCount = sprint.task_count || 0;

  const isOverdue = sprint.end_date && sprint.status !== "completed" &&
    isBefore(parseISO(sprint.end_date), new Date());

  return (
    <div style={{
      background: "var(--bg-card)",
      border: `1px solid ${sprint.status === "active" ? "var(--brand-primary)" : "var(--border-default)"}`,
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
    }}>
      {/* Sprint Header */}
      <div
        style={{ padding: "var(--space-4)", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}
        onClick={onToggle}
      >
        <div style={{ paddingTop: 2 }}>
          {isExpanded ? <ChevronDown size={16} style={{ color: "var(--text-secondary)" }} /> : <ChevronRight size={16} style={{ color: "var(--text-secondary)" }} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{sprint.name}</span>
            <span style={{
              padding: "2px 8px", borderRadius: 12, fontSize: "0.7rem", fontWeight: 600,
              background: statusInfo.bg, color: statusInfo.text,
            }}>
              {statusInfo.label}
            </span>
            {isOverdue && (
              <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: "0.7rem", fontWeight: 600, background: "#ef444420", color: "#ef4444" }}>
                Overdue
              </span>
            )}
          </div>

          {sprint.goal && (
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", margin: "0 0 var(--space-2)" }}>
              {sprint.goal}
            </p>
          )}

          {/* Dates + Stats Row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {sprint.start_date && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Calendar size={12} />
                {format(parseISO(sprint.start_date), "MMM d")}
                {sprint.end_date && ` → ${format(parseISO(sprint.end_date), "MMM d, yyyy")}`}
              </span>
            )}
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Target size={12} />
              {taskCount} task{taskCount !== 1 ? "s" : ""}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Zap size={12} />
              {completedPoints}/{totalPoints} pts
            </span>
            {sprint.status === "completed" && sprint.velocity > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#22c55e" }}>
                <CheckCircle2 size={12} />
                Velocity: {sprint.velocity}
              </span>
            )}
          </div>

          {/* Progress Bar */}
          {totalPoints > 0 && (
            <div style={{ marginTop: "var(--space-2)" }}>
              <div style={{ height: 4, background: "var(--bg-elevated)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${progress}%`,
                  background: sprint.status === "completed" ? "#22c55e" : "var(--brand-primary)",
                  borderRadius: 2,
                  transition: "width 0.3s ease",
                }} />
              </div>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{progress}% complete</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "var(--space-1)" }} onClick={(e) => e.stopPropagation()}>
          {sprint.status === "planning" && (
            <button
              className="btn btn-sm"
              style={{ background: "#22c55e20", color: "#22c55e", border: "1px solid #22c55e40", padding: "4px 10px", fontSize: "0.75rem" }}
              onClick={() => onStatusChange("active")}
              title="Start Sprint"
            >
              Start
            </button>
          )}
          {sprint.status === "active" && (
            <button
              className="btn btn-sm"
              style={{ background: "#94a3b820", color: "#94a3b8", border: "1px solid #94a3b840", padding: "4px 10px", fontSize: "0.75rem" }}
              onClick={() => onStatusChange("completed")}
              title="Complete Sprint"
            >
              Complete
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onEdit} title="Edit">
            <Edit2 size={14} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--color-danger)" }}
            onClick={() => { if (confirm("Delete this sprint?")) onDelete(); }}
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Expanded: Task List */}
      {isExpanded && (
        <div style={{ borderTop: "1px solid var(--border-default)", padding: "var(--space-3) var(--space-4)" }}>
          {!sprint.tasks || sprint.tasks.length === 0 ? (
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: 0 }}>No tasks assigned to this sprint.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {sprint.tasks?.map((task: any) => (
                <div key={task.id} style={{
                  display: "flex", alignItems: "center", gap: "var(--space-3)",
                  padding: "var(--space-2) var(--space-3)",
                  background: "var(--bg-elevated)", borderRadius: "var(--radius-md)",
                  fontSize: "0.82rem",
                }}>
                  <CheckCircle2 size={14} style={{ color: task.column_name?.toLowerCase() === "done" ? "#22c55e" : "var(--text-muted)", flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</span>
                  {task.story_points > 0 && (
                    <span style={{ padding: "1px 6px", background: "var(--brand-primary)20", color: "var(--brand-primary)", borderRadius: 8, fontWeight: 600, flexShrink: 0 }}>
                      {task.story_points} pts
                    </span>
                  )}
                  <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{task.column_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
