"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { formsApi } from "@/lib/api";
import {
  Plus, FileText, Copy, Trash2, Eye, BarChart2,
  ExternalLink, MoreHorizontal, ToggleLeft, ToggleRight,
  Search, Globe
} from "lucide-react";

interface Form {
  id: string;
  title: string;
  description: string;
  slug: string;
  is_active: boolean;
  primary_color: string;
  response_count: number;
  step_count: number;
  created_at: string;
}

export default function FormsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["forms"],
    queryFn: () => formsApi.list().then((r) => (r.data.results ?? r.data) as Form[]),
  });

  const createMutation = useMutation({
    mutationFn: (title: string) => formsApi.create({ title }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
      router.push(`/forms/builder/${res.data.id}`);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => formsApi.duplicate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forms"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => formsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forms"] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      formsApi.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forms"] }),
  });

  const forms = (data || []).filter((f) =>
    f.title.toLowerCase().includes(search.toLowerCase())
  );

  const publicBase =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "";

  return (
    <div style={{ padding: "var(--space-6)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            الفورمات
          </h1>
          <p style={{ color: "var(--text-muted)", marginTop: "var(--space-1)", fontSize: "0.875rem" }}>
            أنشئ فورمات لجمع بيانات العملاء وربطها بالـ CRM
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> فورم جديد
        </button>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "var(--space-5)", maxWidth: 360 }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        <input
          className="form-input"
          placeholder="ابحث عن فورم..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: 36 }}
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: "var(--space-10)", color: "var(--text-muted)" }}>
          جاري التحميل...
        </div>
      ) : forms.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-12)" }}>
          <FileText size={48} style={{ color: "var(--text-muted)", margin: "0 auto var(--space-4)" }} />
          <h3 style={{ color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
            لا توجد فورمات بعد
          </h3>
          <p style={{ color: "var(--text-muted)", marginBottom: "var(--space-4)", fontSize: "0.875rem" }}>
            أنشئ فورمتك الأولى لجمع بيانات العملاء
          </p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> إنشاء فورم
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "var(--space-4)" }}>
          {forms.map((form) => (
            <div
              key={form.id}
              className="card"
              style={{ position: "relative", cursor: "pointer", transition: "transform 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              {/* Color bar */}
              <div style={{
                height: 4,
                background: form.primary_color,
                borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
                margin: "calc(var(--space-4) * -1) calc(var(--space-4) * -1) var(--space-4)",
              }} />

              {/* Status badge */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
                <span className={`badge ${form.is_active ? "badge-success" : "badge-gray"}`}>
                  {form.is_active ? "نشط" : "متوقف"}
                </span>
                <div style={{ position: "relative" }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === form.id ? null : form.id); }}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {openMenu === form.id && (
                    <div
                      className="card"
                      style={{
                        position: "absolute", top: "100%", right: 0, zIndex: 50,
                        minWidth: 180, padding: "var(--space-1)", boxShadow: "var(--shadow-lg)",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ width: "100%", justifyContent: "flex-start", gap: "var(--space-2)" }}
                        onClick={() => { router.push(`/forms/builder/${form.id}`); setOpenMenu(null); }}
                      >
                        <Eye size={14} /> تعديل الفورم
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ width: "100%", justifyContent: "flex-start", gap: "var(--space-2)" }}
                        onClick={() => { router.push(`/forms/${form.id}/submissions`); setOpenMenu(null); }}
                      >
                        <BarChart2 size={14} /> عرض الردود
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ width: "100%", justifyContent: "flex-start", gap: "var(--space-2)" }}
                        onClick={() => {
                          window.open(`/f/${form.slug}`, "_blank");
                          setOpenMenu(null);
                        }}
                      >
                        <Globe size={14} /> معاينة الفورم
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ width: "100%", justifyContent: "flex-start", gap: "var(--space-2)" }}
                        onClick={() => {
                          navigator.clipboard.writeText(`${publicBase}/f/${form.slug}`);
                          setOpenMenu(null);
                        }}
                      >
                        <ExternalLink size={14} /> نسخ الرابط
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ width: "100%", justifyContent: "flex-start", gap: "var(--space-2)" }}
                        onClick={() => { duplicateMutation.mutate(form.id); setOpenMenu(null); }}
                      >
                        <Copy size={14} /> نسخ الفورم
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ width: "100%", justifyContent: "flex-start", gap: "var(--space-2)" }}
                        onClick={() => {
                          toggleMutation.mutate({ id: form.id, is_active: !form.is_active });
                          setOpenMenu(null);
                        }}
                      >
                        {form.is_active ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                        {form.is_active ? "إيقاف" : "تفعيل"}
                      </button>
                      <div style={{ height: 1, background: "var(--border-subtle)", margin: "var(--space-1) 0" }} />
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ width: "100%", justifyContent: "flex-start", gap: "var(--space-2)", color: "var(--danger)" }}
                        onClick={() => {
                          if (confirm("حذف هذا الفورم؟")) deleteMutation.mutate(form.id);
                          setOpenMenu(null);
                        }}
                      >
                        <Trash2 size={14} /> حذف
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <h3
                style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-1)", fontSize: "1rem" }}
                onClick={() => router.push(`/forms/builder/${form.id}`)}
              >
                {form.title}
              </h3>
              {form.description && (
                <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: "var(--space-3)", lineHeight: 1.5 }}>
                  {form.description.slice(0, 80)}{form.description.length > 80 ? "..." : ""}
                </p>
              )}

              {/* Stats */}
              <div style={{ display: "flex", gap: "var(--space-4)", marginTop: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--border-subtle)" }}>
                <div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>{form.response_count}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>رد</div>
                </div>
                <div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>{form.step_count}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>خطوة</div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
                <button
                  className="btn btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => router.push(`/forms/builder/${form.id}`)}
                >
                  <Eye size={13} /> تعديل
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  style={{ flex: 1 }}
                  onClick={() => router.push(`/forms/${form.id}/submissions`)}
                >
                  <BarChart2 size={13} /> الردود
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">فورم جديد</h2>
              <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">اسم الفورم</label>
                <input
                  className="form-input"
                  placeholder="مثال: استبيان رضا العملاء"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTitle.trim()) {
                      createMutation.mutate(newTitle.trim());
                    }
                  }}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>إلغاء</button>
              <button
                className="btn btn-primary"
                disabled={!newTitle.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate(newTitle.trim())}
              >
                {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء وفتح المحرر"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
