"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Link2,
  Settings2,
  ToggleLeft,
  ToggleRight,
  ArrowLeft,
  TableProperties,
  ScrollText,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { integrationsApi } from "@/lib/api";
import toast from "react-hot-toast";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Integration {
  id: string;
  name: string;
  spreadsheet_id: string;
  sheet_name: string;
  header_row: number;
  column_mapping: Record<string, string>;   // { crm_field: sheet_col_name }
  sync_interval_minutes: number;
  conflict_strategy: "skip" | "update";
  is_active: boolean;
  default_customer_type: string;
  default_customer_stage: string;
  default_assigned_to: string | null;
  last_synced_row: number;
  last_sync_at: string | null;
  last_sync_status: "pending" | "success" | "error";
  last_sync_message: string;
  created_at: string;
}

interface SyncLog {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  rows_read: number;
  rows_created: number;
  rows_updated: number;
  rows_skipped: number;
  rows_failed: number;
  error_message: string;
  triggered_by: string;
}

// CRM fields that can be populated from the sheet
const CRM_FIELD_OPTIONS = [
  { value: "name",    label: "الاسم (name) *" },
  { value: "email",   label: "البريد الإلكتروني (email)" },
  { value: "phone",   label: "الهاتف (phone)" },
  { value: "company", label: "الشركة (company)" },
  { value: "type",    label: "النوع: lead/prospect/customer" },
  { value: "stage",   label: "المرحلة: new/contacted/proposal/won/lost" },
  { value: "address", label: "العنوان (address)" },
  { value: "notes",   label: "ملاحظات (notes)" },
  { value: "website", label: "الموقع (website)" },
];

const INTERVAL_OPTIONS = [
  { value: 1,    label: "كل دقيقة (للاختبار)" },
  { value: 5,    label: "كل 5 دقائق" },
  { value: 15,   label: "كل 15 دقيقة" },
  { value: 30,   label: "كل 30 دقيقة" },
  { value: 60,   label: "كل ساعة" },
  { value: 120,  label: "كل ساعتين" },
  { value: 360,  label: "كل 6 ساعات" },
  { value: 1440, label: "يومياً" },
];

function extractId(input: string) {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : input.trim();
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "success") return <span className="badge badge-success"><CheckCircle size={10} /> نجاح</span>;
  if (status === "error")   return <span className="badge badge-danger"><XCircle size={10} /> خطأ</span>;
  return <span className="badge badge-gray"><Clock size={10} /> انتظار</span>;
}

