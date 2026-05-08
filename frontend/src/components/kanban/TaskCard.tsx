"use client";

import { useState, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MessageSquare, Clock, AlertCircle, Calendar, Flag } from "lucide-react";
import { format, isPast, isToday } from "date-fns";

const PRIORITY_COLORS: Record<string, string> = {
  low: "var(--priority-low)",
  normal: "var(--priority-normal)",
  high: "var(--priority-high)",
  urgent: "var(--priority-urgent)",
};

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

interface Task {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  assigned_to: { id: string; full_name_en: string; avatar?: string }[];
  tags: { id: string; name: string; color: string }[];
  comments_count: number;
  subtasks_count: number;
  time_logged: number;
  progress?: number;
  is_timer_running?: boolean;
  is_archived?: boolean;
}

export default function TaskCard({
  task, onClick, isDragging = false, onQuickUpdate,
}: {
  task: Task;
  onClick: () => void;
  isDragging?: boolean;
  onQuickUpdate?: (id: string, data: { title?: string; priority?: string }) => void;
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  };

  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
  const isDueToday = task.due_date && isToday(new Date(task.due_date));

  const handleTitleDoubleClick = (e: React.MouseEvent) => {
    if (!onQuickUpdate) return;
    e.stopPropagation();
    setIsEditingTitle(true);
    setEditTitle(task.title);
    setTimeout(() => inputRef.current?.select(), 10);
  };

  const handleTitleSave = () => {
    if (editTitle.trim() && editTitle !== task.title && onQuickUpdate) {
      onQuickUpdate(task.id, { title: editTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handlePriorityClick = (e: React.MouseEvent) => {
    if (!onQuickUpdate) return;
    e.stopPropagation();
    setShowPriorityPicker((v) => !v);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, position: "relative" }}
      {...attributes}
      {...(isEditingTitle || showPriorityPicker ? {} : listeners)}
      className={`task-card ${isDragging ? "dragging" : ""}`}
      onClick={isEditingTitle || showPriorityPicker ? undefined : onClick}
    >
      {/* Priority indicator - clickable for quick change */}
      <div
        style={{
          width: "6px",
          height: "100%",
          background: PRIORITY_COLORS[task.priority] || "transparent",
          position: "absolute",
          left: 0,
          top: 0,
          borderRadius: "var(--radius-md) 0 0 var(--radius-md)",
          cursor: onQuickUpdate ? "pointer" : "default",
        }}
        onClick={handlePriorityClick}
        data-tooltip={`Priority: ${task.priority}. Click to change.`}
      />

      {/* Priority picker dropdown */}
      {showPriorityPicker && (
        <div
          style={{
            position: "absolute",
            top: "0",
            left: "14px",
            zIndex: 100,
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
            padding: "4px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {PRIORITIES.map((p) => (
            <button
              key={p}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: task.priority === p ? `${PRIORITY_COLORS[p]}20` : "transparent",
                cursor: "pointer",
                fontSize: "0.8rem",
                color: PRIORITY_COLORS[p],
                fontWeight: task.priority === p ? 700 : 400,
              }}
              onClick={() => {
                onQuickUpdate?.(task.id, { priority: p });
                setShowPriorityPicker(false);
              }}
            >
              <Flag size={11} />
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Title - double-click to edit */}
      <div className="task-card-title" style={{ paddingLeft: "var(--space-3)" }}>
        {isEditingTitle ? (
          <input
            ref={inputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleSave();
              if (e.key === "Escape") { setIsEditingTitle(false); setEditTitle(task.title); }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              border: "1px solid var(--brand-primary)",
              borderRadius: "var(--radius-sm)",
              padding: "2px 4px",
              fontSize: "0.875rem",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
            }}
            autoFocus
          />
        ) : (
          <span
            onDoubleClick={handleTitleDoubleClick}
            title={onQuickUpdate ? "Double-click to edit" : undefined}
          >
            {task.title}
          </span>
        )}
      </div>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "var(--space-2)" }}>
          {task.tags.slice(0, 3).map((tag: { id: string; name: string; color: string }) => (
            <span
              key={tag.id}
              className="badge"
              style={{ background: `${tag.color}20`, color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Progress Bar for Subtasks */}
      {task.subtasks_count > 0 && typeof task.progress === "number" && (
        <div style={{ marginTop: "var(--space-2)", marginBottom: "var(--space-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "2px" }}>
            <span>Progress</span>
            <span>{task.progress}%</span>
          </div>
          <div style={{ height: "4px", background: "var(--bg-elevated)", borderRadius: "2px", overflow: "hidden" }}>
             <div style={{ width: `${task.progress}%`, height: "100%", background: task.progress === 100 ? "var(--color-success)" : "var(--brand-primary)", transition: "width 0.3s ease" }} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="task-card-footer">
        {/* Due date */}
        {task.due_date && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "0.72rem",
            fontWeight: 600,
            color: isOverdue ? "var(--color-danger)" : isDueToday ? "var(--color-warning)" : "var(--text-muted)",
          }}>
            {isOverdue && <AlertCircle size={12} />}
            <Calendar size={12} />
            {format(new Date(task.due_date), "MMM d")}
          </div>
        )}

        {/* Meta icons */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginLeft: "auto" }}>
          {task.comments_count > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: "2px", fontSize: "0.72rem", color: "var(--text-muted)" }}>
              <MessageSquare size={12} />
              {task.comments_count}
            </span>
          )}
          {task.subtasks_count > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: "2px", fontSize: "0.72rem", color: "var(--text-muted)" }}>
              ☑ {task.subtasks_count}
            </span>
          )}
          {task.time_logged > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: "2px", fontSize: "0.72rem", color: task.is_timer_running ? "var(--color-success)" : "var(--text-muted)" }}>
              <Clock size={12} className={task.is_timer_running ? "pulse" : ""} />
              {Math.floor(task.time_logged / 60)}h
            </span>
          )}

          {/* Assignees */}
          <div className="task-card-assignees">
            {task.assigned_to.slice(0, 3).map((user: { id: string; full_name_en: string }) => (
              <div
                key={user.id}
                className="avatar avatar-sm"
                data-tooltip={user.full_name_en}
                style={{ fontSize: "0.6rem" }}
              >
                {user.full_name_en.charAt(0)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
