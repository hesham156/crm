"use client";

import { useState, useRef } from "react";
import {
  Send, Clock, Paperclip, Flag, MessageSquare,
  Upload, Link2, Loader2, Plus, File, ExternalLink, Trash2, Pencil, X, Check,
  CheckSquare, Square,
} from "lucide-react";
import { tasksApi } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { MentionTextArea } from "@/components/ui/MentionTextArea";

// Fixes malformed attachment URLs where Django's build_absolute_uri prepends
// the server base URL to an already-absolute external storage URL.
function fixAttachmentUrl(url: string): string {
  if (!url) return url;
  const match = url.match(/\/(https?)\/(.+)$/);
  if (match) return `${match[1]}://${match[2]}`;
  return url;
}

type TabType = "details" | "comments" | "time" | "activity";

interface Props {
  task: any;
  taskDetail: any;
  users: { id: string; full_name_en: string; role: string }[];
  board: any;
  boardId?: string;
  currentUserName: string | undefined;
  currentUserId?: string;
  userRole?: string;
  onUpdate: (data: unknown) => void;
  onAddComment: (body: string, mentions: string[]) => void;
  onEditComment: (commentId: string, body: string) => void;
  onDeleteComment: (commentId: string) => void;
  onLogTime: (minutes: number) => void;
  onUploadFile: (file: File) => void;
  onAddLink: (url: string, name: string) => void;
  onDeleteAttachment: (id: string) => void;
  isCommentPending: boolean;
  isUploadPending: boolean;
  isAddLinkPending: boolean;
}

