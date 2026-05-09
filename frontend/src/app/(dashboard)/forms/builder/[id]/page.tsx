"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formsApi } from "@/lib/api";
import {
  ArrowLeft, Plus, Trash2, GripVertical, Settings2,
  Eye, Save, Copy, ExternalLink, ChevronDown, ChevronRight,
  Type, AlignLeft, Mail, Phone, Hash, Calendar,
  List, CheckSquare, ChevronDownSquare, Star,
  ToggleLeft, Heading, Upload, X, Check
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────
interface FormField {
  id: string;
  field_type: string;
  label: string;
  description: string;
  placeholder: string;
  required: boolean;
  order: number;
  options: string[];
  settings: Record<string, unknown>;
}

interface FormStep {
  id: string;
  title: string;
  order: number;
  fields: FormField[];
  field_count: number;
}

interface Form {
  id: string;
  title: string;
  description: string;
  slug: string;
  is_active: boolean;
  primary_color: string;
  submit_button_text: string;
  success_message: string;
  redirect_url: string;
  auto_create_customer: boolean;
  crm_mapping: Record<string, string>;
  response_count: number;
  steps: FormStep[];
}

// ─── Field type definitions ─────────────────────────────────────────────────
const FIELD_TYPES = [
  { type: "short_text",      label: "نص قصير",       icon: <Type size={16} /> },
  { type: "long_text",       label: "نص طويل",       icon: <AlignLeft size={16} /> },
  { type: "email",           label: "بريد إلكتروني", icon: <Mail size={16} /> },
  { type: "phone",           label: "رقم الهاتف",    icon: <Phone size={16} /> },
  { type: "number",          label: "رقم",           icon: <Hash size={16} /> },
  { type: "date",            label: "تاريخ",         icon: <Calendar size={16} /> },
  { type: "single_choice",   label: "اختيار واحد",  icon: <List size={16} /> },
  { type: "multiple_choice", label: "اختيار متعدد", icon: <CheckSquare size={16} /> },
  { type: "dropdown",        label: "قائمة منسدلة", icon: <ChevronDownSquare size={16} /> },
  { type: "rating",          label: "تقييم",         icon: <Star size={16} /> },
  { type: "yes_no",          label: "نعم / لا",      icon: <ToggleLeft size={16} /> },
  { type: "statement",       label: "عنوان / نص ثابت", icon: <Heading size={16} /> },
  { type: "file",            label: "رفع ملف",       icon: <Upload size={16} /> },
];

const FIELD_LABEL: Record<string, string> = Object.fromEntries(FIELD_TYPES.map((f) => [f.type, f.label]));
const FIELD_ICON: Record<string, React.ReactNode> = Object.fromEntries(FIELD_TYPES.map((f) => [f.type, f.icon]));

const CRM_FIELDS = [
  { value: "name",    label: "الاسم" },
  { value: "email",   label: "البريد الإلكتروني" },
  { value: "phone",   label: "رقم الهاتف" },
  { value: "company", label: "الشركة" },
  { value: "address", label: "العنوان" },
  { value: "notes",   label: "ملاحظات" },
  { value: "website", label: "الموقع الإلكتروني" },
];

// ─── Main Builder ────────────────────────────────────────────────────────────
export default function FormBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [tab, setTab] = useState<"fields" | "settings">("fields");
  const [saved, setSaved] = useState(false);
  const [formDraft, setFormDraft] = useState<Partial<Form>>({});

  const { data: form, isLoading } = useQuery<Form>({
    queryKey: ["form", id],
    queryFn: () => formsApi.get(id).then((r) => r.data),
  });

  useEffect(() => {
    if (form) {
      setFormDraft({
        title: form.title,
        description: form.description,
        is_active: form.is_active,
        primary_color: form.primary_color,
        submit_button_text: form.submit_button_text,
        success_message: form.success_message,
        redirect_url: form.redirect_url,
        auto_create_customer: form.auto_create_customer,
        crm_mapping: form.crm_mapping,
      });
      if (!activeStep && form.steps.length > 0) {
        setActiveStep(form.steps[0].id);
      }
    }
  }, [form]);

  const updateFormMutation = useMutation({
    mutationFn: (data: Partial<Form>) => formsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form", id] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const createStepMutation = useMutation({
    mutationFn: () => formsApi.createStep(id, { title: "" }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["form", id] });
      setActiveStep(res.data.id);
    },
  });

  const deleteStepMutation = useMutation({
    mutationFn: (stepId: string) => formsApi.deleteStep(stepId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form", id] });
      if (form?.steps.length) setActiveStep(form.steps[0].id);
    },
  });

  const createFieldMutation = useMutation({
    mutationFn: ({ stepId, field_type }: { stepId: string; field_type: string }) =>
      formsApi.createField(stepId, {
        field_type,
        label: FIELD_LABEL[field_type] || "سؤال جديد",
        required: true,
        options: ["single_choice", "multiple_choice", "dropdown"].includes(field_type)
          ? ["خيار 1", "خيار 2"]
          : [],
        settings: field_type === "rating" ? { max_rating: 5 } : {},
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["form", id] });
      setActiveField(res.data.id);
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: ({ fieldId, data }: { fieldId: string; data: Partial<FormField> }) =>
      formsApi.updateField(fieldId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["form", id] }),
  });

  const deleteFieldMutation = useMutation({
    mutationFn: (fieldId: string) => formsApi.deleteField(fieldId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form", id] });
      setActiveField(null);
    },
  });

  const currentStep = form?.steps.find((s) => s.id === activeStep) || form?.steps[0];
  const currentField = currentStep?.fields.find((f) => f.id === activeField);

  const handleSaveForm = () => updateFormMutation.mutate(formDraft);

  if (isLoading || !form) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ color: "var(--text-muted)" }}>جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      height: "calc(100vh - var(--topbar-height))",
      overflow: "hidden",
      flexDirection: "column",
      margin: "calc(var(--space-6) * -1)",
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: "var(--space-3)",
        padding: "0 var(--space-4)", height: 56,
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-card)", flexShrink: 0,
      }}>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push("/forms")}>
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            value={formDraft.title || ""}
            onChange={(e) => setFormDraft((p) => ({ ...p, title: e.target.value }))}
            onBlur={handleSaveForm}
            style={{
              background: "transparent", border: "none", outline: "none",
              fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)",
              width: "100%",
            }}
            placeholder="اسم الفورم"
          />
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          {saved && (
            <span style={{ color: "var(--success)", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 4 }}>
              <Check size={14} /> تم الحفظ
            </span>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => window.open(`/f/${form.slug}`, "_blank")}
          >
            <Eye size={15} /> معاينة
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const base = typeof window !== "undefined" ? window.location.origin : "";
              navigator.clipboard.writeText(`${base}/f/${form.slug}`);
            }}
          >
            <ExternalLink size={15} /> نسخ الرابط
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSaveForm} disabled={updateFormMutation.isPending}>
            <Save size={14} /> حفظ
          </button>
        </div>
      </div>

      {/* 3-panel layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── Panel 1: Steps ──────────────────────────────────── */}
        <div style={{
          width: 220, flexShrink: 0,
          borderRight: "1px solid var(--border-subtle)",
          background: "var(--bg-card)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          <div style={{ padding: "var(--space-3)", borderBottom: "1px solid var(--border-subtle)", fontWeight: 600, fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            الخطوات
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-2)" }}>
            {form.steps.map((step, idx) => (
              <div
                key={step.id}
                onClick={() => { setActiveStep(step.id); setActiveField(null); }}
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  background: activeStep === step.id ? "rgba(249,115,22,0.1)" : "transparent",
                  borderLeft: activeStep === step.id ? `3px solid ${form.primary_color}` : "3px solid transparent",
                  marginBottom: "var(--space-1)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  transition: "background 0.15s",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    خطوة {idx + 1}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    {step.field_count} حقل
                  </div>
                </div>
                {form.steps.length > 1 && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: 2, opacity: 0.5 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("حذف هذه الخطوة؟")) deleteStepMutation.mutate(step.id);
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: "var(--space-2)" }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => createStepMutation.mutate()}
            >
              <Plus size={14} /> خطوة جديدة
            </button>
          </div>
        </div>

        {/* ── Panel 2: Canvas ──────────────────────────────────── */}
        <div style={{
          flex: 1, overflowY: "auto",
          background: "var(--bg-elevated)",
          display: "flex", flexDirection: "column",
        }}>
          {currentStep ? (
            <div style={{ maxWidth: 680, margin: "0 auto", padding: "var(--space-6) var(--space-4)", width: "100%" }}>
              {/* Step title */}
              <input
                defaultValue={currentStep.title}
                onBlur={(e) =>
                  formsApi.updateStep(currentStep.id, { title: e.target.value })
                    .then(() => queryClient.invalidateQueries({ queryKey: ["form", id] }))
                }
                placeholder="عنوان الخطوة (اختياري)"
                style={{
                  background: "transparent", border: "none", outline: "none",
                  fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)",
                  width: "100%", marginBottom: "var(--space-4)",
                  borderBottom: "2px solid var(--border-subtle)",
                  padding: "var(--space-2) 0",
                }}
              />

              {/* Fields */}
              {currentStep.fields.length === 0 ? (
                <div style={{
                  textAlign: "center", padding: "var(--space-10)",
                  border: "2px dashed var(--border-subtle)",
                  borderRadius: "var(--radius-lg)", color: "var(--text-muted)",
                }}>
                  <Plus size={32} style={{ margin: "0 auto var(--space-3)", display: "block" }} />
                  <p>اختر نوع حقل من اليمين لإضافته</p>
                </div>
              ) : (
                currentStep.fields.map((field) => (
                  <FieldCard
                    key={field.id}
                    field={field}
                    isActive={activeField === field.id}
                    primaryColor={form.primary_color}
                    onClick={() => setActiveField(field.id)}
                    onDelete={() => deleteFieldMutation.mutate(field.id)}
                    onUpdate={(data) => updateFieldMutation.mutate({ fieldId: field.id, data })}
                  />
                ))
              )}

              {/* Submit preview */}
              <div style={{ marginTop: "var(--space-6)", textAlign: "center" }}>
                <button
                  style={{
                    background: form.primary_color,
                    color: "#fff",
                    border: "none",
                    padding: "12px 32px",
                    borderRadius: "var(--radius-md)",
                    fontWeight: 600,
                    fontSize: "1rem",
                    cursor: "default",
                    opacity: 0.8,
                  }}
                >
                  {form.submit_button_text}
                </button>
                <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
                  معاينة زر الإرسال
                </p>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "var(--space-10)", color: "var(--text-muted)" }}>
              اختر خطوة من القائمة
            </div>
          )}
        </div>

        {/* ── Panel 3: Right sidebar ─────────────────────────── */}
        <div style={{
          width: 280, flexShrink: 0,
          borderLeft: "1px solid var(--border-subtle)",
          background: "var(--bg-card)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)" }}>
            {(["fields", "settings"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: "var(--space-3)", border: "none", background: "transparent",
                  fontWeight: 600, fontSize: "0.8rem", cursor: "pointer",
                  color: tab === t ? "var(--brand-primary)" : "var(--text-muted)",
                  borderBottom: tab === t ? `2px solid var(--brand-primary)` : "2px solid transparent",
                  transition: "all 0.15s",
                }}
              >
                {t === "fields" ? "إضافة حقل" : "إعدادات الفورم"}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {tab === "fields" ? (
              <FieldPicker
                onAdd={(type) => {
                  if (currentStep) {
                    createFieldMutation.mutate({ stepId: currentStep.id, field_type: type });
                  }
                }}
              />
            ) : (
              <FormSettings
                draft={formDraft}
                form={form}
                onChange={(patch) => setFormDraft((p) => ({ ...p, ...patch }))}
                onSave={handleSaveForm}
                isSaving={updateFormMutation.isPending}
              />
            )}
          </div>

          {/* Field editor (shown when a field is selected and we're in fields tab) */}
          {activeField && currentField && tab === "fields" && (
            <FieldEditor
              field={currentField}
              onUpdate={(data) => updateFieldMutation.mutate({ fieldId: currentField.id, data })}
              onDelete={() => deleteFieldMutation.mutate(currentField.id)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Field Card ─────────────────────────────────────────────────────────────
function FieldCard({
  field, isActive, primaryColor, onClick, onDelete, onUpdate,
}: {
  field: FormField;
  isActive: boolean;
  primaryColor: string;
  onClick: () => void;
  onDelete: () => void;
  onUpdate: (data: Partial<FormField>) => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg-card)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
        marginBottom: "var(--space-3)",
        cursor: "pointer",
        border: isActive ? `2px solid ${primaryColor}` : "2px solid var(--border-subtle)",
        transition: "border-color 0.15s",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
        <div style={{ color: "var(--text-muted)", paddingTop: 2 }}>
          {FIELD_ICON[field.field_type]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.9rem", marginBottom: "var(--space-1)" }}>
            {field.label}
            {field.required && <span style={{ color: "var(--danger)", marginRight: 4 }}>*</span>}
          </div>
          {field.description && (
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{field.description}</div>
          )}
          <div style={{ marginTop: "var(--space-2)" }}>
            <FieldPreview field={field} />
          </div>
        </div>
        {isActive && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--danger)", padding: 4 }}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function FieldPreview({ field }: { field: FormField }) {
  if (field.field_type === "statement") {
    return <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontStyle: "italic" }}>{field.placeholder || "نص ثابت..."}</p>;
  }
  if (["single_choice", "multiple_choice"].includes(field.field_type)) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {(field.options || []).slice(0, 3).map((opt, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "var(--text-muted)" }}>
            <div style={{ width: 12, height: 12, borderRadius: field.field_type === "single_choice" ? "50%" : 2, border: "1px solid var(--border-subtle)" }} />
            {opt}
          </div>
        ))}
        {field.options.length > 3 && <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>+{field.options.length - 3} خيارات أخرى</div>}
      </div>
    );
  }
  if (field.field_type === "rating") {
    const max = (field.settings?.max_rating as number) || 5;
    return (
      <div style={{ display: "flex", gap: 4 }}>
        {Array.from({ length: max }).map((_, i) => (
          <Star key={i} size={14} style={{ color: "var(--text-muted)" }} />
        ))}
      </div>
    );
  }
  if (field.field_type === "yes_no") {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <span style={{ fontSize: "0.75rem", padding: "2px 10px", border: "1px solid var(--border-subtle)", borderRadius: 4 }}>نعم</span>
        <span style={{ fontSize: "0.75rem", padding: "2px 10px", border: "1px solid var(--border-subtle)", borderRadius: 4 }}>لا</span>
      </div>
    );
  }
  return (
    <div style={{
      height: 32, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)",
      background: "var(--bg-elevated)", display: "flex", alignItems: "center",
      padding: "0 var(--space-3)", fontSize: "0.75rem", color: "var(--text-muted)",
    }}>
      {field.placeholder || "..."}
    </div>
  );
}

