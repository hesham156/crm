"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { tasksApi, usersApi } from "@/lib/api";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import AutomationsModal from "@/components/kanban/AutomationsModal";
import { ArrowLeft, Users, Settings, MoreHorizontal, X, Check, Zap } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function BoardPage() {
  const qc = useQueryClient();
  const { boardId } = useParams<{ boardId: string }>();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isAutomationsModalOpen, setIsAutomationsModalOpen] = useState(false);
  
  // Settings State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsDescription, setSettingsDescription] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "table">("table");

  const { data: board, isLoading } = useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => {
      const { data } = await tasksApi.board(boardId);
      return data;
    },
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
          {/* Automations Button */}
          <button 
            className="btn btn-sm" 
            style={{ display: "flex", gap: "6px", alignItems: "center", background: "#2d3748", color: "#e2e8f0", border: "1px solid #4a5568" }}
            onClick={() => setIsAutomationsModalOpen(true)}
          >
            <Zap size={14} color="#fcd34d" />
            Automate / {board?.automations?.length || 0}
          </button>

          <div className="divider-vertical" style={{ height: "24px", margin: "0 var(--space-2)" }} />

          {/* View Toggle */}
          <div style={{ display: "flex", background: "var(--bg-elevated)", padding: "2px", borderRadius: "var(--radius-md)" }}>
            <button 
              className={`btn btn-sm ${viewMode === "table" ? "btn-secondary" : "btn-ghost"}`} 
              onClick={() => setViewMode("table")}
              style={{ border: "none" }}
            >
              Table
            </button>
            <button 
              className={`btn btn-sm ${viewMode === "kanban" ? "btn-secondary" : "btn-ghost"}`} 
              onClick={() => setViewMode("kanban")}
              style={{ border: "none" }}
            >
              Kanban
            </button>
          </div>

          <div className="divider-vertical" style={{ height: "24px", margin: "0 var(--space-2)" }} />

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
        <KanbanBoard boardId={boardId} viewMode={viewMode} />
      </div>

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
