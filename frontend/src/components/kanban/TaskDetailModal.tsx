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
            <TaskDetailTabs
              task={task}
              taskDetail={taskDetail}
              users={users}
              board={board}
              boardId={boardId}
              currentUserName={user?.full_name_en}
              currentUserId={user?.id}
              userRole={user?.role}
              onUpdate={(data) => updateMutation.mutate(data)}
              onAddComment={(body, mentions) => commentMutation.mutate({ body, mentions })}
              onEditComment={(commentId, body) => editCommentMutation.mutate({ commentId, body })}
              onDeleteComment={(commentId) => deleteCommentMutation.mutate(commentId)}
              onLogTime={(minutes) => timeLogMutation.mutate(minutes)}
              onUploadFile={(file) => uploadAttachmentMutation.mutate(file)}
              onAddLink={(url, name) => addLinkMutation.mutate({ url, name })}
              onDeleteAttachment={(id) => deleteAttachmentMutation.mutate(id)}
              isCommentPending={commentMutation.isPending}
              isUploadPending={uploadAttachmentMutation.isPending}
              isAddLinkPending={addLinkMutation.isPending}
            />
            <TaskDetailSidebar
              task={task}
              taskDetail={taskDetail}
              columns={columns}
              users={users}
              boardId={boardId}
              board={board}
              userRole={user?.role}
              onClose={onClose}
              onUpdate={(data) => updateMutation.mutate(data)}
              onTimerToggle={(action) => toggleTimerMutation.mutate(action)}
              isTimerPending={toggleTimerMutation.isPending}
            />
          </div>
        )}
      </div>
    </div>
  );
}
