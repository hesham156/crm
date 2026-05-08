"use client";

import { Flag, Clock, Archive, ArchiveRestore, BookmarkPlus, RefreshCw, Zap } from "lucide-react";
import { tasksApi } from "@/lib/api";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { MultiSelectSearch } from "@/components/ui/MultiSelectSearch";

const TEMPLATE_KEY = "task_templates_v1";

export function saveTaskTemplate(task: any) {
  const templates = getTaskTemplates();
  const tpl = {
    id: Date.now().toString(),
    name: task.title,
    priority: task.priority,
    estimated_minutes: task.estimated_minutes,
    description: task.description,
    client_status: task.client_status,
  };
  templates.push(tpl);
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
  return tpl;
}

export function getTaskTemplates() {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function deleteTaskTemplate(id: string) {
  const templates = getTaskTemplates().filter((t: any) => t.id !== id);
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
}

const PRIORITIES = [
  { value: "low", label: "Low", color: "var(--priority-low)" },
  { value: "normal", label: "Normal", color: "var(--priority-normal)" },
  { value: "high", label: "High", color: "var(--priority-high)" },
  { value: "urgent", label: "Urgent", color: "var(--priority-urgent)" },
];

interface Props {
  task: any;
  taskDetail: any;
  columns: { id: string; name: string }[];
  users: { id: string; full_name_en: string }[];
  boardId: string;
  board?: any;
  userRole: string | undefined;
  onClose: () => void;
  onUpdate: (data: unknown) => void;
  onTimerToggle: (action: "start" | "stop") => void;
  isTimerPending: boolean;
}

export function TaskDetailSidebar({
  task, taskDetail, columns, users, boardId, board, userRole,
  onClose, onUpdate, onTimerToggle, isTimerPending,
}: Props) {
  const qc = useQueryClient();
  const customFields = board?.custom_fields || [];

  const { data: sprintsData } = useQuery({
    queryKey: ["sprints", boardId],
    queryFn: async () => {
      const { data } = await tasksApi.sprints(boardId);
      return data.results || data;
    },
    enabled: !!boardId,
  });
  const sprints: any[] = sprintsData || [];

  return (
    <div style={{ padding: "var(--space-5)", overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div>
        <label className="form-label">Board Column</label>
        <select
          className="form-input form-select"
          defaultValue={task?.column}
          onChange={(e) => onUpdate({ column: e.target.value })}
        >
          {columns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="form-label">Client Status (Label)</label>
        <select
          className="form-input form-select"
          defaultValue={taskDetail?.client_status || "Pending"}
          onChange={(e) => onUpdate({ client_status: e.target.value })}
        >
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="تعديل جديد">تعديل جديد</option>
          <option value="معاينات">معاينات</option>
          <option value="اعتمد التعديل">اعتمد التعديل</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      <div style={{ zIndex: 10 }}>
        <label className="form-label">Assign To</label>
        <MultiSelectSearch
          options={users.map((u) => ({ id: u.id, label: u.full_name_en }))}
          selectedIds={(taskDetail?.assigned_to || task?.assigned_to || []).map((a: any) => a.id)}
          onChange={(ids) => onUpdate({ assigned_to_ids: ids })}
          placeholder="Select assignees..."
        />
      </div>

      <div>
        <label className="form-label">Priority</label>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              className="badge"
              style={{
                background: task?.priority === p.value ? `${p.color}20` : "var(--bg-elevated)",
                color: task?.priority === p.value ? p.color : "var(--text-secondary)",
                cursor: "pointer",
                border: "1px solid",
                borderColor: task?.priority === p.value ? `${p.color}40` : "var(--border-default)",
              }}
              onClick={() => onUpdate({ priority: p.value })}
            >
              <Flag size={10} />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="form-label">Due Date</label>
        <input
          type="date"
          className="form-input"
          defaultValue={task?.due_date || ""}
          onChange={(e) => onUpdate({ due_date: e.target.value || null })}
        />
      </div>

      <div>
        <label className="form-label">Estimated Time (Minutes)</label>
        <input
          type="number"
          className="form-input"
          defaultValue={taskDetail?.estimated_minutes || ""}
          placeholder="e.g. 120"
          onBlur={(e) => onUpdate({ estimated_minutes: parseInt(e.target.value) || 0 })}
        />
      </div>

      <div>
        <label className="form-label">Story Points</label>
        <input
          type="number"
          className="form-input"
          defaultValue={taskDetail?.story_points ?? task?.story_points ?? 0}
          min={0}
          placeholder="0"
          onBlur={(e) => onUpdate({ story_points: parseInt(e.target.value) || 0 })}
        />
      </div>

      {sprints.length > 0 && (
        <div>
          <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Zap size={13} style={{ color: "#f59e0b" }} />
            Sprint
          </label>
          <select
            className="form-input form-select"
            value={taskDetail?.sprint || task?.sprint || ""}
            onChange={(e) => onUpdate({ sprint: e.target.value || null })}
          >
            <option value="">No Sprint</option>
            {sprints.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status})
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="form-label">Time Logged</label>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
          <Clock size={16} />
          <span style={{ fontWeight: 700 }}>
            {taskDetail?.time_logged
              ? `${Math.floor(taskDetail.time_logged / 60)}h ${taskDetail.time_logged % 60}m`
              : "No time logged"}
          </span>
        </div>

        {taskDetail && (
          taskDetail.is_timer_running ? (
            <button
              className="btn btn-sm"
              style={{ width: "100%", background: "#ef4444", color: "white", justifyContent: "center", border: "none" }}
              onClick={() => onTimerToggle("stop")}
              disabled={isTimerPending}
            >
              <Clock size={14} className="pulse" /> Stop Timer
            </button>
          ) : (
            <button
              className="btn btn-sm btn-secondary"
              style={{ width: "100%", justifyContent: "center", color: "#22c55e", borderColor: "#22c55e" }}
              onClick={() => onTimerToggle("start")}
              disabled={isTimerPending}
            >
              <Clock size={14} /> Start Timer
            </button>
          )
        )}
      </div>

      {/* Custom Fields */}
      {customFields.length > 0 && (
        <div style={{ paddingTop: "var(--space-4)", borderTop: "1px dashed var(--border-subtle)" }}>
          <label className="form-label">Custom Fields</label>
          {customFields.map((field: any) => {
            const currentValue = taskDetail?.custom_field_values?.[field.id] ?? "";
            return (
              <div key={field.id} style={{ marginBottom: "var(--space-2)" }}>
                <label className="form-label" style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  {field.name}
                  {field.is_required && <span style={{ color: "var(--color-danger)" }}> *</span>}
                </label>
                {field.field_type === "select" ? (
                  <select
                    className="form-input form-select"
                    defaultValue={currentValue}
                    onChange={(e) => onUpdate({ custom_field_values: { ...taskDetail?.custom_field_values, [field.id]: e.target.value } })}
                  >
                    <option value="">Select...</option>
                    {field.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : field.field_type === "checkbox" ? (
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      defaultChecked={!!currentValue}
                      onChange={(e) => onUpdate({ custom_field_values: { ...taskDetail?.custom_field_values, [field.id]: e.target.checked } })}
                    />
                    <span style={{ fontSize: "0.82rem" }}>{field.name}</span>
                  </label>
                ) : (
                  <input
                    type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : field.field_type === "url" ? "url" : "text"}
                    className="form-input"
                    defaultValue={currentValue}
                    placeholder={`Enter ${field.name.toLowerCase()}...`}
                    onBlur={(e) => onUpdate({ custom_field_values: { ...taskDetail?.custom_field_values, [field.id]: e.target.value } })}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recurring Settings */}
      <div style={{ paddingTop: "var(--space-4)", borderTop: "1px dashed var(--border-subtle)" }}>
        <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <RefreshCw size={13} style={{ color: "var(--brand-primary)" }} />
          Recurrence
        </label>
        <select
          className="form-input form-select"
          defaultValue={taskDetail?.recurrence_rule || "none"}
          onChange={(e) => onUpdate({ recurrence_rule: e.target.value })}
          style={{ marginBottom: "var(--space-2)" }}
        >
          <option value="none">No Recurrence</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="custom">Custom (every N days)</option>
        </select>
        {taskDetail?.recurrence_rule && taskDetail.recurrence_rule !== "none" && (
          <>
            {taskDetail.recurrence_rule === "custom" && (
              <input
                type="number"
                className="form-input"
                defaultValue={taskDetail.recurrence_interval || 1}
                min={1}
                placeholder="Every N days"
                onBlur={(e) => onUpdate({ recurrence_interval: parseInt(e.target.value) || 1 })}
                style={{ marginBottom: "var(--space-2)" }}
              />
            )}
            <input
              type="date"
              className="form-input"
              defaultValue={taskDetail.recurrence_end_date || ""}
              onChange={(e) => onUpdate({ recurrence_end_date: e.target.value || null })}
              style={{ marginBottom: "var(--space-2)" }}
            />
            <button
              className="btn btn-sm btn-secondary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={async () => {
                try {
                  const { tasksApi } = await import("@/lib/api");
                  await tasksApi.spawnRecurrence(task.id);
                  qc.invalidateQueries({ queryKey: ["tasks", boardId] });
                  toast.success("Next occurrence created!");
                } catch (e: any) {
                  toast.error(e?.response?.data?.detail || "Failed to spawn recurrence");
                }
              }}
            >
              <RefreshCw size={13} /> Spawn Next Occurrence
            </button>
          </>
        )}
      </div>

      <div style={{ paddingTop: "var(--space-4)", borderTop: "1px dashed var(--border-subtle)" }}>
        <label className="form-label">Dependencies (Blocked By)</label>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "8px" }}>
          {taskDetail?.blocked_by_details?.map((b: any) => (
            <div key={b.id} style={{ background: "var(--bg-elevated)", padding: "4px 8px", borderRadius: "4px", fontSize: "0.8rem", display: "flex", justifyContent: "space-between", borderLeft: "2px solid #ef4444" }}>
              <span>{b.title}</span>
              <span style={{ color: "var(--text-muted)" }}>{b.column}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <input type="text" id="add-blocker-id" placeholder="Paste Task ID" className="form-input" style={{ fontSize: "0.8rem", padding: "4px 8px" }} />
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const el = document.getElementById("add-blocker-id") as HTMLInputElement;
              if (el?.value) {
                const currentBlockers = taskDetail?.blocked_by_details?.map((b: any) => b.id) || [];
                onUpdate({ blocked_by_ids: [...currentBlockers, el.value] });
                el.value = "";
              }
            }}
          >Add</button>
        </div>
      </div>

      <div style={{ marginTop: "auto", paddingTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {/* Save as Template */}
        <button
          className="btn btn-sm btn-secondary"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={() => {
            const tpl = saveTaskTemplate(taskDetail || task);
            toast.success(`Template "${tpl.name}" saved!`);
          }}
        >
          <BookmarkPlus size={14} /> Save as Template
        </button>

        {/* Archive / Unarchive */}
        <button
          className="btn btn-sm btn-secondary"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={() => {
            const isArchived = task?.is_archived;
            tasksApi.updateTask(task.id, { is_archived: !isArchived }).then(() => {
              qc.invalidateQueries({ queryKey: ["tasks", boardId] });
              toast.success(isArchived ? "Task restored" : "Task archived");
              onClose();
            }).catch(() => toast.error("Failed to update task"));
          }}
        >
          {task?.is_archived ? <><ArchiveRestore size={14} /> Restore Task</> : <><Archive size={14} /> Archive Task</>}
        </button>

        {userRole === "admin" && (
          <button
            className="btn btn-sm"
            style={{ width: "100%", background: "#ef444420", color: "#ef4444", border: "1px solid #ef444440", justifyContent: "center" }}
            onClick={() => {
              if (window.confirm("Are you sure you want to completely delete this task? This cannot be undone.")) {
                tasksApi.deleteTask(task.id).then(() => {
                  qc.invalidateQueries({ queryKey: ["tasks", boardId] });
                  toast.success("Task deleted permanently");
                  onClose();
                }).catch(() => toast.error("Failed to delete task"));
              }
            }}
          >
            Delete Task
          </button>
        )}
      </div>
    </div>
  );
}
