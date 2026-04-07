"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import { Play, Pause, ChevronDown, ChevronRight, Plus, FileText, CheckCircle2, Circle, CornerDownRight } from "lucide-react";
import toast from "react-hot-toast";
import { parseISO, format, differenceInDays } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  client_status: string;
  is_checked: boolean;
  assigned_to: any[];
  tags: any[];
  time_logged: number;
  comments_count: number;
  subtasks_count: number;
  position: number;
  column: string;
  parent?: string | null;
}

interface Column {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface BoardTableViewProps {
  boardId: string;
  columns: Column[];
  tasks: Task[];
  onTaskClick: (task: any) => void;
}

export default function BoardTableView({ boardId, columns, tasks, onTaskClick }: BoardTableViewProps) {
  const qc = useQueryClient();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  const toggleGroup = (colId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [colId]: !prev[colId] }));
  };

  const toggleTask = (taskId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const createTaskMutation = useMutation({
    mutationFn: (data: Partial<Task>) => tasksApi.createTask(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", boardId] });
      toast.success("Item created");
    },
    onError: () => toast.error("Failed to create item"),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) => tasksApi.updateTask(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: ["tasks", boardId] });
      const previousTasks = qc.getQueryData(["tasks", boardId]);
      qc.setQueryData(["tasks", boardId], (old: Task[] | undefined) => 
        old?.map(t => (t.id === id ? { ...t, ...data } : t))
      );
      return { previousTasks };
    },
    onError: (err, variables, context: any) => {
      qc.setQueryData(["tasks", boardId], context.previousTasks);
      toast.error("Failed to save changes");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["tasks", boardId] });
    }
  });

  const handleUpdate = (id: string, data: Partial<Task>) => {
    updateTaskMutation.mutate({ id, data });
  };

  const handleAddItem = (columnId: string, parentId: string | null = null) => {
    const title = prompt(parentId ? "Enter Subitem Name:" : "Enter Item Name:");
    if (title && title.trim()) {
      createTaskMutation.mutate({
        title: title.trim(),
        board: boardId,
        column: columnId,
        parent: parentId,
        priority: "normal",
        client_status: "Pending"
      } as any);
      
      if (parentId && !expandedTasks[parentId]) {
        setExpandedTasks(prev => ({ ...prev, [parentId]: true }));
      }
    }
  };

  // Custom colors for Dropdowns
  const clientStatusColors: Record<string, string> = {
    "Pending": "var(--text-muted)",
    "Review": "var(--color-warning)",
    "Approved": "var(--color-success)",
    "Rejected": "var(--color-error, #ef4444)"
  };

  const priorityColors: Record<string, { bg: string, text: string }> = {
    low: { bg: "#bae6fd", text: "#0284c7" },
    normal: { bg: "#e2e8f0", text: "#475569" },
    high: { bg: "#fef08a", text: "#ca8a04" },
    urgent: { bg: "#fecaca", text: "#dc2626" },
  };

  const renderTimeline = (start: string | null, due: string | null) => {
    if (!start && !due) return <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center" }}>-</div>;
    
    // Very simple visual representation. Real monday.com timeline is more complex
    const sDate = start ? parseISO(start) : null;
    const dDate = due ? parseISO(due) : null;
    
    const displayStr = sDate && dDate 
      ? `${format(sDate, "MMM d")} - ${format(dDate, "MMM d")}`
      : dDate ? format(dDate, "MMM d") 
      : sDate ? format(sDate, "MMM d") 
      : "";

    return (
      <div style={{ position: "relative", width: "100%", height: "24px", background: "var(--bg-elevated)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "100%", background: "var(--brand-primary)", opacity: 0.2 }} />
        <span style={{ position: "relative", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-primary)" }}>{displayStr}</span>
      </div>
    );
  };

  const renderTaskRow = (task: Task, isSubitem = false, colColor: string) => {
    const children = isSubitem ? [] : tasks.filter(t => t.parent === task.id).sort((a,b) => a.position - b.position);
    const hasChildren = children.length > 0;
    const isExpanded = expandedTasks[task.id];
    
    return (
      <div key={task.id} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <div 
          style={{ 
            display: "grid", 
            gridTemplateColumns: "40px minmax(200px, 2fr) 120px 120px 100px 150px 120px 120px 50px", 
            gap: "1px", 
            background: isSubitem ? "var(--bg-elevated)" : "var(--border-subtle)", 
            border: isSubitem ? "none" : `1px solid ${colColor}30`,
            borderLeft: isSubitem ? "none" : `4px solid ${colColor}`,
            marginLeft: isSubitem ? "30px" : "0",
            borderRadius: isSubitem ? "0 var(--radius-sm) var(--radius-sm) 0" : "var(--radius-sm)",
            overflow: "hidden" 
          }}
        >
          {/* Checkbox & Expand */}
          <div 
            style={{ background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}
            onClick={() => handleUpdate(task.id, { is_checked: !task.is_checked })}
          >
            {isSubitem && (
              <div style={{ position: "absolute", left: "-20px", top: "50%", transform: "translateY(-50%)", color: "var(--border-subtle)" }}>
                <CornerDownRight size={16} />
              </div>
            )}
            {task.is_checked ? <CheckCircle2 size={18} color="var(--brand-primary)" /> : <Circle size={18} color="var(--text-muted)" />}
          </div>

          {/* Item Name */}
          <div 
            style={{ background: "var(--bg-base)", padding: "var(--space-2)", display: "flex", flexDirection: "column", justifyContent: "center" }}
          >
            <div style={{ display: "flex", alignItems: "center", fontWeight: 500 }}>
              {!isSubitem && (
                <div 
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", cursor: "pointer", marginRight: "var(--space-2)", color: hasChildren ? "var(--text-primary)" : "var(--text-muted)", flexShrink: 0 }}
                  onClick={(e) => toggleTask(task.id, e)}
                >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
              )}
              <span style={{ cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }} onClick={() => onTaskClick(task)}>
                {task.title}
              </span>
              {!isSubitem && (
                <span style={{ flexShrink: 0, fontSize: "0.7rem", background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: "10px", marginLeft: "10px", color: "var(--text-secondary)" }}>
                    {children.length} sub
                </span>
              )}
            </div>

            {/* Segmented Rollup Progress Bar */}
            {!isSubitem && hasChildren && (
              <div 
                style={{ 
                  display: "flex", height: "6px", width: "100%", marginTop: "var(--space-2)", 
                  borderRadius: "3px", overflow: "hidden", gap: "1px", marginLeft: "32px",
                  maxWidth: "calc(100% - 32px)"
                }}
              >
                {children.map(child => (
                  <div 
                    key={child.id} 
                    style={{ flex: 1, background: clientStatusColors[child.client_status || "Pending"] || "var(--text-muted)", transition: "all 0.3s" }} 
                    title={child.client_status}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Client Status */}
          <div style={{ background: "var(--bg-base)", position: "relative" }}>
            <select 
              value={task.client_status || "Pending"}
              onChange={(e) => handleUpdate(task.id, { client_status: e.target.value })}
              style={{
                width: "100%", height: "100%", padding: "var(--space-2)",
                background: clientStatusColors[task.client_status || "Pending"] || "var(--bg-elevated)",
                color: "#fff",
                border: "none", outline: "none", cursor: "pointer",
                textAlign: "center", fontSize: "0.8rem", fontWeight: 600,
                appearance: "none",
                opacity: task.client_status === "Pending" ? 0.7 : 1
              }}
            >
              <option value="Pending">Pending</option>
              <option value="Review">Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Priority */}
          <div style={{ background: "var(--bg-base)" }}>
            <select 
              value={task.priority}
              onChange={(e) => handleUpdate(task.id, { priority: e.target.value })}
              style={{
                width: "100%", height: "100%", padding: "var(--space-2)",
                background: priorityColors[task.priority]?.bg || "var(--bg-elevated)",
                color: priorityColors[task.priority]?.text || "var(--text-primary)",
                border: "none", outline: "none", cursor: "pointer",
                textAlign: "center", fontSize: "0.8rem", fontWeight: 600,
                appearance: "none", textTransform: "capitalize"
              }}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Assignees */}
          <div 
            style={{ background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-2)", cursor: "pointer" }}
            onClick={() => onTaskClick(task)}
          >
            {task.assigned_to && task.assigned_to.length > 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                {task.assigned_to.slice(0, 2).map((user: any, i: number) => (
                  <div key={user.id} className="avatar avatar-sm" style={{ marginLeft: i > 0 ? "-6px" : 0 }} data-tooltip={user.full_name_en}>
                    {user.full_name_en.charAt(0)}
                  </div>
                ))}
                {task.assigned_to.length > 2 && (
                  <div className="avatar avatar-sm" style={{ marginLeft: "-6px", background: "var(--bg-elevated)" }}>
                    +{task.assigned_to.length - 2}
                  </div>
                )}
              </div>
            ) : (
              <span style={{ width: "24px", height: "24px", borderRadius: "50%", border: "1px dashed var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus size={12} color="var(--text-muted)" />
              </span>
            )}
          </div>

          {/* Timeline */}
          <div style={{ background: "var(--bg-base)", padding: "var(--space-2)", display: "flex", alignItems: "center" }}>
            {renderTimeline(task.start_date, task.due_date)}
          </div>

          {/* Due Date */}
          <div style={{ background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <input 
              type="date" 
              value={task.due_date || ""} 
              onChange={(e) => handleUpdate(task.id, { due_date: e.target.value || null })}
              style={{
                width: "100%", height: "100%", padding: "var(--space-2)",
                background: "transparent", border: "none", outline: "none",
                textAlign: "center", fontSize: "0.75rem", fontFamily: "inherit"
              }}
            />
          </div>

          {/* Time Tracking */}
          <div style={{ background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)", padding: "var(--space-2)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, fontFamily: "monospace" }}>
              {Math.floor(task.time_logged / 60)}h {task.time_logged % 60}m
            </span>
            <button className="btn btn-ghost btn-sm" style={{ width: "24px", height: "24px", padding: 0, borderRadius: "50%" }}>
              <Play size={12} />
            </button>
          </div>

          {/* File */}
          <div style={{ background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={() => onTaskClick(task)}>
            {task.comments_count > 0 ? (
              <div style={{ position: "relative" }}>
                <FileText size={16} color="var(--brand-primary)" />
                <span style={{ position: "absolute", top: -5, right: -5, background: "var(--brand-secondary)", color: "#fff", fontSize: "0.5rem", width: "12px", height: "12px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                  {task.comments_count}
                </span>
              </div>
            ) : (
              <FileText size={16} color="var(--text-muted)" opacity={0.5} />
            )}
          </div>
        </div>

        {/* Subitems container */}
        {!isSubitem && isExpanded && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" }}>
            {children.map(child => renderTaskRow(child, true, colColor))}
            
            {/* Add Subitem Button */}
            <div 
              style={{ marginLeft: "30px", marginTop: "1px", background: "var(--bg-base)", padding: "4px var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-2)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.8rem", width: "fit-content" }}
              onClick={() => handleAddItem(task.column, task.id)}
            >
               <CornerDownRight size={14} /> <Plus size={14} /> <span>Add Subitem</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
                  
    <div style={{ padding: "var(--space-2) 0", overflowX: "auto" }}>
      <div style={{ minWidth: "1000px" }}>
        
        {/* Table Header */}
        <div style={{ display: "grid", gridTemplateColumns: "40px minmax(200px, 2fr) 120px 120px 100px 150px 120px 120px 50px", gap: "1px", background: "var(--border-subtle)", padding: "1px", marginBottom: "var(--space-4)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          <div style={{ background: "var(--bg-base)", padding: "var(--space-2)", textAlign: "center", fontWeight: 600, fontSize: "0.8rem", color: "var(--text-secondary)" }}>Check</div>
          <div style={{ background: "var(--bg-base)", padding: "var(--space-2)", fontWeight: 600, fontSize: "0.8rem", color: "var(--text-secondary)" }}>الطلب (Order) / العناصر</div>
          <div style={{ background: "var(--bg-base)", padding: "var(--space-2)", textAlign: "center", fontWeight: 600, fontSize: "0.8rem", color: "var(--text-secondary)" }}>حالة العميل</div>
          <div style={{ background: "var(--bg-base)", padding: "var(--space-2)", textAlign: "center", fontWeight: 600, fontSize: "0.8rem", color: "var(--text-secondary)" }}>الاولوية</div>
          <div style={{ background: "var(--bg-base)", padding: "var(--space-2)", textAlign: "center", fontWeight: 600, fontSize: "0.8rem", color: "var(--text-secondary)" }}>الموظف</div>
          <div style={{ background: "var(--bg-base)", padding: "var(--space-2)", textAlign: "center", fontWeight: 600, fontSize: "0.8rem", color: "var(--text-secondary)" }}>Timeline</div>
          <div style={{ background: "var(--bg-base)", padding: "var(--space-2)", textAlign: "center", fontWeight: 600, fontSize: "0.8rem", color: "var(--text-secondary)" }}>تاريخ التسليم</div>
          <div style={{ background: "var(--bg-base)", padding: "var(--space-2)", textAlign: "center", fontWeight: 600, fontSize: "0.8rem", color: "var(--text-secondary)" }}>Time tracking</div>
          <div style={{ background: "var(--bg-base)", padding: "var(--space-2)", textAlign: "center", fontWeight: 600, fontSize: "0.8rem", color: "var(--text-secondary)" }}>ملف</div>
        </div>

        {columns.map(col => {
          const colParentTasks = tasks.filter(t => t.column === col.id && !t.parent).sort((a,b) => a.position - b.position);
          const isCollapsed = collapsedGroups[col.id];

          return (
            <div key={col.id} style={{ marginBottom: "var(--space-6)" }}>
              {/* Group Header */}
              <div 
                style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)", cursor: "pointer", color: col.color }}
                onClick={() => toggleGroup(col.id)}
              >
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>{col.name}</h3>
                <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>{colParentTasks.length} طلبات</span>
              </div>

              {!isCollapsed && (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {colParentTasks.map(task => renderTaskRow(task, false, col.color))}
                  
                  {/* Add New Item row */}
                  <div 
                    style={{ marginTop: "2px", background: "var(--bg-base)", padding: "var(--space-2)", display: "flex", alignItems: "center", gap: "var(--space-2)", border: "1px dashed var(--border-subtle)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-muted)" }}
                    onClick={() => handleAddItem(col.id)}
                  >
                     <Plus size={16} /> <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>Add Order</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