// ─── Field Picker ────────────────────────────────────────────────────────────
function FieldPicker({ onAdd }: { onAdd: (type: string) => void }) {
  return (
    <div style={{ padding: "var(--space-3)" }}>
      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
        اضغط على نوع الحقل لإضافته للخطوة الحالية
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        {FIELD_TYPES.map((ft) => (
          <button
            key={ft.type}
            className="btn btn-ghost btn-sm"
            style={{ justifyContent: "flex-start", gap: "var(--space-2)", width: "100%" }}
            onClick={() => onAdd(ft.type)}
          >
            <span style={{ color: "var(--text-muted)" }}>{ft.icon}</span>
            {ft.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Field Editor ─────────────────────────────────────────────────────────────
function FieldEditor({
  field, onUpdate, onDelete,
}: {
  field: FormField;
  onUpdate: (data: Partial<FormField>) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Partial<FormField>>(field);
  const [optionInput, setOptionInput] = useState("");

  useEffect(() => { setDraft(field); }, [field.id]);

  const save = (patch: Partial<FormField>) => {
    const updated = { ...draft, ...patch };
    setDraft(updated);
    onUpdate(patch);
  };

  const hasOptions = ["single_choice", "multiple_choice", "dropdown"].includes(field.field_type);

  return (
    <div style={{
      borderTop: "1px solid var(--border-subtle)",
      padding: "var(--space-3)",
      background: "var(--bg-elevated)",
    }}>
      <div style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "var(--space-3)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <Settings2 size={14} />
        تعديل الحقل: {FIELD_LABEL[field.field_type]}
      </div>

      <div className="form-group" style={{ marginBottom: "var(--space-2)" }}>
        <label className="form-label" style={{ fontSize: "0.75rem" }}>السؤال / التسمية</label>
        <input
          className="form-input"
          style={{ fontSize: "0.8rem" }}
          value={draft.label || ""}
          onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))}
          onBlur={() => save({ label: draft.label })}
        />
      </div>

      <div className="form-group" style={{ marginBottom: "var(--space-2)" }}>
        <label className="form-label" style={{ fontSize: "0.75rem" }}>وصف / تلميح</label>
        <input
          className="form-input"
          style={{ fontSize: "0.8rem" }}
          value={draft.description || ""}
          onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
          onBlur={() => save({ description: draft.description })}
          placeholder="اختياري"
        />
      </div>

      {!["statement", "yes_no", "rating", "single_choice", "multiple_choice", "dropdown"].includes(field.field_type) && (
        <div className="form-group" style={{ marginBottom: "var(--space-2)" }}>
          <label className="form-label" style={{ fontSize: "0.75rem" }}>Placeholder</label>
          <input
            className="form-input"
            style={{ fontSize: "0.8rem" }}
            value={draft.placeholder || ""}
            onChange={(e) => setDraft((p) => ({ ...p, placeholder: e.target.value }))}
            onBlur={() => save({ placeholder: draft.placeholder })}
          />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
        <input
          type="checkbox"
          id="req"
          checked={draft.required ?? true}
          onChange={(e) => save({ required: e.target.checked })}
        />
        <label htmlFor="req" style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>إجباري</label>
      </div>

      {field.field_type === "rating" && (
        <div className="form-group" style={{ marginBottom: "var(--space-2)" }}>
          <label className="form-label" style={{ fontSize: "0.75rem" }}>أقصى تقييم</label>
          <select
            className="form-input"
            style={{ fontSize: "0.8rem" }}
            value={(draft.settings?.max_rating as number) || 5}
            onChange={(e) => save({ settings: { ...draft.settings, max_rating: Number(e.target.value) } })}
          >
            {[3, 5, 7, 10].map((n) => (
              <option key={n} value={n}>{n} نجوم</option>
            ))}
          </select>
        </div>
      )}

      {hasOptions && (
        <div className="form-group" style={{ marginBottom: "var(--space-2)" }}>
          <label className="form-label" style={{ fontSize: "0.75rem" }}>الخيارات</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
            {(draft.options || []).map((opt, i) => (
              <div key={i} style={{ display: "flex", gap: 4 }}>
                <input
                  className="form-input"
                  style={{ fontSize: "0.75rem", flex: 1 }}
                  value={opt}
                  onChange={(e) => {
                    const opts = [...(draft.options || [])];
                    opts[i] = e.target.value;
                    setDraft((p) => ({ ...p, options: opts }));
                  }}
                  onBlur={() => save({ options: draft.options })}
                />
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: 4, color: "var(--danger)" }}
                  onClick={() => {
                    const opts = (draft.options || []).filter((_, j) => j !== i);
                    save({ options: opts });
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              className="form-input"
              style={{ fontSize: "0.75rem", flex: 1 }}
              placeholder="خيار جديد..."
              value={optionInput}
              onChange={(e) => setOptionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && optionInput.trim()) {
                  const opts = [...(draft.options || []), optionInput.trim()];
                  save({ options: opts });
                  setOptionInput("");
                }
              }}
            />
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                if (optionInput.trim()) {
                  const opts = [...(draft.options || []), optionInput.trim()];
                  save({ options: opts });
                  setOptionInput("");
                }
              }}
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Form Settings ────────────────────────────────────────────────────────────
function FormSettings({
  draft, form, onChange, onSave, isSaving,
}: {
  draft: Partial<Form>;
  form: Form;
  onChange: (patch: Partial<Form>) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const allFields = form.steps.flatMap((s) => s.fields);

  return (
    <div style={{ padding: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {/* General */}
      <Section title="عام">
        <div className="form-group">
          <label className="form-label" style={{ fontSize: "0.75rem" }}>وصف الفورم</label>
          <textarea
            className="form-input"
            rows={2}
            style={{ fontSize: "0.8rem" }}
            value={draft.description || ""}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontSize: "0.75rem" }}>لون الفورم</label>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
            <input
              type="color"
              value={draft.primary_color || "#f97316"}
              onChange={(e) => onChange({ primary_color: e.target.value })}
              style={{ width: 36, height: 36, border: "none", cursor: "pointer", borderRadius: "var(--radius-sm)" }}
            />
            <input
              className="form-input"
              style={{ fontSize: "0.8rem" }}
              value={draft.primary_color || ""}
              onChange={(e) => onChange({ primary_color: e.target.value })}
            />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <input
            type="checkbox"
            id="active"
            checked={draft.is_active ?? true}
            onChange={(e) => onChange({ is_active: e.target.checked })}
          />
          <label htmlFor="active" style={{ fontSize: "0.8rem" }}>الفورم نشط (يقبل ردود)</label>
        </div>
      </Section>

      {/* Submit */}
      <Section title="الإرسال">
        <div className="form-group">
          <label className="form-label" style={{ fontSize: "0.75rem" }}>نص زر الإرسال</label>
          <input
            className="form-input"
            style={{ fontSize: "0.8rem" }}
            value={draft.submit_button_text || ""}
            onChange={(e) => onChange({ submit_button_text: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontSize: "0.75rem" }}>رسالة النجاح</label>
          <textarea
            className="form-input"
            rows={2}
            style={{ fontSize: "0.8rem" }}
            value={draft.success_message || ""}
            onChange={(e) => onChange({ success_message: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontSize: "0.75rem" }}>رابط إعادة التوجيه (اختياري)</label>
          <input
            className="form-input"
            style={{ fontSize: "0.8rem" }}
            value={draft.redirect_url || ""}
            onChange={(e) => onChange({ redirect_url: e.target.value })}
            placeholder="https://..."
          />
        </div>
      </Section>

      {/* CRM */}
      <Section title="ربط CRM">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
          <input
            type="checkbox"
            id="crm"
            checked={draft.auto_create_customer ?? false}
            onChange={(e) => onChange({ auto_create_customer: e.target.checked })}
          />
          <label htmlFor="crm" style={{ fontSize: "0.8rem" }}>إنشاء عميل تلقائياً عند الإرسال</label>
        </div>
        {draft.auto_create_customer && (
          <div>
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>
              اربط حقول الفورم بحقول العميل في CRM
            </p>
            {CRM_FIELDS.map((cf) => (
              <div key={cf.value} style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", width: 80, flexShrink: 0 }}>{cf.label}</span>
                <select
                  className="form-input"
                  style={{ fontSize: "0.75rem", flex: 1 }}
                  value={(draft.crm_mapping || {})[cf.value] || ""}
                  onChange={(e) => {
                    const mapping = { ...(draft.crm_mapping || {}) };
                    if (e.target.value) mapping[cf.value] = e.target.value;
                    else delete mapping[cf.value];
                    onChange({ crm_mapping: mapping });
                  }}
                >
                  <option value="">-- لا يوجد --</option>
                  {allFields.filter((f) => f.field_type !== "statement").map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Share */}
      <Section title="مشاركة">
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <input
            className="form-input"
            readOnly
            style={{ fontSize: "0.72rem", flex: 1 }}
            value={typeof window !== "undefined" ? `${window.location.origin}/f/${form.slug}` : `/f/${form.slug}`}
          />
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              const base = typeof window !== "undefined" ? window.location.origin : "";
              navigator.clipboard.writeText(`${base}/f/${form.slug}`);
            }}
          >
            <Copy size={13} />
          </button>
        </div>
      </Section>

      <button className="btn btn-primary" onClick={onSave} disabled={isSaving}>
        {isSaving ? "جاري الحفظ..." : "حفظ الإعدادات"}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          width: "100%", padding: "var(--space-2) var(--space-3)",
          background: "var(--bg-elevated)", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontWeight: 600, fontSize: "0.8rem", color: "var(--text-primary)",
        }}
      >
        {title}
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div style={{ padding: "var(--space-3)" }}>
          {children}
        </div>
      )}
    </div>
  );
}
