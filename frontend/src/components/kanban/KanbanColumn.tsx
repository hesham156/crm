"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import TaskCard from "./TaskCard";
import { Plus, MoreHorizontal, Edit2, Palette, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { tasksApi } from "@/lib/api";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

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
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const dotColor = COLOR_MAP[column.color] || "var(--col-gray)";
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this column?")) {
      try {
        await tasksApi.deleteColumn(column.id);
        qc.invalidateQueries({ queryKey: ["board"] });
        toast.success("Column deleted");
      } catch (err) {
        toast.error("Failed to delete column");
      }
    }
    setIsMenuOpen(false);
  };

  const handleRename = async () => {
    const newName = prompt("Enter new column name:", column.name);
    if (newName && newName.trim() && newName !== column.name) {
      try {
        await tasksApi.updateColumn(column.id, { name: newName.trim() });
        qc.invalidateQueries({ queryKey: ["board"] });
        toast.success("Column renamed");
      } catch (err) {
        toast.error("Failed to rename column");
      }
    }
    setIsMenuOpen(false);
  };

  const handleChangeColor = async (color: string) => {
    try {
      await tasksApi.updateColumn(column.id, { color });
      qc.invalidateQueries({ queryKey: ["board"] });
      toast.success("Color updated");
    } catch (err) {
      toast.error("Failed to update color");
    }
    setIsMenuOpen(false);
  };

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
        <div style={{ position: "relative" }} ref={menuRef}>
          <button 
            className="btn btn-ghost btn-sm" 
            style={{ padding: "4px" }}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <MoreHorizontal size={16} />
          </button>
          
          {isMenuOpen && (
            <div className="dropdown" style={{ 
              position: "absolute", 
              right: 0, 
              top: "calc(100% + 4px)", 
              zIndex: 50,
              width: "160px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-md)",
              padding: "var(--space-2) 0"
            }}>
              <button 
                className="dropdown-item" 
                onClick={handleRename}
                style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "8px 16px", background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", color: "var(--text-primary)" }}
              >
                <Edit2 size={14} /> Rename
              </button>
              
              <div style={{ padding: "8px 16px" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "4px" }}><Palette size={12}/> Color</div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {Object.keys(COLOR_MAP).map(c => (
                    <button 
                      key={c}
                      onClick={() => handleChangeColor(c)}
                      style={{ 
                        width: "16px", height: "16px", borderRadius: "50%", background: COLOR_MAP[c],
                        border: column.color === c ? "2px solid var(--text-primary)" : "none",
                        cursor: "pointer", padding: 0
                      }}
                    />
                  ))}
                </div>
              </div>
              
              <div className="divider" style={{ margin: "4px 0", borderTop: "1px dashed var(--border-subtle)" }} />
              
              <button 
                className="dropdown-item danger" 
                onClick={handleDelete}
                style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "8px 16px", background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", color: "var(--color-danger)" }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
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
