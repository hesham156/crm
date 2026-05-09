"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi, usersApi } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import { TaskCreateForm } from "./TaskCreateForm";
import { TaskDetailTabs } from "./TaskDetailTabs";
import { TaskDetailSidebar } from "./TaskDetailSidebar";

interface Task {
  id: string;
  title: string;
  description: string;
  priority: string;
  due_date: string | null;
  column: string;
  assigned_to: any[];
}

export default function TaskDetailModal({
  task, boardId, defaultColumnId, onClose,
}: {
  task: Task | null;
  boardId: string;
  defaultColumnId?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isNew = !task;

  const { data: columns = [] } = useQuery({
    queryKey: ["columns", boardId],
    queryFn: async () => {
      const { data } = await tasksApi.columns(boardId);
      return data.results || data;
    },
    enabled: !!boardId,
  });

  const { data: board } = useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => {
      const { data } = await tasksApi.board(boardId);
      return data;
    },
    enabled: !!boardId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await usersApi.list();
      return data.results || data;
    },
  });

  const { data: taskDetail } = useQuery({
    queryKey: ["task", task?.id],
    queryFn: async () => {
      const { data } = await tasksApi.task(task!.id);
      return data;
    },
    enabled: !!task?.id,
  });

  const showApiError = (err: any, fallback: string) => {
    const errMsg = err?.response?.data;
    if (errMsg && typeof errMsg === "object") {
      const firstKey = Object.keys(errMsg)[0];
      const text = Array.isArray(errMsg[firstKey]) ? errMsg[firstKey][0] : errMsg[firstKey];
      toast.error(`${firstKey}: ${text}`);
    } else {
      toast.error(fallback);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: unknown) => tasksApi.createTask({ ...data as object, board: boardId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks", boardId] }); toast.success("Task created!"); onClose(); },
    onError: (err: any) => showApiError(err, "Failed to create task"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: unknown) => tasksApi.updateTask(task!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks", boardId] }); qc.invalidateQueries({ queryKey: ["task", task!.id] }); toast.success("Task updated!"); },
    onError: (err: any) => showApiError(err, "Failed to update task"),
  });

  const commentMutation = useMutation({
    mutationFn: ({ body, mentions }: { body: string; mentions?: string[] }) => tasksApi.addComment(task!.id, body, mentions),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["task", task!.id] }); toast.success("Comment added!"); },
  });

  const editCommentMutation = useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) => tasksApi.updateComment(commentId, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["task", task!.id] }); toast.success("Comment updated!"); },
    onError: () => toast.error("Failed to update comment"),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => tasksApi.deleteComment(commentId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["task", task!.id] }); toast.success("Comment deleted"); },
    onError: () => toast.error("Failed to delete comment"),
  });

  const timeLogMutation = useMutation({
    mutationFn: (minutes: number) => tasksApi.logTime(task!.id, { duration: minutes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["task", task!.id] }); qc.invalidateQueries({ queryKey: ["tasks", boardId] }); toast.success("Time logged!"); },
  });

  const toggleTimerMutation = useMutation({
    mutationFn: (action: "start" | "stop") => tasksApi.toggleTimer(task!.id, action),
    onSuccess: (_data, action) => {
      qc.invalidateQueries({ queryKey: ["tasks", boardId] });
      qc.invalidateQueries({ queryKey: ["task", task!.id] });
      toast.success(action === "start" ? "Timer started!" : "Timer stopped and time logged!");
    },
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: (file: File) => tasksApi.uploadAttachment(task!.id, file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["task", task!.id] }); toast.success("File uploaded!"); },
    onError: (err: any) => {
      const detail = err?.response?.data;
      const msg = typeof detail === "object"
        ? Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join(", ")
        : "Failed to upload file";
      toast.error(msg);
    },
  });

  const addLinkMutation = useMutation({
    mutationFn: ({ url, name }: { url: string; name: string }) => tasksApi.addLinkAttachment(task!.id, url, name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["task", task!.id] }); toast.success("Link added!"); },
    onError: () => toast.error("Failed to add link"),
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => tasksApi.deleteAttachment(attachmentId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["task", task!.id] }); toast.success("Attachment removed"); },
    onError: () => toast.error("Failed to remove attachment"),
  });

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${isNew ? "modal-md" : "modal-xl"}`} style={{ width: isNew ? "560px" : "900px" }}>
        <div className="modal-header">
          <h3 className="modal-title">{isNew ? "Create Task" : "Task Details"}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>

        {isNew ? (
          <TaskCreateForm
            columns={columns}
            users={users}
            defaultColumnId={defaultColumnId}
            onClose={onClose}
            onSubmit={(data) => createMutation.mutate(data)}
            isPending={createMutation.isPending}
          />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", height: "600px" }}>
            {/* Left: Main content */}
            <div style={{ padding: "var(--space-6)", borderRight: "1px solid var(--border-subtle)", overflowY: "auto" }}>
              <input
                defaultValue={task?.title}
                className="form-input"
                style={{ fontSize: "1.1rem", fontWeight: 700, border: "none", background: "transparent", padding: "0 0 var(--space-3)", outline: "none", width: "100%", color: "var(--text-primary)" }}
                onBlur={(e) => updateMutation.mutate({ title: e.target.value })}
              />

              {/* Tabs */}
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
                    onBlur={(e) => updateMutation.mutate({ description: e.target.value })}
                    style={{ minHeight: "120px" }}
                  />

                  {/* Subtasks */}
                  {taskDetail?.subtasks?.length > 0 && (
                    <div style={{ marginTop: "var(--space-4)" }}>
                      <h4 style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "var(--space-3)" }}>Subtasks</h4>
                      {taskDetail.subtasks.map((sub: Task) => (
                        <div key={sub.id} style={{
                          display: "flex", alignItems: "center", gap: "var(--space-2)",
                          padding: "var(--space-2)", borderRadius: "var(--radius-sm)",
                          background: "var(--bg-elevated)", marginBottom: "var(--space-1)",
                        }}>
                          <input type="checkbox" style={{ accentColor: "var(--brand-primary)" }} />
                          <span style={{ fontSize: "0.875rem" }}>{sub.title}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ─── Attachments Section ─── */}
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
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                          onClick={() => { setShowLinkInput((v) => !v); }}
                          title="Add link"
                        >
                          <Link2 size={12} /> Link
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadAttachmentMutation.isPending}
                          title="Upload file"
                        >
                          {uploadAttachmentMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                          Upload
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          style={{ display: "none" }}
                          onChange={(e) => handleFilesDrop(e.target.files)}
                        />
                      </div>
                    </div>

                    {/* Link input */}
                    {showLinkInput && (
                      <div style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-default)",
                        borderRadius: "var(--radius-md)",
                        padding: "var(--space-3)",
                        marginBottom: "var(--space-3)",
                        display: "flex", flexDirection: "column", gap: "var(--space-2)"
                      }}>
                        <input
                          className="form-input"
                          style={{ fontSize: "0.85rem" }}
                          placeholder="Paste URL (e.g. https://drive.google.com/...)" 
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddLink()}
                          autoFocus
                        />
                        <input
                          className="form-input"
                          style={{ fontSize: "0.85rem" }}
                          placeholder="Label (optional)"
                          value={linkName}
                          onChange={(e) => setLinkName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddLink()}
                        />
                        <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setShowLinkInput(false)}>Cancel</button>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={handleAddLink}
                            disabled={!linkUrl.trim() || addLinkMutation.isPending}
                          >
                            {addLinkMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                            Add Link
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Drag & Drop Zone */}
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleFilesDrop(e.dataTransfer.files); }}
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: `2px dashed ${isDragOver ? "var(--brand-primary)" : "var(--border-subtle)"}`,
                        borderRadius: "var(--radius-md)",
                        padding: "var(--space-4)",
                        textAlign: "center",
                        cursor: "pointer",
                        background: isDragOver ? "var(--brand-primary-alpha, rgba(249,115,22,0.07))" : "transparent",
                        transition: "all 0.2s",
                        marginBottom: taskDetail?.attachments?.length > 0 ? "var(--space-3)" : 0,
                        display: taskDetail?.attachments?.length === 0 ? "block" : "none",
                      }}
                    >
                      <Upload size={20} style={{ color: "var(--text-muted)", marginBottom: "4px" }} />
                      <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>Drag & drop files here, or click to browse</p>
                    </div>

                    {/* Attachments List */}
                    {taskDetail?.attachments?.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        {taskDetail.attachments.map((att: any) => (
                          <div key={att.id} style={{
                            display: "flex", alignItems: "center", gap: "var(--space-2)",
                            padding: "var(--space-2) var(--space-3)",
                            background: "var(--bg-elevated)",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border-subtle)",
                          }}>
                            {att.attachment_type === "link"
                              ? <Link2 size={14} style={{ color: "#3b82f6", flexShrink: 0 }} />
                              : <File size={14} style={{ color: "var(--brand-primary)", flexShrink: 0 }} />
                            }
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {att.filename}
                              </p>
                              <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                {att.uploaded_by_name} · {format(new Date(att.uploaded_at), "MMM d, HH:mm")}
                                {att.attachment_type === "file" && att.file_size > 0 && (
                                  <> · {(att.file_size / 1024).toFixed(1)} KB</>
                                )}
                              </p>
                            </div>
                            <a
                              href={att.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "var(--text-muted)", display: "flex" }}
                              title="Open"
                            >
                              <ExternalLink size={13} />
                            </a>
                            <button
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: "2px" }}
                              onClick={() => deleteAttachmentMutation.mutate(att.id)}
                              title="Remove"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                        {/* small drag zone when items exist */}
                        <div
                          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                          onDragLeave={() => setIsDragOver(false)}
                          onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleFilesDrop(e.dataTransfer.files); }}
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            border: `1px dashed ${isDragOver ? "var(--brand-primary)" : "var(--border-subtle)"}`,
                            borderRadius: "var(--radius-sm)",
                            padding: "var(--space-2)",
                            textAlign: "center",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            transition: "all 0.2s",
                          }}
                        >
                          + Drop or click to add more files
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "activity" && (
                <div>
                  <h4 style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "var(--space-4)" }}>Audit Log</h4>
                  {!taskDetail?.activities?.length && <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No activity recorded yet.</p>}

                  <div style={{ position: "relative", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                    {/* timeline line */}
                    {taskDetail?.activities?.length > 1 && (
                      <div style={{ position: "absolute", left: "6px", top: "10px", bottom: "10px", width: "2px", background: "var(--border-subtle)" }} />
                    )}

                    {taskDetail?.activities?.map((act: any) => {
                      const isBoardMove = (act.field_changed || "").toLowerCase().includes("board");
                      const dotColor = isBoardMove ? "#8b5cf6" : "var(--brand-primary)";
                      return (
                        <div key={act.id} style={{ position: "relative", display: "flex", gap: "var(--space-3)", fontSize: "0.85rem" }}>
                          {/* Timeline dot */}
                          <div style={{
                            position: "absolute", left: "-20px", top: "4px",
                            width: "10px", height: "10px", borderRadius: "50%",
                            background: dotColor, border: "2px solid var(--bg-default)",
                          }} />

                          {/* Content */}
                          <div style={{ flex: 1 }}>
                            {isBoardMove ? (
                              /* ── Board transition card ── */
                              <div style={{
                                background: "#8b5cf608", border: "1px solid #8b5cf625",
                                borderRadius: "8px", padding: "8px 12px",
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#8b5cf6" }}>
                                    🔀 {act.field_changed}
                                  </span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                  <span style={{
                                    fontSize: "0.75rem", padding: "2px 8px", borderRadius: "6px",
                                    background: "var(--bg-elevated)", color: "var(--text-secondary)",
                                    textDecoration: "line-through",
                                  }}>
                                    {act.old_value || "—"}
                                  </span>
                                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>→</span>
                                  <span style={{
                                    fontSize: "0.75rem", padding: "2px 8px", borderRadius: "6px",
                                    background: "#8b5cf615", color: "#8b5cf6", fontWeight: 700,
                                  }}>
                                    {act.new_value}
                                  </span>
                                </div>
                                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>
                                  {act.user_name || "Automation"} · {format(new Date(act.timestamp), "MMM d, HH:mm")}
                                </span>
                              </div>
                            ) : (
                              /* ── Regular activity ── */
                              <div>
                                <p style={{ margin: 0 }}>
                                  <span style={{ fontWeight: 700 }}>{act.user_name || "System"}</span>
                                  {" changed "}
                                  <span style={{ fontWeight: 600 }}>{act.field_changed}</span>
                                  {" from "}
                                  <span style={{ textDecoration: "line-through", color: "var(--text-muted)" }}>{act.old_value || "Empty"}</span>
                                  {" to "}
                                  <span style={{ fontWeight: 600 }}>{act.new_value}</span>
                                </p>
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                  {format(new Date(act.timestamp), "MMM d, HH:mm")}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}


              {activeTab === "comments" && (
                <div>
                  {/* Comments list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
                    {taskDetail?.comments?.map((c: {id: string; author_name: string; body: string; created_at: string}) => (
                      <div key={c.id} style={{ display: "flex", gap: "var(--space-2)" }}>
                        <div className="avatar avatar-sm">{c.author_name?.charAt(0)}</div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                            <span style={{ fontWeight: 700, fontSize: "0.82rem" }}>{c.author_name}</span>
                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              {format(new Date(c.created_at), "MMM d, HH:mm")}
                            </span>
                          </div>
                          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "2px" }}>{c.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add comment */}
                  <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end" }}>
                    <div className="avatar avatar-sm">{user?.full_name_en?.charAt(0)}</div>
                    <div style={{ flex: 1 }}>
                      <MentionTextArea
                        id="comment-input"
                        className="form-input form-textarea"
                        placeholder="Write a comment... (Type @ to mention)"
                        value={commentBody}
                        onChange={setCommentBody}
                        users={users.filter((u: any) => u.role === "admin" || (board?.members && board.members.some((m: any) => m.id === u.id)))}
                        onMentionAdd={(userId) => {
                          if (!mentionIds.includes(userId)) setMentionIds((prev) => [...prev, userId]);
                        }}
                        style={{ minHeight: "70px" }}
                      />
                    </div>
                    <button
                      id="comment-submit"
                      className="btn btn-primary btn-sm"
                      onClick={handleComment}
                      disabled={!commentBody.trim() || commentMutation.isPending}
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "time" && (
                <div>
                  <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
                    <input
                      className="form-input"
                      type="number"
                      placeholder="Minutes to log"
                      value={timeMinutes}
                      onChange={(e) => setTimeMinutes(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-primary" onClick={handleTimeLog} disabled={!timeMinutes}>
                      <Clock size={16} />Log Time
                    </button>
                  </div>
                  {taskDetail?.time_logs?.map((log: {id: string; user_name: string; duration: number; note: string; logged_at: string}) => (
                    <div key={log.id} style={{
                      display: "flex", alignItems: "center", gap: "var(--space-3)",
                      padding: "var(--space-2) var(--space-3)", background: "var(--bg-elevated)",
                      borderRadius: "var(--radius-md)", marginBottom: "var(--space-2)",
                    }}>
                      <Clock size={14} style={{ color: "var(--text-muted)" }} />
                      <span style={{ fontSize: "0.85rem", flex: 1 }}>{log.user_name}</span>
                      <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>{log.duration}m</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        {format(new Date(log.logged_at), "MMM d")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Properties */}
            <div style={{ padding: "var(--space-5)", overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <div>
                <label className="form-label">Board Column</label>
                <select
                  className="form-input form-select"
                  defaultValue={task?.column}
                  onChange={(e) => updateMutation.mutate({ column: e.target.value })}
                >
                  {columns.map((c: {id: string; name: string}) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Client Status (Label)</label>
                <select
                  className="form-input form-select"
                  defaultValue={taskDetail?.client_status || "Pending"}
                  onChange={(e) => updateMutation.mutate({ client_status: e.target.value })}
                >
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="تعديل جديد">تعديل جديد</option>
                  <option value="معاينات">معاينات</option>
                  <option value="اعتمد التعديل">اعتمد التعديل</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div style={{ zIndex: 10 }}>
                <label className="form-label">Assign To</label>
                <MultiSelectSearch
                  options={users.map((u: any) => ({ id: u.id, label: u.full_name_en }))}
                  selectedIds={(taskDetail?.assigned_to || task?.assigned_to || []).map((a: any) => a.id)}
                  onChange={(ids) => updateMutation.mutate({ assigned_to_ids: ids })}
                  placeholder="Select assignees..."
                />
              </div>

              <div>
                <label className="form-label">Priority</label>
                <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      className={`badge ${task?.priority === p.value ? "" : ""}`}
                      style={{
                        background: task?.priority === p.value ? `${p.color}20` : "var(--bg-elevated)",
                        color: task?.priority === p.value ? p.color : "var(--text-secondary)",
                        cursor: "pointer",
                        border: "1px solid",
                        borderColor: task?.priority === p.value ? `${p.color}40` : "var(--border-default)",
                      }}
                      onClick={() => updateMutation.mutate({ priority: p.value })}
                    >
                      <Flag size={10} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label">Due Date</label>
                <input
                  type="date"
                  className="form-input"
                  defaultValue={task?.due_date || ""}
                  onChange={(e) => updateMutation.mutate({ due_date: e.target.value || null })}
                />
              </div>

              <div>
                <label className="form-label">Estimated Time (Minutes)</label>
                <input
                  type="number"
                  className="form-input"
                  defaultValue={taskDetail?.estimated_minutes || ""}
                  placeholder="e.g. 120"
                  onBlur={(e) => updateMutation.mutate({ estimated_minutes: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <label className="form-label">Time Logged</label>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
                  <Clock size={16} />
                  <span style={{ fontWeight: 700 }}>
                    {taskDetail?.time_logged
                      ? `${Math.floor(taskDetail.time_logged / 60)}h ${taskDetail.time_logged % 60}m`
                      : "No time logged"}
                  </span>
                </div>
                
                {/* Timer Control */}
                {!isNew && taskDetail && (
                  <div>
                    {taskDetail.is_timer_running ? (
                      <button 
                        className="btn btn-sm" 
                        style={{ width: "100%", background: "#ef4444", color: "white", justifyContent: "center", border: "none" }}
                        onClick={() => toggleTimerMutation.mutate("stop")}
                        disabled={toggleTimerMutation.isPending}
                      >
                        <Clock size={14} className="pulse" /> Stop Timer
                      </button>
                    ) : (
                      <button 
                        className="btn btn-sm btn-secondary" 
                        style={{ width: "100%", justifyContent: "center", color: "#22c55e", borderColor: "#22c55e" }}
                        onClick={() => toggleTimerMutation.mutate("start")}
                        disabled={toggleTimerMutation.isPending}
                      >
                        <Clock size={14} /> Start Timer
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              {!isNew && (
                <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px dashed var(--border-subtle)" }}>
                    <label className="form-label">Dependencies (Blocked By)</label>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "8px" }}>
                        {taskDetail?.blocked_by_details?.map((b: any) => (
                            <div key={b.id} style={{ background: "var(--bg-elevated)", padding: "4px 8px", borderRadius: "4px", fontSize: "0.8rem", display: "flex", justifyContent: "space-between", borderLeft: "2px solid #ef4444" }}>
                                <span>{b.title}</span>
                                <span style={{ color: "var(--text-muted)" }}>{b.column}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                       <input type="text" id="add-blocker-id" placeholder="Paste Task ID" className="form-input" style={{ fontSize: "0.8rem", padding: "4px 8px" }} />
                       <button 
                         className="btn btn-secondary btn-sm" 
                         onClick={() => {
                             const el = document.getElementById("add-blocker-id") as HTMLInputElement;
                             if(el && el.value) {
                                 const currentBlockers = taskDetail?.blocked_by_details?.map((b:any) => b.id) || [];
                                 updateMutation.mutate({ blocked_by_ids: [...currentBlockers, el.value] });
                                 el.value = "";
                             }
                         }}
                       >Select</button>
                    </div>
                </div>
              )}
              
              {!isNew && user?.role === "admin" && (
                <div style={{ marginTop: "auto", paddingTop: "var(--space-4)" }}>
                  <button
                    className="btn btn-sm"
                    style={{ width: "100%", background: "#ef444420", color: "#ef4444", border: "1px solid #ef444440", justifyContent: "center" }}
                    onClick={() => {
                      if (window.confirm("Are you sure you want to completely delete this task? This cannot be undone.")) {
                         tasksApi.deleteTask(task.id).then(() => {
                            qc.invalidateQueries({ queryKey: ["tasks", boardId] });
                            toast.success("Task deleted permanently");
                            onClose();
                         }).catch(() => toast.error("Failed to delete task"));
                      }
                    }}
                  >
                    Delete Task
                  </button>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