// ─── Sync Logs Panel ──────────────────────────────────────────────────────────
function SyncLogsPanel({ integrationId }: { integrationId: string }) {
  const { data } = useQuery({
    queryKey: ["sync-logs", integrationId],
    queryFn: () => integrationsApi.logs(integrationId).then((r) => r.data?.results ?? r.data ?? []),
    refetchInterval: 30000,
  });
  const logs: SyncLog[] = Array.isArray(data) ? data.slice(0, 10) : [];

  if (logs.length === 0) return (
    <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>لا يوجد سجل بعد</p>
  );

  return (
    <div className="table-wrapper" style={{ marginTop: "var(--space-2)" }}>
      <table className="table" style={{ fontSize: "0.78rem" }}>
        <thead>
          <tr>
            <th>التوقيت</th>
            <th>الحالة</th>
            <th>قُرئ</th>
            <th>جديد</th>
            <th>محدّث</th>
            <th>تجاوز</th>
            <th>سبب</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.started_at).toLocaleString("ar-EG")}</td>
              <td><StatusBadge status={log.status} /></td>
              <td>{log.rows_read}</td>
              <td style={{ color: "var(--color-success)" }}>{log.rows_created}</td>
              <td style={{ color: "var(--color-info)" }}>{log.rows_updated}</td>
              <td style={{ color: "var(--text-muted)" }}>{log.rows_skipped}</td>
              <td style={{ color: "var(--text-secondary)" }}>{log.triggered_by === "manual" ? "يدوي" : "تلقائي"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Integration Form Modal ───────────────────────────────────────────────────
function IntegrationFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Integration | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const qc = useQueryClient();

  // Form state
  const [name, setName]             = useState(initial?.name ?? "");
  const [sheetInput, setSheetInput] = useState(initial?.spreadsheet_id ?? "");
  const [sheetName, setSheetName]   = useState(initial?.sheet_name ?? "Sheet1");
  const [headerRow, setHeaderRow]   = useState(initial?.header_row ?? 1);
  const [interval, setInterval]     = useState(initial?.sync_interval_minutes ?? 60);
  const [conflict, setConflict]     = useState<"skip"|"update">(initial?.conflict_strategy ?? "update");
  const [defType, setDefType]       = useState(initial?.default_customer_type ?? "lead");
  const [defStage, setDefStage]     = useState(initial?.default_customer_stage ?? "new");
  // column_mapping: {crm_field: sheet_col_name} — we build it from header test
  const [colMapping, setColMapping] = useState<Record<string, string>>(initial?.column_mapping ?? {});
  const [headers, setHeaders]       = useState<string[]>(
    initial?.column_mapping ? Object.values(initial.column_mapping).filter(Boolean) : []
  );
  const [allHeaders, setAllHeaders] = useState<string[]>([]);
  const [testLoading, setTestLoading] = useState(false);
  const [testMsg, setTestMsg]       = useState("");
  const [testErr, setTestErr]       = useState("");

  const saveMut = useMutation({
    mutationFn: (data: unknown) =>
      isEdit ? integrationsApi.update(initial!.id, data) : integrationsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      onSaved();
      toast.success(isEdit ? "تم تحديث الربط" : "تم إنشاء الربط");
    },
    onError: () => toast.error("فشل الحفظ"),
  });

  async function handleTest() {
    setTestMsg(""); setTestErr("");
    setTestLoading(true);
    const sid = extractId(sheetInput);
    try {
      const res = await integrationsApi.testConnection({
        spreadsheet_id: sid,
        sheet_name: sheetName || "Sheet1",
        header_row: headerRow,
      });
      const fetched: string[] = res.data.headers ?? [];
      setAllHeaders(fetched);
      // Pre-fill mapping: if a header name matches a CRM field, set it automatically
      const newMapping: Record<string, string> = { ...colMapping };
      CRM_FIELD_OPTIONS.forEach(({ value }) => {
        if (!newMapping[value]) {
          const match = fetched.find((h) => h.toLowerCase().replace(/\s/g, "_") === value);
          if (match) newMapping[value] = match;
        }
      });
      setColMapping(newMapping);
      setTestMsg(`✓ اتصال ناجح — ${fetched.length} عمود، ${res.data.row_count} صف`);
    } catch (err: unknown) {
      setTestErr(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "فشل الاتصال — تحقق من ID الشيت وصلاحيات Service Account"
      );
    } finally {
      setTestLoading(false);
    }
  }

  function handleSave() {
    if (!name.trim()) { toast.error("الاسم مطلوب"); return; }
    const sid = extractId(sheetInput);
    if (!sid) { toast.error("ID الشيت مطلوب"); return; }
    saveMut.mutate({
      name: name.trim(),
      spreadsheet_id: sid,
      sheet_name: sheetName || "Sheet1",
      header_row: headerRow,
      sync_interval_minutes: interval,
      conflict_strategy: conflict,
      default_customer_type: defType,
      default_customer_stage: defStage,
      column_mapping: colMapping,
    });
  }

  const displayHeaders = allHeaders.length > 0 ? allHeaders : Object.values(colMapping).filter(Boolean);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ display: "flex", flexDirection: "column", maxHeight: "92vh" }}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? "تعديل الربط" : "ربط جديد مع Google Sheets"}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          {/* Name */}
          <div className="form-group">
            <label className="form-label">اسم الربط *</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: عملاء Sales Sheet" />
          </div>

          {/* Spreadsheet */}
          <div className="form-group">
            <label className="form-label">رابط أو ID جدول Google Sheets *</label>
            <input className="form-input" value={sheetInput} onChange={(e) => setSheetInput(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." dir="ltr" />
            <small style={{ color: "var(--text-muted)", marginTop: 4 }}>تأكد أن Service Account لديه صلاحية Viewer على الملف</small>
          </div>

          {/* Sheet + header row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <div className="form-group">
              <label className="form-label">اسم الورقة</label>
              <input className="form-input" value={sheetName} onChange={(e) => setSheetName(e.target.value)} dir="ltr" />
            </div>
            <div className="form-group">
              <label className="form-label">رقم سطر الأعمدة</label>
              <input type="number" min={1} className="form-input" value={headerRow} onChange={(e) => setHeaderRow(+e.target.value)} />
            </div>
          </div>

          {/* Test button */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <button className="btn btn-secondary" onClick={handleTest} disabled={testLoading || !sheetInput.trim()}>
              <RefreshCw size={14} className={testLoading ? "animate-spin" : ""} />
              {testLoading ? "جاري الاتصال..." : "اختبر الاتصال واجلب الأعمدة"}
            </button>
            {testMsg && <span style={{ fontSize: "0.85rem", color: "var(--color-success)" }}>{testMsg}</span>}
            {testErr && <span style={{ fontSize: "0.85rem", color: "var(--color-danger)" }}>{testErr}</span>}
          </div>

          {/* Column mapping: for each CRM field pick the sheet header */}
          <div>
            <label className="form-label" style={{ marginBottom: "var(--space-2)" }}>ربط الأعمدة بحقول CRM</label>
            {allHeaders.length === 0 && Object.keys(colMapping).length === 0 ? (
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>اضغط "اختبر الاتصال" أولاً لجلب أسماء الأعمدة</p>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>حقل CRM</th>
                      <th>عمود الشيت المقابل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CRM_FIELD_OPTIONS.map(({ value, label }) => (
                      <tr key={value}>
                        <td style={{ fontSize: "0.85rem" }}>{label}</td>
                        <td>
                          <select
                            className="form-input form-select"
                            style={{ height: 32, fontSize: "0.82rem" }}
                            value={colMapping[value] ?? ""}
                            onChange={(e) => setColMapping((p) => ({ ...p, [value]: e.target.value }))}
                          >
                            <option value="">— تجاهل —</option>
                            {(allHeaders.length > 0 ? allHeaders : displayHeaders).map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Interval + conflict */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <div className="form-group">
              <label className="form-label">فترة التحديث التلقائي</label>
              <select className="form-input form-select" value={interval} onChange={(e) => setInterval(+e.target.value)}>
                {INTERVAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">عند وجود إيميل مكرر</label>
              <select className="form-input form-select" value={conflict} onChange={(e) => setConflict(e.target.value as "skip"|"update")}>
                <option value="update">تحديث البيانات الموجودة</option>
                <option value="skip">تجاهل (skip)</option>
              </select>
            </div>
          </div>

          {/* Defaults */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <div className="form-group">
              <label className="form-label">نوع العميل الافتراضي</label>
              <select className="form-input form-select" value={defType} onChange={(e) => setDefType(e.target.value)}>
                <option value="lead">Lead</option>
                <option value="prospect">Prospect</option>
                <option value="customer">Customer</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">مرحلة العميل الافتراضية</label>
              <select className="form-input form-select" value={defStage} onChange={(e) => setDefStage(e.target.value)}>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="proposal">Proposal</option>
                <option value="negotiation">Negotiation</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saveMut.isPending}>
            {saveMut.isPending ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إنشاء الربط"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Integration Card ─────────────────────────────────────────────────────────
function IntegrationCard({
  integration,
  onEdit,
  onDelete,
  onRun,
}: {
  integration: Integration;
  onEdit: () => void;
  onDelete: () => void;
  onRun: () => void;
}) {
  const [tab, setTab] = useState<"details" | "logs">("details");
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const toggleMut = useMutation({
    mutationFn: () => integrationsApi.update(integration.id, { is_active: !integration.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });

  const mappedFields = Object.entries(integration.column_mapping).filter(([, v]) => v);
  const intervalLabel = INTERVAL_OPTIONS.find((o) => o.value === integration.sync_interval_minutes)?.label ?? `كل ${integration.sync_interval_minutes} دقيقة`;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* Row */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-4) var(--space-5)" }}>
        <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: "rgba(139,92,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <TableProperties size={20} style={{ color: "var(--brand-secondary)" }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.95rem" }}>{integration.name}</span>
            <StatusBadge status={integration.last_sync_status} />
            {!integration.is_active && <span className="badge badge-gray">موقوف</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginTop: 3, flexWrap: "wrap" }}>
            <code style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
              {integration.spreadsheet_id.length > 24 ? integration.spreadsheet_id.slice(0, 24) + "…" : integration.spreadsheet_id}
            </code>
            <span style={{ color: "var(--text-muted)" }}>·</span>
            <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{integration.sheet_name}</span>
            <span style={{ color: "var(--text-muted)" }}>·</span>
            <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{intervalLabel}</span>
            {integration.last_synced_row > 0 && (
              <><span style={{ color: "var(--text-muted)" }}>·</span><span style={{ fontSize: "0.82rem", color: "var(--color-success)" }}>آخر صف: {integration.last_synced_row}</span></>
            )}
          </div>
          {integration.last_sync_at && (
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
              آخر مزامنة: {new Date(integration.last_sync_at).toLocaleString("ar-EG")}
            </p>
          )}
          {integration.last_sync_status === "error" && integration.last_sync_message && (
            <p style={{ fontSize: "0.75rem", color: "var(--color-danger)", marginTop: 2 }}>{integration.last_sync_message}</p>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", flexShrink: 0 }}>
          <button title={integration.is_active ? "إيقاف" : "تفعيل"} onClick={() => toggleMut.mutate()} className="btn btn-ghost btn-sm" style={{ color: integration.is_active ? "var(--color-success)" : "var(--text-muted)", padding: "4px 6px" }}>
            {integration.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
          </button>
          <button title="تشغيل الآن" onClick={onRun} className="btn btn-secondary btn-sm"><Play size={13} /></button>
          <button title="تعديل" onClick={onEdit} className="btn btn-ghost btn-sm"><Settings2 size={13} /></button>
          <button title="حذف" onClick={onDelete} className="btn btn-danger btn-sm"><Trash2 size={13} /></button>
          <button title="التفاصيل" onClick={() => setExpanded((p) => !p)} className="btn btn-ghost btn-sm">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}>
          {/* Tab bar */}
          <div className="tab-bar" style={{ padding: "0 var(--space-5)", marginBottom: 0 }}>
            <button className={`tab-item ${tab === "details" ? "active" : ""}`} onClick={() => setTab("details")}>
              <TableProperties size={13} /> ربط الأعمدة
            </button>
            <button className={`tab-item ${tab === "logs" ? "active" : ""}`} onClick={() => setTab("logs")}>
              <ScrollText size={13} /> سجل المزامنات
            </button>
          </div>

          <div style={{ padding: "var(--space-3) var(--space-5) var(--space-4)" }}>
            {tab === "details" ? (
              <>
                {mappedFields.length === 0 ? (
                  <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>لا يوجد حقول مربوطة — عدّل الإعدادات</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                    {mappedFields.map(([crmField, sheetCol]) => (
                      <span key={crmField} className="badge badge-purple" style={{ fontSize: "0.78rem" }}>
                        <code>{sheetCol}</code> → {crmField}
                      </span>
                    ))}
                  </div>
                )}
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
                  تعارض الإيميل: <strong style={{ color: "var(--text-secondary)" }}>{integration.conflict_strategy === "update" ? "تحديث" : "تجاهل"}</strong>
                  {" · "}نوع افتراضي: <strong style={{ color: "var(--text-secondary)" }}>{integration.default_customer_type}</strong>
                  {" · "}مرحلة افتراضية: <strong style={{ color: "var(--text-secondary)" }}>{integration.default_customer_stage}</strong>
                </p>
              </>
            ) : (
              <SyncLogsPanel integrationId={integration.id} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SheetsSyncPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Integration | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => integrationsApi.list().then((r) => (r.data?.results ?? r.data) as Integration[]),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => integrationsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["integrations"] }); toast.success("تم الحذف"); },
    onError: () => toast.error("فشل الحذف"),
  });

  const runMut = useMutation({
    mutationFn: (id: string) => integrationsApi.syncNow(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      const d = res.data;
      if (d.status === "queued") toast.success("تمت إضافة المهمة للطابور ✓");
      else toast.success(`✓ مزامنة ناجحة — جديد: ${d.rows_created ?? 0}، محدّث: ${d.rows_updated ?? 0}، تجاوز: ${d.rows_skipped ?? 0}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "فشلت المزامنة";
      toast.error(msg);
    },
  });

  const integrations = Array.isArray(data) ? data : [];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <Link href="/crm" className="btn btn-ghost btn-sm" style={{ padding: "6px 8px" }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="page-title">ربط Google Sheets بالـ CRM</h1>
            <p className="page-subtitle">استورد بيانات العملاء تلقائياً من جداول Google</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
          <Plus size={16} /> ربط جديد
        </button>
      </div>

      {/* Info banner */}
      <div className="card" style={{ background: "rgba(139,92,246,0.08)", borderColor: "rgba(139,92,246,0.25)", marginBottom: "var(--space-5)", display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
        <Link2 size={18} style={{ color: "var(--brand-secondary)", flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
          <strong style={{ color: "var(--text-primary)" }}>كيف يعمل:</strong>{" "}
          أضف Service Account الخاص بالمشروع كـ <strong>Viewer</strong> على جدول Google Sheets، ثم أنشئ ربطاً وحدّد أي عمود يذهب لأي حقل في CRM. النظام يجلب الصفوف الجديدة تلقائياً ويضيف/يحدّث سجلات العملاء.
        </p>
      </div>

      {isLoading ? (
        <div>{[1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 80, marginBottom: "var(--space-3)" }} />)}</div>
      ) : integrations.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon"><TableProperties size={28} /></div>
          <h3>لا يوجد روابط بعد</h3>
          <p>اضغط "ربط جديد" لإعداد المزامنة الأولى</p>
          <button className="btn btn-primary" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
            <Plus size={16} /> ربط جديد
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {integrations.map((intg) => (
            <IntegrationCard
              key={intg.id}
              integration={intg}
              onEdit={() => { setEditTarget(intg); setModalOpen(true); }}
              onDelete={() => { if (confirm(`حذف "${intg.name}"؟`)) deleteMut.mutate(intg.id); }}
              onRun={() => runMut.mutate(intg.id)}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <IntegrationFormModal
          initial={editTarget}
          onClose={() => setModalOpen(false)}
          onSaved={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
