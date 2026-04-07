"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import TaskCard from "./TaskCard";
import { Plus, MoreHorizontal } from "lucide-react";

const COLOR_MAP: Record<string, string> = {
  gray: "var(--col-gray)",
  blue: "var(--col-blue)",
  orange: "var(--col-orange)",
  green: "var(--col-green)",
  red: "var(--col-red)",
  purple: "var(--col-purple)",
  yellow: "var(--col-yellow)",
};

interface Column { id: string; name: string; color: string; task_count: number; }
interface Task { id: string; title: string; priority: string; due_date: string | null; assigned_to: unknown[]; tags: unknown[]; comments_count: number; subtasks_count: number; time_logged: number; }

export default function KanbanColumn({
  column, tasks, onTaskClick, onAddTask,
}: {
  column: Column;
  tasks: any[];
  onTaskClick: (task: any) => void;
  onAddTask: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const dotColor = COLOR_MAP[column.color] || "var(--col-gray)";

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column ${isOver ? "is-over" : ""}`}
    >
      {/* Header */}
      <div className="kanban-column-header">
        <div className="column-color-dot" style={{ background: dotColor }} />
        <span className="kanban-column-title">{column.name}</span>
        <span className="column-count">{tasks.length}</span>
        <button className="btn btn-ghost btn-sm" style={{ padding: "2px" }}>
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Tasks */}
      <div className="kanban-column-body">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div style={{
            padding: "var(--space-6)",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "0.8rem",
            border: "2px dashed var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            marginTop: "var(--space-2)",
          }}>
            Drop tasks here
          </div>
        )}
      </div>

      {/* Footer — Add Task */}
      <div className="kanban-column-footer">
        <button
          className="btn btn-ghost btn-sm"
          onClick={onAddTask}
          style={{ width: "100%", justifyContent: "flex-start", color: "var(--text-tertiary)" }}
        >
          <Plus size={14} />
          Add task
        </button>
      </div>
    </div>
  );
}
