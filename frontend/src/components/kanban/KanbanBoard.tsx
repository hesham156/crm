"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  DndContext, DragOverlay, closestCorners, PointerSensor,
  useSensor, useSensors, DragStartEvent, DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import KanbanColumn from "./KanbanColumn";
import TaskCard from "./TaskCard";
import TaskDetailModal from "./TaskDetailModal";
import BoardTableView from "./BoardTableView";
import { Plus, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

interface Task {
  id: string;
  title: string;
  description: string;
  priority: string;
  due_date: string | null;
  assigned_to: any[];
  tags: any[];
  comments_count: number;
  subtasks_count: number;
  time_logged: number;
  position: number;
  column: string;
  start_date: string | null;
  client_status: string;
  is_checked: boolean;
  parent?: string | null;
}

interface Column {
  id: string;
  name: string;
  color: string;
  position: number;
  task_count: number;
}

interface KanbanBoardProps {
  boardId: string;
  viewMode?: "kanban" | "table";
}

export default function KanbanBoard({ boardId, viewMode = "kanban" }: KanbanBoardProps) {
  const qc = useQueryClient();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTaskColumn, setNewTaskColumn] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Fetch board
  const { data: board, isLoading: boardLoading } = useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => {
      const { data } = await tasksApi.board(boardId);
      return data;
    },
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks", boardId],
    queryFn: async () => {
      const { data } = await tasksApi.tasks({ board: boardId, is_archived: false });
      return (data.results || data) as Task[];
    },
  });

  const searchParams = useSearchParams();
  const taskIdParam = searchParams.get("taskId");

  useEffect(() => {
    if (taskIdParam && tasks.length > 0 && !isTaskModalOpen) {
      const t = tasks.find(x => x.id === taskIdParam);
      if (t) {
        setSelectedTask(t);
        setIsTaskModalOpen(true);
      }
    }
  }, [taskIdParam, tasks]);

  const moveTaskMutation = useMutation({
    mutationFn: ({ taskId, columnId, position }: { taskId: string; columnId: string; position: number }) =>
      tasksApi.moveTask(taskId, { column_id: columnId, position }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", boardId] }),
    onError: () => toast.error("Failed to move task"),
  });

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const overId = over.id as string;
    // Determine if dropped on a column or task
    const isColumn = board?.columns?.some((c: Column) => c.id === overId);
    const targetColumnId = isColumn ? overId : tasks.find((t) => t.id === overId)?.column;

    if (!targetColumnId) return;

    const columnTasks = tasks.filter((t) => t.column === targetColumnId && t.id !== active.id);
    const position = isColumn ? columnTasks.length : columnTasks.findIndex((t) => t.id === overId);

    // Optimistic update
    qc.setQueryData(["tasks", boardId], (old: Task[] = []) =>
      old.map((t) =>
        t.id === active.id ? { ...t, column: targetColumnId, position } : t
      )
    );

    moveTaskMutation.mutate({
      taskId: active.id as string,
      columnId: targetColumnId,
      position: Math.max(0, position),
    });
  };

  const openTask = (task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const openNewTask = (columnId: string) => {
    setNewTaskColumn(columnId);
    setSelectedTask(null);
    setIsTaskModalOpen(true);
  };

  if (boardLoading || tasksLoading) {
    return (
      <div style={{ display: "flex", gap: "var(--space-4)", padding: "var(--space-2)" }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ width: "300px", height: "500px", borderRadius: "var(--radius-lg)", flexShrink: 0 }} />
        ))}
      </div>
    );
  }

    const columns: Column[] = board?.columns || [];

  if (viewMode === "table") {
    return (
      <>
        <BoardTableView 
          boardId={boardId}
          columns={columns}
          tasks={tasks}
          onTaskClick={openTask}
        />
        {isTaskModalOpen && (
          <TaskDetailModal
            task={selectedTask}
            boardId={boardId}
            defaultColumnId={newTaskColumn || undefined}
            onClose={() => {
              setIsTaskModalOpen(false);
              setSelectedTask(null);
              setNewTaskColumn(null);
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-board">
          <SortableContext
            items={columns.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            {columns.map((column) => {
              const columnTasks = tasks
                .filter((t) => t.column === column.id && !t.parent)
                .sort((a, b) => a.position - b.position);

              return (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={columnTasks}
                  onTaskClick={openTask}
                  onAddTask={() => openNewTask(column.id)}
                />
              );
            })}
          </SortableContext>

          {/* Add Column button */}
          <div style={{ flexShrink: 0 }}>
            <button
              className="btn btn-secondary"
              style={{ width: "200px", justifyContent: "center", borderStyle: "dashed" }}
              onClick={() => {
                const name = prompt("Enter column name:");
                if (name && name.trim()) {
                  tasksApi.createColumn(boardId, { name: name.trim(), color: "var(--brand-primary)" })
                    .then(() => {
                      qc.invalidateQueries({ queryKey: ["board", boardId] });
                      toast.success("Column added");
                    })
                    .catch(() => toast.error("Failed to add column"));
                }
              }}
            >
              <Plus size={16} />
              Add Column
            </button>
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeTask ? (
            <TaskCard task={activeTask} onClick={() => {}} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Task Modal */}
      {isTaskModalOpen && (
        <TaskDetailModal
          task={selectedTask}
          boardId={boardId}
          defaultColumnId={newTaskColumn || undefined}
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTask(null);
            setNewTaskColumn(null);
          }}
        />
      )}
    </>
  );
}
