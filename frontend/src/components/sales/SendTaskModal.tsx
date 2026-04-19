"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { X, Send, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi, usersApi } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import toast from "react-hot-toast";

interface SendTaskModalProps {
  jobId: string;
  jobNumber: string;
  jobTitle: string;
  jobDescription?: string;
  jobClientRequirements?: string;
  jobPriority?: string;
  onClose: () => void;
}

export default function SendTaskModal({
  jobId,
  jobNumber,
  jobTitle,
  jobDescription,
  jobClientRequirements,
  jobPriority,
  onClose,
}: SendTaskModalProps) {
  const { language } = useUIStore();
  const isAr = language === "ar";
  const queryClient = useQueryClient();

  // ── Board + Column state ─────────────────────────────────────────────────
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [boardColumns, setBoardColumns] = useState<{ id: string; name: string; color: string }[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: boards = [] } = useQuery({
    queryKey: ["boards"],
    queryFn: async () => {
      const { data } = await tasksApi.boards();
      return data.results || data;
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await usersApi.list();
      return data.results || data;
    },
  });

  // ── Fetch columns when board changes ────────────────────────────────────
  const handleBoardChange = async (boardId: string) => {
    setSelectedBoardId(boardId);
    setBoardColumns([]);
    setValue("board_id", boardId);
    setValue("column_id", "");
    if (!boardId) return;
    setLoadingColumns(true);
    try {
      const { data } = await tasksApi.board(boardId);
      setBoardColumns(data.columns || []);
    } catch {
      setBoardColumns([]);
      toast.error(isAr ? "فشل تحميل القوائم" : "Failed to load columns");
    } finally {
      setLoadingColumns(false);
    }
  };

  // ── Form ─────────────────────────────────────────────────────────────────
  const baseDescription = [
    jobClientRequirements ? `**Client Requirements:**\n${jobClientRequirements}` : "",
    jobDescription ? `**Notes:**\n${jobDescription}` : "",
    `---\n**Linked Job:** [Job ${jobNumber}](/sales/jobs/${jobId})`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    defaultValues: {
      title: `${jobNumber} - ${jobTitle}`,
      description: baseDescription,
      board_id: "",
      column_id: "",
      assigned_to: "",
      priority: jobPriority || "normal",
      due_date: "",
    },
  });

  // ── Mutation ─────────────────────────────────────────────────────────────
  const { mutate, isPending } = useMutation({
    mutationFn: async (data: any) => {
      const response = await tasksApi.createTask(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (selectedBoardId) {
        queryClient.invalidateQueries({ queryKey: ["board", selectedBoardId] });
      }
      toast.success(isAr ? "تم إرسال المهمة للوحة بنجاح" : "Task sent to board successfully");
      onClose();
    },
    onError: () => {
      toast.error(isAr ? "فشل إرسال المهمة" : "Failed to create task");
    },
  });

  const onSubmit = (data: any) => {
    if (!data.board_id || !data.column_id) {
      toast.error(isAr ? "يرجى اختيار اللوحة والقائمة" : "Please select a board and column");
      return;
    }
    mutate({
      job: jobId,
      board: data.board_id,
      column: data.column_id,
      title: data.title,
      description: data.description,
      priority: data.priority,
      due_date: data.due_date || null,
      assigned_to_ids: data.assigned_to ? [data.assigned_to] : [],
    });
  };

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <div className="modal-backdrop" style={{ zIndex: 100 }}>
      <div className="modal animate-scale-in" style={{ maxWidth: "580px", width: "100%", padding: 0 }}>

        {/* Header */}
        <div className="modal-header" style={{ padding: "var(--space-4) var(--space-5)", borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 className="modal-title" style={{ fontSize: "1.1rem" }}>
            {isAr ? "إرسال كـ مهمة جديدة" : "Send as Task to Board"}
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", padding: "var(--space-5)" }}>

            {/* Task Title */}
            <div>
              <label className="form-label">{isAr ? "عنوان المهمة" : "Task Title"} *</label>
              <input
                type="text"
                className="form-input"
                {...register("title", { required: true })}
              />
            </div>

            {/* Board + Column */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
              {/* Board */}
              <div>
                <label className="form-label">{isAr ? "اللوحة" : "Target Board"} *</label>
                <select
                  className="form-input form-select"
                  value={selectedBoardId}
                  onChange={e => handleBoardChange(e.target.value)}
                >
                  <option value="">{isAr ? "اختر لوحة..." : "Select Board..."}</option>
                  {boards.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Column — populated dynamically after board fetch */}
              <div>
                <label className="form-label">
                  {isAr ? "القائمة (الكولم)" : "Target Column"} *
                  {loadingColumns && (
                    <Loader2 size={12} className="animate-spin" style={{ marginInlineStart: "6px", display: "inline" }} />
                  )}
                </label>
                <select
                  className="form-input form-select"
                  {...register("column_id", { required: true })}
                  disabled={!selectedBoardId || loadingColumns}
                  style={{ opacity: (!selectedBoardId || loadingColumns) ? 0.6 : 1 }}
                >
                  <option value="">
                    {!selectedBoardId
                      ? (isAr ? "اختر لوحة أولاً..." : "Select a board first...")
                      : loadingColumns
                      ? (isAr ? "جارٍ التحميل..." : "Loading columns...")
                      : (isAr ? "اختر قائمة..." : "Select Column...")}
                  </option>
                  {boardColumns.map(col => (
                    <option key={col.id} value={col.id}>
                      {col.name}
                    </option>
                  ))}
                </select>
                {errors.column_id && (
                  <span className="form-error">{isAr ? "مطلوب" : "Required"}</span>
                )}
              </div>
            </div>

            {/* Assignee + Priority */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
              <div>
                <label className="form-label">{isAr ? "تعيين موظف" : "Assign To"}</label>
                <select className="form-input form-select" {...register("assigned_to")}>
                  <option value="">{isAr ? "بدون تعيين" : "Unassigned"}</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.full_name_en}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">{isAr ? "الأولوية" : "Priority"}</label>
                <select className="form-input form-select" {...register("priority")}>
                  <option value="low">{isAr ? "منخفضة" : "Low"}</option>
                  <option value="normal">{isAr ? "عادية" : "Normal"}</option>
                  <option value="high">{isAr ? "مرتفعة" : "High"}</option>
                  <option value="urgent">{isAr ? "عاجلة جداً" : "Urgent"}</option>
                </select>
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="form-label">{isAr ? "تاريخ الاستحقاق" : "Due Date"}</label>
              <input type="date" className="form-input" {...register("due_date")} />
            </div>

            {/* Description */}
            <div>
              <label className="form-label">{isAr ? "الوصف" : "Task Description"}</label>
              <textarea
                className="form-input"
                rows={4}
                {...register("description")}
              />
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                {isAr
                  ? "سيحتوي الوصف على رابط ذكي للعودة لهذا الطلب."
                  : "The description will contain a smart link back to this job."}
              </p>
            </div>

          </div>

          {/* Footer */}
          <div className="modal-footer" style={{ padding: "var(--space-4)", background: "var(--bg-elevated)", borderTop: "1px solid var(--border-subtle)" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isPending}>
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button type="submit" className="btn btn-primary" disabled={isPending || !selectedBoardId}>
              {isPending
                ? <Loader2 className="animate-spin" size={16} />
                : <><Send size={16} style={{ marginInlineEnd: "6px" }} />{isAr ? "إرسال المهمة" : "Send Task"}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