export function TaskDetailTabs({
  task, taskDetail, users, board, boardId, currentUserName, currentUserId, userRole,
  onUpdate, onAddComment, onEditComment, onDeleteComment, onLogTime, onUploadFile, onAddLink, onDeleteAttachment,
  isCommentPending, isUploadPending, isAddLinkPending,
}: Props) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("details");
  const [commentBody, setCommentBody] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [timeMinutes, setTimeMinutes] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const doneColumnId = board?.columns?.find((c: any) => c.name.toLowerCase() === "done")?.id;
  const todoColumnId = board?.columns?.[0]?.id;

  const handleSubtaskAdd = async () => {
    if (!newSubtaskTitle.trim() || !todoColumnId) return;
    setIsAddingSubtask(true);
    try {
      await tasksApi.createTask({
        title: newSubtaskTitle.trim(),
        board: task.board || task.board_id,
        column: todoColumnId,
        parent: task.id,
      });
      qc.invalidateQueries({ queryKey: ["task", task.id] });
      if (boardId) qc.invalidateQueries({ queryKey: ["tasks", boardId] });
      setNewSubtaskTitle("");
      setShowAddSubtask(false);
    } catch {
      // silently fail - user sees no change
    } finally {
      setIsAddingSubtask(false);
    }
  };

  const handleSubtaskToggle = async (subtask: any) => {
    const targetColumnId = subtask.column === doneColumnId ? todoColumnId : doneColumnId;
    if (!targetColumnId) return;
    try {
      await tasksApi.updateTask(subtask.id, { column: targetColumnId });
      qc.invalidateQueries({ queryKey: ["task", task.id] });
      if (boardId) qc.invalidateQueries({ queryKey: ["tasks", boardId] });
    } catch {
      // silently fail
    }
  };

  const handleComment = () => {
    if (!commentBody.trim()) return;
    onAddComment(commentBody, mentionIds);
    setCommentBody("");
    setMentionIds([]);
  };

  const handleTimeLog = () => {
    const mins = parseInt(timeMinutes);
    if (!mins) return;
    onLogTime(mins);
    setTimeMinutes("");
  };

  const handleFilesDrop = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => onUploadFile(f));
  };

  const handleAddLink = () => {
    if (!linkUrl.trim()) return;
    onAddLink(linkUrl.trim(), linkName.trim() || linkUrl.trim());
    setLinkUrl("");
    setLinkName("");
    setShowLinkInput(false);
  };

  const boardMembers: any[] = board?.members || [];
  const mentionableUsers = users.filter((u) =>
    u.role === "admin" || boardMembers.some((m: any) => m.id === u.id)
  );

  return (
    <div style={{ padding: "var(--space-6)", borderRight: "1px solid var(--border-subtle)", overflowY: "auto" }}>
      <input
        defaultValue={task?.title}
        className="form-input"
        style={{ fontSize: "1.1rem", fontWeight: 700, border: "none", background: "transparent", padding: "0 0 var(--space-3)", outline: "none", width: "100%", color: "var(--text-primary)" }}
        onBlur={(e) => onUpdate({ title: e.target.value })}
      />

      <div className="tab-bar">
        {(["details", "comments", "time", "activity"] as const).map((tab) => (
          <button
            key={tab}
            className={`tab-item ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "comments" && <MessageSquare size={14} />}
            {tab === "time" && <Clock size={14} />}
            {tab === "activity" && <Flag size={14} />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === "comments" && taskDetail?.comments_count > 0 && (
              <span className="nav-badge">{taskDetail.comments_count}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "details" && (
        <div>
          <label className="form-label">Description</label>
          <textarea
            defaultValue={task?.description}
            className="form-input form-textarea"
            placeholder="Add a description..."
            onBlur={(e) => onUpdate({ description: e.target.value })}
            style={{ minHeight: "120px" }}
          />

          {/* Subtasks */}
          <div style={{ marginTop: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
              <h4 style={{ fontWeight: 700, fontSize: "0.85rem", margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckSquare size={14} style={{ color: "var(--brand-primary)" }} />
                Subtasks
                {taskDetail?.subtasks?.length > 0 && (
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 400 }}>
                    {taskDetail.subtasks.filter((s: any) => s.column === doneColumnId).length}/{taskDetail.subtasks.length}
                  </span>
                )}
              </h4>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: "0.75rem" }} onClick={() => setShowAddSubtask(true)}>
                <Plus size={12} /> Add
              </button>
            </div>

            {/* Progress bar */}
            {taskDetail?.subtasks?.length > 0 && (
              <div style={{ marginBottom: "var(--space-3)" }}>
                {(() => {
                  const done = taskDetail.subtasks.filter((s: any) => s.column === doneColumnId).length;
                  const pct = Math.round((done / taskDetail.subtasks.length) * 100);
                  return (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "3px" }}>
                        <span>{pct}% complete</span>
                        <span>{done} of {taskDetail.subtasks.length}</span>
                      </div>
                      <div style={{ height: "5px", background: "var(--bg-elevated)", borderRadius: "99px", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "var(--color-success)" : "var(--brand-primary)", transition: "width 0.4s ease" }} />
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {taskDetail?.subtasks?.map((sub: any) => {
              const isDone = sub.column === doneColumnId;
              return (
                <div
                  key={sub.id}
                  style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-2)", borderRadius: "var(--radius-sm)", background: "var(--bg-elevated)", marginBottom: "var(--space-1)", cursor: "pointer" }}
                  onClick={() => handleSubtaskToggle(sub)}
                >
                  {isDone ? (
                    <CheckSquare size={16} style={{ color: "var(--color-success)", flexShrink: 0 }} />
                  ) : (
                    <Square size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: "0.875rem", textDecoration: isDone ? "line-through" : "none", color: isDone ? "var(--text-muted)" : "var(--text-primary)", flex: 1 }}>
                    {sub.title}
                  </span>
                  {sub.assigned_to?.length > 0 && (
                    <div className="avatar avatar-sm" style={{ fontSize: "0.6rem", width: "20px", height: "20px" }}>
                      {sub.assigned_to[0].full_name_en?.charAt(0)}
                    </div>
                  )}
                </div>
              );
            })}

            {showAddSubtask && (
              <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                <input
                  className="form-input"
                  style={{ flex: 1, fontSize: "0.85rem" }}
                  placeholder="Subtask title..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubtaskAdd();
                    if (e.key === "Escape") { setShowAddSubtask(false); setNewSubtaskTitle(""); }
                  }}
                  autoFocus
                />
                <button className="btn btn-primary btn-sm" onClick={handleSubtaskAdd} disabled={isAddingSubtask || !newSubtaskTitle.trim()}>
                  {isAddingSubtask ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setShowAddSubtask(false); setNewSubtaskTitle(""); }}>
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          <div style={{ marginTop: "var(--space-5)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
              <h4 style={{ fontWeight: 700, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px", margin: 0 }}>
                <Paperclip size={14} style={{ color: "var(--brand-primary)" }} />
                Attachments
                {taskDetail?.attachments?.length > 0 && (
                  <span style={{ background: "var(--brand-primary)", color: "white", borderRadius: "999px", fontSize: "0.7rem", padding: "1px 6px" }}>
                    {taskDetail.attachments.length}
                  </span>
                )}
              </h4>
              <div style={{ display: "flex", gap: "6px" }}>
                <button className="btn btn-secondary btn-sm" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => setShowLinkInput((v) => !v)}>
                  <Link2 size={12} /> Link
                </button>
                <button className="btn btn-secondary btn-sm" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => fileInputRef.current?.click()} disabled={isUploadPending}>
                  {isUploadPending ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Upload
                </button>
                <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => handleFilesDrop(e.target.files)} />
              </div>
            </div>

            {showLinkInput && (
              <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "var(--space-3)", marginBottom: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <input className="form-input" style={{ fontSize: "0.85rem" }} placeholder="Paste URL (e.g. https://drive.google.com/...)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddLink()} autoFocus />
                <input className="form-input" style={{ fontSize: "0.85rem" }} placeholder="Label (optional)" value={linkName} onChange={(e) => setLinkName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddLink()} />
                <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowLinkInput(false)}>Cancel</button>
                  <button className="btn btn-primary btn-sm" onClick={handleAddLink} disabled={!linkUrl.trim() || isAddLinkPending}>
                    {isAddLinkPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add Link
                  </button>
                </div>
              </div>
            )}

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleFilesDrop(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              style={{ border: `2px dashed ${isDragOver ? "var(--brand-primary)" : "var(--border-subtle)"}`, borderRadius: "var(--radius-md)", padding: "var(--space-4)", textAlign: "center", cursor: "pointer", background: isDragOver ? "rgba(249,115,22,0.07)" : "transparent", transition: "all 0.2s", display: taskDetail?.attachments?.length === 0 ? "block" : "none" }}
            >
              <Upload size={20} style={{ color: "var(--text-muted)", marginBottom: "4px" }} />
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>Drag & drop files here, or click to browse</p>
            </div>

            {taskDetail?.attachments?.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {taskDetail.attachments.map((att: any) => (
                  <div key={att.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-2) var(--space-3)", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    {att.attachment_type === "link" ? <Link2 size={14} style={{ color: "#3b82f6", flexShrink: 0 }} /> : <File size={14} style={{ color: "var(--brand-primary)", flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{att.filename}</p>
                      <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        {att.uploaded_by_name} · {format(new Date(att.uploaded_at), "MMM d, HH:mm")}
                        {att.attachment_type === "file" && att.file_size > 0 && <> · {(att.file_size / 1024).toFixed(1)} KB</>}
                      </p>
                    </div>
                    <a href={fixAttachmentUrl(att.file_url)} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-muted)", display: "flex" }}><ExternalLink size={13} /></a>
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: "2px" }} onClick={() => onDeleteAttachment(att.id)}><Trash2 size={13} /></button>
                  </div>
                ))}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleFilesDrop(e.dataTransfer.files); }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: `1px dashed ${isDragOver ? "var(--brand-primary)" : "var(--border-subtle)"}`, borderRadius: "var(--radius-sm)", padding: "var(--space-2)", textAlign: "center", cursor: "pointer", fontSize: "0.75rem", color: "var(--text-muted)", transition: "all 0.2s" }}
                >
                  + Drop or click to add more files
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "comments" && (
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
            {taskDetail?.comments?.map((c: any) => {
              const canEdit = c.author === currentUserId || userRole === "admin";
              const isEditing = editingCommentId === c.id;
              return (
                <div key={c.id} style={{ display: "flex", gap: "var(--space-2)" }}>
                  <div className="avatar avatar-sm">{c.author_name?.charAt(0)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.82rem" }}>{c.author_name}</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{format(new Date(c.created_at), "MMM d, HH:mm")}</span>
                      {c.updated_at !== c.created_at && (
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontStyle: "italic" }}>(edited)</span>
                      )}
                      {canEdit && !isEditing && (
                        <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "2px 4px", opacity: 0.6 }}
                            onClick={() => { setEditingCommentId(c.id); setEditingCommentBody(c.body); }}
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "2px 4px", opacity: 0.6, color: "var(--color-danger)" }}
                            onClick={() => { if (confirm("Delete this comment?")) onDeleteComment(c.id); }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div style={{ marginTop: "4px" }}>
                        <textarea
                          className="form-input form-textarea"
                          value={editingCommentBody}
                          onChange={(e) => setEditingCommentBody(e.target.value)}
                          style={{ minHeight: "60px", fontSize: "0.875rem" }}
                          autoFocus
                        />
                        <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => { onEditComment(c.id, editingCommentBody); setEditingCommentId(null); }}
                            disabled={!editingCommentBody.trim()}
                          >
                            <Check size={12} /> Save
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingCommentId(null)}>
                            <X size={12} /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "2px" }}>{c.body}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end" }}>
            <div className="avatar avatar-sm">{currentUserName?.charAt(0)}</div>
            <div style={{ flex: 1 }}>
              <MentionTextArea
                id="comment-input"
                className="form-input form-textarea"
                placeholder="Write a comment... (Type @ to mention)"
                value={commentBody}
                onChange={setCommentBody}
                users={mentionableUsers}
                onMentionAdd={(userId) => {
                  if (!mentionIds.includes(userId)) setMentionIds((prev) => [...prev, userId]);
                }}
                style={{ minHeight: "70px" }}
              />
            </div>
            <button id="comment-submit" className="btn btn-primary btn-sm" onClick={handleComment} disabled={!commentBody.trim() || isCommentPending}>
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {activeTab === "time" && (
        <div>
          <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
            <input className="form-input" type="number" placeholder="Minutes to log" value={timeMinutes} onChange={(e) => setTimeMinutes(e.target.value)} style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={handleTimeLog} disabled={!timeMinutes}>
              <Clock size={16} /> Log Time
            </button>
          </div>
          {taskDetail?.time_logs?.map((log: any) => (
            <div key={log.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-2) var(--space-3)", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", marginBottom: "var(--space-2)" }}>
              <Clock size={14} style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: "0.85rem", flex: 1 }}>{log.user_name}</span>
              <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>{log.duration}m</span>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{format(new Date(log.logged_at), "MMM d")}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === "activity" && (
        <div>
          <h4 style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "var(--space-4)" }}>Audit Log</h4>
          {!taskDetail?.activities?.length && <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No activity recorded yet.</p>}
          <div style={{ position: "relative", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {taskDetail?.activities?.length > 1 && (
              <div style={{ position: "absolute", left: "6px", top: "10px", bottom: "10px", width: "2px", background: "var(--border-subtle)" }} />
            )}
            {taskDetail?.activities?.map((act: any) => (
              <div key={act.id} style={{ position: "relative", display: "flex", gap: "var(--space-3)", fontSize: "0.85rem" }}>
                <div style={{ position: "absolute", left: "-20px", top: "4px", width: "10px", height: "10px", borderRadius: "50%", background: "var(--brand-primary)", border: "2px solid var(--bg-default)" }} />
                <div>
                  <p style={{ margin: 0 }}>
                    <span style={{ fontWeight: 700 }}>{act.user_name || "System"}</span> changed <span style={{ fontWeight: 600 }}>{act.field_changed}</span> from{" "}
                    <span style={{ textDecoration: "line-through", color: "var(--text-muted)" }}>{act.old_value || "Empty"}</span> to{" "}
                    <span style={{ fontWeight: 600 }}>{act.new_value}</span>
                  </p>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{format(new Date(act.timestamp), "MMM d, HH:mm")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
