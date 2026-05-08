"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, Loader2, BookOpen, Trash2 } from "lucide-react";
import { MultiSelectSearch } from "@/components/ui/MultiSelectSearch";
import { getTaskTemplates, deleteTaskTemplate } from "./TaskDetailSidebar";

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

interface Props {
  columns: { id: string; name: string }[];
  users: { id: string; full_name_en: string }[];
  defaultColumnId?: string;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
}

export function TaskCreateForm({ columns, users, defaultColumnId, onClose, onSubmit, isPending }: Props) {
  const [templates, setTemplates] = useState(() => getTaskTemplates());
  const [showTemplates, setShowTemplates] = useState(false);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    defaultValues: {
      title: "",
      description: "",
      priority: "normal",
      due_date: "",
      column: defaultColumnId || "",
      assigned_to: [] as string[],
    },
  });

  const applyTemplate = (tpl: any) => {
    if (tpl.title) setValue("title", tpl.name);
    if (tpl.priority) setValue("priority", tpl.priority);
    if (tpl.description) setValue("description", tpl.description);
    setShowTemplates(false);
  };

  const handleDeleteTemplate = (id: string) => {
    deleteTaskTemplate(id);
    setTemplates(getTaskTemplates());
  };

  const handleFormSubmit = (data: any) => {
    const payload = { ...data };
    if (payload.due_date === "") payload.due_date = null;
    payload.assigned_to_ids = Array.isArray(payload.assigned_to) ? payload.assigned_to : [];
    delete payload.assigned_to;
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)}>
      <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {/* Template picker */}
        {templates.length > 0 && (
          <div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowTemplates((v) => !v)}
              style={{ fontSize: "0.8rem", color: "var(--brand-primary)" }}
            >
              <BookOpen size={13} /> Use Template ({templates.length})
            </button>
            {showTemplates && (
              <div style={{ marginTop: "var(--space-2)", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "var(--space-2)", display: "flex", flexDirection: "column", gap: "4px" }}>
                {templates.map((tpl: any) => (
                  <div key={tpl.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "6px var(--space-2)", borderRadius: "var(--radius-sm)", cursor: "pointer" }} className="hover:bg-hover">
                    <button type="button" style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }} onClick={() => applyTemplate(tpl)}>
                      {tpl.name}
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginLeft: "8px", textTransform: "capitalize" }}>{tpl.priority}</span>
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "2px", color: "var(--color-danger)" }} onClick={() => handleDeleteTemplate(tpl.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Task Title *</label>
          <input
            {...register("title", { required: "Title is required" })}
            id="task-title"
            className="form-input"
            placeholder="What needs to be done?"
            autoFocus
          />
          {errors.title && <span className="form-error">{errors.title.message}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea {...register("description")} id="task-desc" className="form-input form-textarea" placeholder="Add more details..." />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
          <div className="form-group">
            <label className="form-label">Column</label>
            <select {...register("column", { required: true })} className="form-input form-select">
              {columns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Assign To</label>
            <MultiSelectSearch
              options={users.map((u) => ({ id: u.id, label: u.full_name_en }))}
              selectedIds={watch("assigned_to") || []}
              onChange={(ids) => setValue("assigned_to", ids)}
              placeholder="Select assignees..."
            />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select {...register("priority")} className="form-input form-select">
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input {...register("due_date")} type="date" className="form-input" />
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={isPending} id="task-create-submit">
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Create Task
        </button>
      </div>
    </form>
  );
}
