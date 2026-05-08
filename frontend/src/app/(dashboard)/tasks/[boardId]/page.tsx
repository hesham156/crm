"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { tasksApi, usersApi } from "@/lib/api";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import BoardTableView from "@/components/kanban/BoardTableView";
import AutomationsModal from "@/components/kanban/AutomationsModal";
import TaskDetailModal from "@/components/kanban/TaskDetailModal";
import { ArrowLeft, Users, Settings, MoreHorizontal, X, Check, Zap, LayoutGrid, Table2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function BoardPage() {
  const qc = useQueryClient();
  const { boardId } = useParams<{ boardId: string }>();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isAutomationsModalOpen, setIsAutomationsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [tableSelectedTask, setTableSelectedTask] = useState<any>(null);

  // Settings State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsDescription, setSettingsDescription] = useState("");
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");

  const { data: board, isLoading } = useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => {
      const { data } = await tasksApi.board(boardId);
      return data;
    },
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ["tasks", boardId],
    queryFn: async () => {
      const { data } = await tasksApi.tasks({ board: boardId, is_archived: false });
      return data.results || data;
    },
    enabled: viewMode === "table",
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await usersApi.list();
      return data.results || data;
    },
    enabled: isInviteModalOpen,
  });

  const updateMembersMutation = useMutation({
    mutationFn: (memberIds: string[]) => tasksApi.updateBoard(boardId, { member_ids: memberIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board", boardId] });
      toast.success("Board members updated successfully");
      setIsInviteModalOpen(false);
    },
    onError: () => toast.error("Failed to update members"),
  });

  const updateBoardMutation = useMutation({
    mutationFn: (data: any) => tasksApi.updateBoard(boardId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board", boardId] });
      toast.success("Board settings updated!");
      setIsSettingsModalOpen(false);
    },
    onError: () => toast.error("Failed to update board settings"),
  });

  const deleteBoardMutation = useMutation({
    mutationFn: () => tasksApi.deleteBoard(boardId),
    onSuccess: () => {
      toast.success("Board deleted");
      window.location.href = "/tasks";
    },
    onError: () => toast.error("Failed to delete board"),
  });

  const createCustomFieldMutation = useMutation({
    mutationFn: (data: { name: string; field_type: string }) => tasksApi.createCustomField(boardId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board", boardId] });
      setNewFieldName("");
      setNewFieldType("text");
      toast.success("Custom field added");
    },
    onError: () => toast.error("Failed to add custom field"),
  });

  const deleteCustomFieldMutation = useMutation({
    mutationFn: (fieldId: string) => tasksApi.deleteCustomField(fieldId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board", boardId] });
      toast.success("Custom field deleted");
    },
    onError: () => toast.error("Failed to delete custom field"),
  });

  const handleOpenInvite = () => {
    setSelectedUserIds(board?.members?.map((m: any) => m.id) || []);
    setIsInviteModalOpen(true);
  };

  const handleSaveMembers = () => {
    updateMembersMutation.mutate(selectedUserIds);
  };

  const handleOpenSettings = () => {
    setSettingsName(board?.name || "");
    setSettingsDescription(board?.description || "");
    setIsSettingsModalOpen(true);
  };

  const handleSaveSettings = () => {
    updateBoardMutation.mutate({ name: settingsName, description: settingsDescription });
  };

  const handleDeleteBoard = () => {
    if (confirm("Are you sure you want to permanently delete this board?")) {
      deleteBoardMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div>
        <div className="skeleton" style={{ height: "60px", marginBottom: "var(--space-4)", borderRadius: "var(--radius-md)" }} />
        <div style={{ display: "flex", gap: "var(--space-4)" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ width: "300px", height: "500px", borderRadius: "var(--radius-lg)" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "calc(100vh - var(--topbar-height) - var(--space-12))", display: "flex", flexDirection: "column" }}>
      {/* Board Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-4)", flexShrink: 0 }}>
        <Link href="/tasks" className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} />
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flex: 1 }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "var(--radius-md)",
            background: board?.color || "var(--brand-primary)",
            opacity: 0.8,
          }} />
          <div>
            <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "1.25rem", lineHeight: 1.2 }}>
              {board?.name}
            </h1>
            {board?.description && (
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{board.description}</p>
            )}
          </div>
        </div>

        {/* Members & View & Automate */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          {/* View Toggle */}
          <div style={{ display: "flex", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            <button
              className={`btn btn-sm ${viewMode === "kanban" ? "btn-primary" : "btn-ghost"}`}
              style={{ borderRadius: 0, border: "none" }}
              onClick={() => setViewMode("kanban")}
              data-tooltip="Kanban View"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              className={`btn btn-sm ${viewMode === "table" ? "btn-primary" : "btn-ghost"}`}
              style={{ borderRadius: 0, border: "none", borderLeft: "1px solid var(--border-default)" }}
              onClick={() => setViewMode("table")}
              data-tooltip="Table View"
            >
              <Table2 size={14} />
            </button>
          </div>

          {/* Automations Button */}
          <button
            className="btn btn-sm"
            style={{ display: "flex", gap: "6px", alignItems: "center", background: "#2d3748", color: "#e2e8f0", border: "1px solid #4a5568" }}
            onClick={() => setIsAutomationsModalOpen(true)}
          >
            <Zap size={14} color="#fcd34d" />
            Automate / {board?.automations?.length || 0}
          </button>



          <div style={{ display: "flex" }}>
            {board?.members?.slice(0, 5).map((m: {id: string; full_name_en: string}) => (
              <div key={m.id} className="avatar avatar-sm" data-tooltip={m.full_name_en}
                style={{ marginLeft: "-6px", border: "2px solid var(--bg-base)" }}>
                {m.full_name_en.charAt(0)}
              </div>
            ))}
          </div>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleOpenInvite}
          >
            <Users size={14} />
            Invite
          </button>
          <button 
            className="btn btn-ghost btn-sm"
            onClick={handleOpenSettings}
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* Kanban Board / Table */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {viewMode === "kanban" ? (
          <KanbanBoard boardId={boardId} />
        ) : (
          <div style={{ height: "100%", overflowY: "auto" }}>
            <BoardTableView
              boardId={boardId}
              columns={board?.columns || []}
              tasks={allTasks}
              onTaskClick={(task) => setTableSelectedTask(task)}
            />
          </div>
        )}
      </div>

      {/* Task modal for table view clicks */}
      {tableSelectedTask && (
        <TaskDetailModal
          task={tableSelectedTask}
          boardId={boardId}
          onClose={() => setTableSelectedTask(null)}
        />
      )}

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsInviteModalOpen(false)}>
          <div className="modal modal-md">
            <div className="modal-header">
              <h3 className="modal-title">Invite Members to {board?.name}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsInviteModalOpen(false)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxHeight: "400px", overflowY: "auto" }}>
              {users.map((u: any) => {
                const isSelected = selectedUserIds.includes(u.id);
                return (
                  <div 
                    key={u.id}
                    onClick={() => {
                      if (isSelected) setSelectedUserIds(prev => prev.filter(id => id !== u.id));
                      else setSelectedUserIds(prev => [...prev, u.id]);
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3)",
                      borderRadius: "var(--radius-md)", cursor: "pointer",
                      background: isSelected ? "var(--bg-elevated)" : "transparent",
                      border: "1px solid",
                      borderColor: isSelected ? "var(--brand-primary)" : "var(--border-subtle)",
                      transition: "all var(--transition-fast)"
                    }}
                  >
                    <div className="avatar avatar-sm">{u.full_name_en.charAt(0)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{u.full_name_en}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{u.role}</div>
                    </div>
                    {isSelected && <Check size={18} style={{ color: "var(--brand-primary)" }} />}
                  </div>
                );
              })}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsInviteModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveMembers} disabled={updateMembersMutation.isPending}>
                {updateMembersMutation.isPending ? "Saving..." : "Save Members"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsSettingsModalOpen(false)}>
          <div className="modal modal-md">
            <div className="modal-header">
              <h3 className="modal-title">Board Settings</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsSettingsModalOpen(false)}><X size={18} /></button>
            </div>
            
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <div className="form-group">
                <label className="form-label">Board Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={settingsName}
                  onChange={(e) => setSettingsName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="form-input form-textarea" 
                  value={settingsDescription}
                  onChange={(e) => setSettingsDescription(e.target.value)}
                  style={{ minHeight: "80px" }}
                />
              </div>

              <div className="divider" />

              {/* Custom Fields Manager */}
              <div>
                <h4 style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "var(--space-3)" }}>Custom Fields</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                  {(board?.custom_fields || []).map((f: any) => (
                    <div key={f.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-2) var(--space-3)", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)" }}>
                      <span style={{ flex: 1, fontSize: "0.85rem", fontWeight: 600 }}>{f.name}</span>
                      <span className="badge" style={{ fontSize: "0.7rem" }}>{f.field_type}</span>
                      <button className="btn btn-ghost btn-sm" style={{ color: "var(--color-danger)", padding: "2px" }} onClick={() => deleteCustomFieldMutation.mutate(f.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <input
                    className="form-input"
                    placeholder="Field name..."
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    style={{ flex: 1, fontSize: "0.85rem" }}
                    onKeyDown={(e) => e.key === "Enter" && newFieldName && createCustomFieldMutation.mutate({ name: newFieldName, field_type: newFieldType })}
                  />
                  <select className="form-input form-select" value={newFieldType} onChange={(e) => setNewFieldType(e.target.value)} style={{ width: "100px", fontSize: "0.82rem" }}>
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="select">Select</option>
                    <option value="checkbox">Checkbox</option>
                    <option value="url">URL</option>
                  </select>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => newFieldName && createCustomFieldMutation.mutate({ name: newFieldName, field_type: newFieldType })}
                    disabled={!newFieldName || createCustomFieldMutation.isPending}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="divider" />

              <div>
                <h4 style={{ color: "var(--color-danger)", fontWeight: 700, fontSize: "0.9rem", marginBottom: "var(--space-2)" }}>Danger Zone</h4>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "var(--space-3)" }}>
                  Once you delete a board, all tasks and columns inside it will be permanently deleted. This action cannot be undone.
                </p>
                <button 
                  className="btn btn-secondary" 
                  style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}
                  onClick={handleDeleteBoard}
                  disabled={deleteBoardMutation.isPending}
                >
                  {deleteBoardMutation.isPending ? "Deleting..." : "Delete Board"}
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsSettingsModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveSettings} disabled={updateBoardMutation.isPending}>
                {updateBoardMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Automations Modal */}
      {isAutomationsModalOpen && (
        <AutomationsModal boardId={boardId} onClose={() => setIsAutomationsModalOpen(false)} />
      )}
    </div>
  );
}
