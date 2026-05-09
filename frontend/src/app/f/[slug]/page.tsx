"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { formsApi } from "@/lib/api";
import {
  ChevronRight, ChevronLeft, Star, Check, Loader2,
  Upload, X, FileIcon, ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
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
}

interface PublicForm {
  id: string;
  title: string;
  description: string;
  slug: string;
  is_active: boolean;
  primary_color: string;
  submit_button_text: string;
  success_message: string;
  redirect_url: string;
  steps: FormStep[];
}

// ─── Public Form Page ─────────────────────────────────────────────────────────
export default function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<PublicForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    formsApi.publicForm(slug)
      .then((r) => setForm(r.data))
      .catch(() => setError("هذا الفورم غير متاح أو لم يعد نشطاً."))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div style={centerStyle}>
        <Loader2 size={36} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div style={centerStyle}>
        <div style={{ textAlign: "center", color: "#6b7280" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>😕</div>
          <h2 style={{ marginBottom: 8, color: "#111" }}>{error || "الفورم غير موجود"}</h2>
          <p style={{ fontSize: "0.875rem" }}>تواصل مع مُنشئ الفورم إذا تعتقد أن هذا خطأ.</p>
        </div>
      </div>
    );
  }

  const steps = form.steps.filter((s) => s.fields.length > 0);
  const currentStep = steps[currentStepIdx];
  const isLast = currentStepIdx === steps.length - 1;
  const progress = steps.length > 1 ? ((currentStepIdx) / steps.length) * 100 : 0;

  const setAnswer = (fieldId: string, value: unknown) => {
    setAnswers((p) => ({ ...p, [fieldId]: value }));
    setValidationError(null);
  };

  const validateStep = (): boolean => {
    if (!currentStep) return true;
    for (const field of currentStep.fields) {
      if (!field.required) continue;
      if (field.field_type === "statement") continue;
      const val = answers[field.id];
      if (val === undefined || val === null || val === "") {
        setValidationError(`"${field.label}" مطلوب`);
        return false;
      }
      if (Array.isArray(val) && val.length === 0) {
        setValidationError(`"${field.label}" مطلوب`);
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setCurrentStepIdx((i) => Math.min(i + 1, steps.length - 1));
    setValidationError(null);
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    try {
      const responses = Object.entries(answers).map(([field_id, value]) => ({ field_id, value }));
      await formsApi.publicSubmit(slug, { responses });
      setSubmitted(true);
      if (form.redirect_url) {
        setTimeout(() => { window.location.href = form.redirect_url; }, 2500);
      }
    } catch {
      setValidationError("حدث خطأ أثناء الإرسال. حاول مجدداً.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ──
  if (submitted) {
    return (
      <div style={{ ...centerStyle, background: `linear-gradient(135deg, ${form.primary_color}15, #fff)` }}>
        <div style={{ textAlign: "center", maxWidth: 480, padding: 32 }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: form.primary_color,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px", animation: "pop 0.4s ease",
          }}>
            <Check size={36} color="#fff" />
          </div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 12, color: "#111" }}>
            تم الإرسال!
          </h2>
          <p style={{ color: "#6b7280", lineHeight: 1.7 }}>{form.success_message}</p>
          {form.redirect_url && (
            <p style={{ marginTop: 16, fontSize: "0.8rem", color: "#9ca3af" }}>
              سيتم تحويلك تلقائياً...
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Empty form ──
  if (!currentStep) {
    return (
      <div style={centerStyle}>
        <div style={{ textAlign: "center", color: "#6b7280" }}>
          <h2>هذا الفورم لا يحتوي على أسئلة بعد.</h2>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(135deg, ${form.primary_color}10 0%, #f9fafb 100%)`,
      display: "flex", flexDirection: "column",
    }}>
      {/* Progress bar */}
      {steps.length > 1 && (
        <div style={{ height: 4, background: "#e5e7eb", flexShrink: 0 }}>
          <div style={{
            height: "100%",
            width: `${((currentStepIdx + 1) / steps.length) * 100}%`,
            background: form.primary_color,
            transition: "width 0.3s ease",
          }} />
        </div>
      )}

      {/* Branding */}
      <div style={{ padding: "24px 32px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: "1.25rem", color: "#111", margin: 0 }}>{form.title}</h1>
          {form.description && (
            <p style={{ color: "#6b7280", fontSize: "0.875rem", marginTop: 4 }}>{form.description}</p>
          )}
        </div>
        {steps.length > 1 && (
          <span style={{ fontSize: "0.8rem", color: "#9ca3af", fontWeight: 600 }}>
            {currentStepIdx + 1} / {steps.length}
          </span>
        )}
      </div>

      {/* Main card */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "32px 16px",
      }}>
        <div style={{
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 4px 32px rgba(0,0,0,0.08)",
          width: "100%", maxWidth: 580,
          padding: "40px 48px",
        }}>
          {/* Step title */}
          {currentStep.title && (
            <h2 style={{ fontWeight: 700, fontSize: "1.1rem", color: "#111", marginBottom: 24 }}>
              {currentStep.title}
            </h2>
          )}

          {/* Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {currentStep.fields.map((field) => (
              <FieldInput
                key={field.id}
                field={field}
                value={answers[field.id]}
                onChange={(v) => setAnswer(field.id, v)}
                primaryColor={form.primary_color}
              />
            ))}
          </div>

          {/* Validation error */}
          {validationError && (
            <div style={{
              marginTop: 16, padding: "8px 12px",
              background: "#fee2e2", borderRadius: 8,
              color: "#dc2626", fontSize: "0.8rem", fontWeight: 500,
            }}>
              ⚠ {validationError}
            </div>
          )}

          {/* Navigation */}
          <div style={{ marginTop: 32, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              style={{
                background: "transparent",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "10px 20px",
                cursor: currentStepIdx === 0 ? "not-allowed" : "pointer",
                opacity: currentStepIdx === 0 ? 0.4 : 1,
                display: "flex", alignItems: "center", gap: 6,
                fontSize: "0.875rem", fontWeight: 500, color: "#374151",
              }}
              onClick={() => { if (currentStepIdx > 0) setCurrentStepIdx((i) => i - 1); }}
              disabled={currentStepIdx === 0}
            >
              <ChevronRight size={16} /> السابق
            </button>

            {isLast ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  background: form.primary_color,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "12px 32px",
                  fontWeight: 700,
                  fontSize: "1rem",
                  cursor: submitting ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  opacity: submitting ? 0.7 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {submitting ? (
                  <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> جاري الإرسال...</>
                ) : (
                  <>{form.submit_button_text} <Check size={16} /></>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                style={{
                  background: form.primary_color,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "12px 32px",
                  fontWeight: 700,
                  fontSize: "1rem",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  transition: "opacity 0.15s",
                }}
              >
                التالي <ChevronLeft size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "16px 32px", textAlign: "center", fontSize: "0.72rem", color: "#9ca3af" }}>
        powered by ProSticker Forms
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pop { 0% { transform: scale(0); opacity: 0; } 70% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}

const centerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f9fafb",
};

// ─── Field Input Component ───────────────────────────────────────────────────
function FieldInput({
  field, value, onChange, primaryColor,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  primaryColor: string;
}) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    fontSize: "1rem",
    outline: "none",
    transition: "border-color 0.15s",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const labelEl = (
    <label style={{ fontWeight: 600, fontSize: "0.95rem", color: "#111", display: "block", marginBottom: 8 }}>
      {field.label}
      {field.required && <span style={{ color: "#ef4444", marginRight: 4 }}>*</span>}
    </label>
  );

  const descEl = field.description ? (
    <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: 10, marginTop: -4 }}>{field.description}</p>
  ) : null;

  if (field.field_type === "statement") {
    return (
      <div style={{ borderLeft: `4px solid ${primaryColor}`, paddingRight: 16 }}>
        <h3 style={{ fontWeight: 700, fontSize: "1.05rem", color: "#111", margin: "0 0 4px" }}>{field.label}</h3>
        {field.description && <p style={{ color: "#6b7280", fontSize: "0.875rem", margin: 0 }}>{field.description}</p>}
      </div>
    );
  }

  if (field.field_type === "long_text") {
    return (
      <div>
        {labelEl}{descEl}
        <textarea
          rows={4}
          style={{ ...inputStyle, resize: "vertical" }}
          placeholder={field.placeholder}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => { e.currentTarget.style.borderColor = primaryColor; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
        />
      </div>
    );
  }

  if (field.field_type === "single_choice") {
    return (
      <div>
        {labelEl}{descEl}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {field.options.map((opt) => (
            <label key={opt} style={{
              display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
              padding: "12px 16px", borderRadius: 8,
              border: `2px solid ${value === opt ? primaryColor : "#e5e7eb"}`,
              background: value === opt ? `${primaryColor}10` : "#fff",
              transition: "all 0.15s",
              fontWeight: value === opt ? 600 : 400,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%",
                border: `2px solid ${value === opt ? primaryColor : "#d1d5db"}`,
                background: value === opt ? primaryColor : "transparent",
                flexShrink: 0, transition: "all 0.15s",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {value === opt && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
              </div>
              {opt}
              <input
                type="radio"
                style={{ display: "none" }}
                checked={value === opt}
                onChange={() => onChange(opt)}
              />
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.field_type === "multiple_choice") {
    const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
    const toggle = (opt: string) => {
      if (selected.includes(opt)) onChange(selected.filter((v) => v !== opt));
      else onChange([...selected, opt]);
    };
    return (
      <div>
        {labelEl}{descEl}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {field.options.map((opt) => {
            const checked = selected.includes(opt);
            return (
              <label key={opt} style={{
                display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                padding: "12px 16px", borderRadius: 8,
                border: `2px solid ${checked ? primaryColor : "#e5e7eb"}`,
                background: checked ? `${primaryColor}10` : "#fff",
                transition: "all 0.15s",
                fontWeight: checked ? 600 : 400,
              }} onClick={() => toggle(opt)}>
                <div style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: `2px solid ${checked ? primaryColor : "#d1d5db"}`,
                  background: checked ? primaryColor : "transparent",
                  flexShrink: 0, transition: "all 0.15s",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {checked && <Check size={12} color="#fff" strokeWidth={3} />}
                </div>
                {opt}
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.field_type === "dropdown") {
    return (
      <div>
        {labelEl}{descEl}
        <select
          style={{ ...inputStyle, cursor: "pointer", background: "#fff" }}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => { e.currentTarget.style.borderColor = primaryColor; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
        >
          <option value="">-- اختر --</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.field_type === "rating") {
    const max = (field.settings?.max_rating as number) || 5;
    const rating = (value as number) || 0;
    return (
      <div>
        {labelEl}{descEl}
        <div style={{ display: "flex", gap: 8 }}>
          {Array.from({ length: max }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i + 1)}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                transition: "transform 0.1s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              <Star
                size={32}
                fill={i < rating ? primaryColor : "none"}
                color={i < rating ? primaryColor : "#d1d5db"}
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (field.field_type === "yes_no") {
    return (
      <div>
        {labelEl}{descEl}
        <div style={{ display: "flex", gap: 12 }}>
          {[{ label: "نعم", val: true }, { label: "لا", val: false }].map(({ label: lbl, val }) => (
            <button
              key={lbl}
              type="button"
              onClick={() => onChange(val)}
              style={{
                padding: "12px 32px",
                borderRadius: 8,
                border: `2px solid ${value === val ? primaryColor : "#e5e7eb"}`,
                background: value === val ? primaryColor : "#fff",
                color: value === val ? "#fff" : "#374151",
                fontWeight: 600, fontSize: "0.95rem",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // File upload — uploads immediately on select, stores [{url, name, size, type}]
  if (field.field_type === "file") {
    return (
      <FileUploadField
        field={field}
        value={value}
        onChange={onChange}
        primaryColor={primaryColor}
        labelEl={labelEl}
        descEl={descEl}
      />
    );
  }

  // Default: text, email, phone, number, date
  const inputType = {
    email: "email",
    phone: "tel",
    number: "number",
    date: "date",
  }[field.field_type] || "text";

  return (
    <div>
      {labelEl}{descEl}
      <input
        type={inputType}
        style={inputStyle}
        placeholder={field.placeholder}
        value={(value as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => { e.currentTarget.style.borderColor = primaryColor; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
      />
    </div>
  );
}

// ─── FileUploadField ──────────────────────────────────────────────────────────
interface UploadedFile {
  url: string;
  name: string;
  size: number;
  type: string;
}

function FileUploadField({
  field, value, onChange, primaryColor, labelEl, descEl,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  primaryColor: string;
  labelEl: React.ReactNode;
  descEl: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const uploaded: UploadedFile[] = Array.isArray(value) ? (value as UploadedFile[]) : [];

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    const results: UploadedFile[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        setUploadError(`"${file.name}" أكبر من 10 MB`);
        continue;
      }
      try {
        const res = await formsApi.publicUploadFile(file);
        results.push({
          url: res.data.url,
          name: res.data.name,
          size: res.data.size,
          type: res.data.type,
        });
      } catch {
        setUploadError(`فشل رفع "${file.name}". حاول مجدداً.`);
      }
    }
    setUploading(false);
    if (results.length > 0) {
      onChange([...uploaded, ...results]);
    }
  };

  const removeFile = (idx: number) => {
    onChange(uploaded.filter((_, i) => i !== idx));
  };

  return (
    <div>
      {labelEl}{descEl}

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        style={{
          border: `2px dashed ${dragOver ? primaryColor : "#d1d5db"}`,
          borderRadius: 10,
          padding: "24px 20px",
          textAlign: "center",
          cursor: uploading ? "not-allowed" : "pointer",
          background: dragOver ? `${primaryColor}08` : "#fafafa",
          transition: "all 0.15s",
          userSelect: "none",
        }}
      >
        {uploading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "#6b7280" }}>
            <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: primaryColor }} />
            <span style={{ fontSize: "0.85rem" }}>جاري الرفع...</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <Upload size={28} color={primaryColor} />
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>
              اسحب الملف هنا أو <span style={{ color: primaryColor, textDecoration: "underline" }}>اختر من جهازك</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>الحد الأقصى: 10 MB</div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
        />
      </div>

      {/* Upload error */}
      {uploadError && (
        <div style={{
          marginTop: 8, padding: "6px 10px",
          background: "#fee2e2", borderRadius: 6,
          color: "#dc2626", fontSize: "0.78rem", fontWeight: 500,
        }}>
          ⚠ {uploadError}
        </div>
      )}

      {/* Uploaded files list */}
      {uploaded.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {uploaded.map((f, idx) => (
            <div key={idx} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px",
              border: "1px solid #e5e7eb", borderRadius: 8,
              background: "#fff",
            }}>
              <FileIcon size={18} color={primaryColor} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.name}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>{formatSize(f.size)}</div>
              </div>
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ color: "#9ca3af", flexShrink: 0, display: "flex" }}
                title="فتح"
              >
                <ExternalLink size={14} />
              </a>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", flexShrink: 0, padding: 0, display: "flex" }}
                title="حذف"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
