"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MessageSquare, Paperclip, Clock, AlertCircle, Calendar } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import clsx from "clsx";

const PRIORITY_COLORS: Record<string, string> = {
  low: "var(--priority-low)",
  normal: "var(--priority-normal)",
  high: "var(--priority-high)",
  urgent: "var(--priority-urgent)",
};

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
}

export default function TaskCard({
  task, onClick, isDragging = false,
}: {
  task: Task;
  onClick: () => void;
  isDragging?: boolean;
}) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`task-card ${isDragging ? "dragging" : ""}`}
      onClick={onClick}
    >
      {/* Priority indicator */}
      <div style={{
        width: "3px",
        height: "100%",
        background: PRIORITY_COLORS[task.priority] || "transparent",
        position: "absolute",
        left: 0,
        top: 0,
        borderRadius: "var(--radius-md) 0 0 var(--radius-md)",
      }} />

      {/* Title */}
      <div className="task-card-title" style={{ paddingLeft: "var(--space-2)" }}>
        {task.title}
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
            <span style={{ display: "flex", alignItems: "center", gap: "2px", fontSize: "0.72rem", color: "var(--text-muted)" }}>
              <Clock size={12} />
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
