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
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { crmApi } from "@/lib/api";
import toast from "react-hot-toast";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SheetsSync {
  id: string;
  name: string;
  spreadsheet_id: string;
  sheet_name: string;
  header_row: number;
  sync_interval_minutes: number;
  is_enabled: boolean;
  field_mapping: Record<string, string>;
  match_field: string;
  last_sync_at: string | null;
  last_sync_status: "pending" | "success" | "error";
  last_sync_message: string;
  total_synced: number;
  created_at: string;
}

const CRM_FIELDS = [
  { value: "", label: "— تجاهل هذا العمود —" },
  { value: "name", label: "الاسم (name)" },
  { value: "company", label: "الشركة (company)" },
  { value: "email", label: "البريد الإلكتروني (email)" },
  { value: "phone", label: "الهاتف (phone)" },
  { value: "type", label: "النوع: lead / prospect / customer" },
  { value: "stage", label: "المرحلة: new / contacted / proposal / won / lost" },
  { value: "address", label: "العنوان (address)" },
  { value: "notes", label: "ملاحظات (notes)" },
  { value: "website", label: "الموقع (website)" },
];

const INTERVAL_OPTIONS = [
  { value: 1, label: "كل دقيقة (للاختبار)" },
  { value: 5, label: "كل 5 دقائق" },
  { value: 15, label: "كل 15 دقيقة" },
  { value: 30, label: "كل 30 دقيقة" },
  { value: 60, label: "كل ساعة" },
  { value: 120, label: "كل ساعتين" },
  { value: 360, label: "كل 6 ساعات" },
  { value: 720, label: "كل 12 ساعة" },
  { value: 1440, label: "يومياً" },
];

function extractSpreadsheetId(input: string): string {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : input.trim();
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "success")
    return (
      <span className="badge badge-success">
        <CheckCircle size={10} /> نجاح
      </span>
    );
  if (status === "error")
    return (
      <span className="badge badge-danger">
        <XCircle size={10} /> خطأ
      </span>
    );
  return (
    <span className="badge badge-gray">
      <Clock size={10} /> انتظار
    </span>
  );
}

// ─── Sync Form Modal ──────────────────────────────────────────────────────────
function SyncFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: SheetsSync | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const qc = useQueryClient();

  const [name, setName] = useState(initial?.name ?? "");
  const [spreadsheetInput, setSpreadsheetInput] = useState(initial?.spreadsheet_id ?? "");
  const [sheetName, setSheetName] = useState(initial?.sheet_name ?? "Sheet1");
  const [headerRow, setHeaderRow] = useState(initial?.header_row ?? 1);
  const [interval, setIntervalVal] = useState(initial?.sync_interval_minutes ?? 60);
  const [matchField, setMatchField] = useState(initial?.match_field ?? "email");
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>(
    initial?.field_mapping ?? {}
  );
  const [headers, setHeaders] = useState<string[]>(
    initial?.field_mapping ? Object.keys(initial.field_mapping) : []
  );
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState("");
  const [testInfo, setTestInfo] = useState("");

  const saveMut = useMutation({
    mutationFn: (data: unknown) =>
      isEdit ? crmApi.updateSheetsSync(initial!.id, data) : crmApi.createSheetsSync(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sheets-syncs"] });
      onSaved();
      toast.success(isEdit ? "تم تحديث الربط" : "تم إنشاء الربط");
    },
    onError: () => toast.error("فشل الحفظ"),
  });

  async function handleTest() {
    setTestError("");
    setTestInfo("");
    setTestLoading(true);
    const sid = extractSpreadsheetId(spreadsheetInput);
    try {
      const res = await crmApi.testSheetsConnection({
        spreadsheet_id: sid,
        sheet_name: sheetName || "Sheet1",
        header_row: headerRow,
      });
      const fetched: string[] = res.data.headers ?? [];
      setHeaders(fetched);
      const newMapping: Record<string, string> = {};
      fetched.forEach((h) => {
        newMapping[h] = fieldMapping[h] ?? "";
      });
      setFieldMapping(newMapping);
      setTestInfo(`✓ اتصال ناجح — ${fetched.length} عمود، ${res.data.row_count} سطر`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "فشل الاتصال — تأكد من ID الشيت وصلاحيات Service Account";
      setTestError(msg);
    } finally {
      setTestLoading(false);
    }
  }

  function handleSave() {
    if (!name.trim()) { toast.error("الاسم مطلوب"); return; }
    const sid = extractSpreadsheetId(spreadsheetInput);
    if (!sid) { toast.error("رابط أو ID الشيت مطلوب"); return; }
    saveMut.mutate({
      name: name.trim(),
      spreadsheet_id: sid,
      sheet_name: sheetName || "Sheet1",
      header_row: headerRow,
      sync_interval_minutes: interval,
      match_field: matchField,
      field_mapping: fieldMapping,
    });
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal modal-lg" style={{ display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">
            {isEdit ? "تعديل الربط" : "ربط جديد مع Google Sheets"}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>

          {/* Name */}
          <div className="form-group">
            <label className="form-label">اسم الربط *</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: عملاء Sales Sheet"
            />
          </div>

          {/* Spreadsheet URL/ID */}
          <div className="form-group">
            <label className="form-label">رابط أو ID جدول Google Sheets *</label>
            <input
              className="form-input"
              value={spreadsheetInput}
              onChange={(e) => setSpreadsheetInput(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/... أو فقط الـ ID"
              dir="ltr"
            />
            <span className="form-error" style={{ color: "var(--text-tertiary)", marginTop: 4 }}>
              تأكد أن Service Account لديه صلاحية Viewer على هذا الملف
            </span>
          </div>

          {/* Sheet name + header row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <div className="form-group">
              <label className="form-label">اسم الورقة (Sheet Tab)</label>
              <input
                className="form-input"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder="Sheet1"
                dir="ltr"
              />
            </div>
            <div className="form-group">
              <label className="form-label">رقم سطر الأعمدة</label>
              <input
                type="number"
                min={1}
                className="form-input"
                value={headerRow}
                onChange={(e) => setHeaderRow(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Test button */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <button
              className="btn btn-secondary"
              onClick={handleTest}
              disabled={testLoading || !spreadsheetInput.trim()}
            >
              <RefreshCw size={14} className={testLoading ? "animate-spin" : ""} />
              {testLoading ? "جاري الاتصال..." : "اختبر الاتصال واجلب الأعمدة"}
            </button>
            {testInfo && (
              <span style={{ fontSize: "0.85rem", color: "var(--color-success)" }}>{testInfo}</span>
            )}
            {testError && (
              <span style={{ fontSize: "0.85rem", color: "var(--color-danger)" }}>{testError}</span>
            )}
          </div>

          {/* Field mapping table */}
          {headers.length > 0 && (
            <div>
              <div className="form-label" style={{ marginBottom: "var(--space-2)" }}>
                ربط الأعمدة بحقول CRM
              </div>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>عمود الشيت</th>
                      <th>حقل CRM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map((header) => (
                      <tr key={header}>
                        <td>
                          <code style={{ fontSize: "0.82rem", color: "var(--brand-secondary)" }}>
                            {header}
                          </code>
                        </td>
                        <td>
                          <select
                            className="form-input form-select"
                            style={{ height: 32, fontSize: "0.82rem" }}
                            value={fieldMapping[header] ?? ""}
                            onChange={(e) =>
                              setFieldMapping((p) => ({ ...p, [header]: e.target.value }))
                            }
                          >
                            {CRM_FIELDS.map((f) => (
                              <option key={f.value} value={f.value}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Interval + match field */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <div className="form-group">
              <label className="form-label">فترة التحديث التلقائي</label>
              <select
                className="form-input form-select"
                value={interval}
                onChange={(e) => setIntervalVal(Number(e.target.value))}
              >
                {INTERVAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">حقل تجنب التكرار</label>
              <select
                className="form-input form-select"
                value={matchField}
                onChange={(e) => setMatchField(e.target.value)}
              >
                <option value="email">Email (البريد الإلكتروني)</option>
                <option value="name">Name (الاسم)</option>
                <option value="phone">Phone (الهاتف)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saveMut.isPending}
          >
            {saveMut.isPending ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إنشاء الربط"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sync Card ────────────────────────────────────────────────────────────────
function SyncCard({
  sync,
  onEdit,
  onDelete,
  onRun,
}: {
  sync: SheetsSync;
  onEdit: () => void;
  onDelete: () => void;
  onRun: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const toggleMut = useMutation({
    mutationFn: () => crmApi.updateSheetsSync(sync.id, { is_enabled: !sync.is_enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sheets-syncs"] }),
  });

  const mappedFields = Object.entries(sync.field_mapping).filter(([, v]) => v);
  const intervalLabel =
    INTERVAL_OPTIONS.find((o) => o.value === sync.sync_interval_minutes)?.label ??
    `كل ${sync.sync_interval_minutes} دقيقة`;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          padding: "var(--space-4) var(--space-5)",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--radius-md)",
            background: "rgba(139,92,246,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <TableProperties size={20} style={{ color: "var(--brand-secondary)" }} />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.95rem" }}>
              {sync.name}
            </span>
            <StatusBadge status={sync.last_sync_status} />
            {!sync.is_enabled && (
              <span className="badge badge-gray">موقوف</span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              marginTop: 3,
              flexWrap: "wrap",
            }}
          >
            <code style={{ fontSize: "0.78rem", color: "var(--text-tertiary)" }}>
              {sync.spreadsheet_id.length > 28
                ? sync.spreadsheet_id.slice(0, 28) + "…"
                : sync.spreadsheet_id}
            </code>
            <span style={{ color: "var(--text-muted)" }}>·</span>
            <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{sync.sheet_name}</span>
            <span style={{ color: "var(--text-muted)" }}>·</span>
            <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{intervalLabel}</span>
            {sync.total_synced > 0 && (
              <>
                <span style={{ color: "var(--text-muted)" }}>·</span>
                <span style={{ fontSize: "0.82rem", color: "var(--color-success)" }}>
                  {sync.total_synced} سجل مُزامن
                </span>
              </>
            )}
          </div>
          {sync.last_sync_at && (
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>
              آخر مزامنة: {new Date(sync.last_sync_at).toLocaleString("ar-EG")}
            </p>
          )}
          {sync.last_sync_status === "error" && sync.last_sync_message && (
            <p style={{ fontSize: "0.78rem", color: "var(--color-danger)", marginTop: 2 }}>
              {sync.last_sync_message}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", flexShrink: 0 }}>
          <button
            title={sync.is_enabled ? "إيقاف المزامنة" : "تفعيل المزامنة"}
            onClick={() => toggleMut.mutate()}
            className="btn btn-ghost btn-sm"
            style={{ color: sync.is_enabled ? "var(--color-success)" : "var(--text-muted)", padding: "4px 6px" }}
          >
            {sync.is_enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
          </button>
          <button title="تشغيل الآن" onClick={onRun} className="btn btn-secondary btn-sm">
            <Play size={13} />
          </button>
          <button title="تعديل" onClick={onEdit} className="btn btn-ghost btn-sm">
            <Settings2 size={13} />
          </button>
          <button title="حذف" onClick={onDelete} className="btn btn-danger btn-sm">
            <Trash2 size={13} />
          </button>
          <button
            title={expanded ? "إخفاء التفاصيل" : "عرض التفاصيل"}
            onClick={() => setExpanded((p) => !p)}
            className="btn btn-ghost btn-sm"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded: field mapping detail */}
      {expanded && (
        <div
          style={{
            padding: "var(--space-3) var(--space-5) var(--space-4)",
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--bg-surface)",
          }}
        >
          <p className="form-label" style={{ marginBottom: "var(--space-2)" }}>
            ربط الأعمدة ({mappedFields.length} حقل مربوط)
          </p>
          {mappedFields.length === 0 ? (
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
              لا يوجد حقول مربوطة — عدّل الإعدادات
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
              {mappedFields.map(([sheetCol, crmField]) => (
                <span
                  key={sheetCol}
                  className="badge badge-purple"
                  style={{ fontSize: "0.78rem", padding: "3px 8px" }}
                >
                  <code>{sheetCol}</code>
                  <span style={{ color: "var(--text-muted)", margin: "0 4px" }}>→</span>
                  {crmField}
                </span>
              ))}
            </div>
          )}
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
            حقل تجنب التكرار: <strong style={{ color: "var(--text-secondary)" }}>{sync.match_field}</strong>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SheetsSyncPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SheetsSync | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sheets-syncs"],
    queryFn: () => crmApi.sheetsSyncs().then((r) => r.data as SheetsSync[]),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => crmApi.deleteSheetsSync(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sheets-syncs"] }); toast.success("تم الحذف"); },
    onError: () => toast.error("فشل الحذف"),
  });

  const runMut = useMutation({
    mutationFn: (id: string) => crmApi.runSheetsSync(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["sheets-syncs"] });
      const d = res.data;
      if (d.status === "queued") {
        toast.success("تمت إضافة المهمة للطابور ✓");
      } else {
        toast.success(
          `✓ مزامنة ناجحة — ${d.total ?? 0} سجل (${d.created ?? 0} جديد، ${d.updated ?? 0} محدّث)`
        );
      }
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "فشلت المزامنة";
      toast.error(msg);
    },
  });

  const syncs = Array.isArray(data) ? data : [];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Page Header */}
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
        <button
          className="btn btn-primary"
          onClick={() => { setEditTarget(null); setModalOpen(true); }}
        >
          <Plus size={16} /> ربط جديد
        </button>
      </div>

      {/* Info Banner */}
      <div
        className="card"
        style={{
          background: "rgba(139,92,246,0.08)",
          borderColor: "rgba(139,92,246,0.25)",
          marginBottom: "var(--space-5)",
          display: "flex",
          gap: "var(--space-3)",
          alignItems: "flex-start",
        }}
      >
        <Link2 size={18} style={{ color: "var(--brand-secondary)", flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
          <strong style={{ color: "var(--text-primary)" }}>كيف يعمل:</strong>{" "}
          أضف Service Account الخاص بالمشروع كـ <strong>Viewer</strong> على جدول Google Sheets، ثم أنشئ ربطاً هنا وحدّد الأعمدة. النظام يجلب البيانات تلقائياً حسب الفترة المختارة ويضيف أو يحدّث سجلات العملاء في CRM.
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <div>
          {[1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 80, marginBottom: "var(--space-3)" }} />
          ))}
        </div>
      ) : syncs.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">
            <TableProperties size={28} />
          </div>
          <h3>لا يوجد روابط بعد</h3>
          <p>اضغط "ربط جديد" لإعداد المزامنة الأولى مع Google Sheets</p>
          <button
            className="btn btn-primary"
            onClick={() => { setEditTarget(null); setModalOpen(true); }}
          >
            <Plus size={16} /> ربط جديد
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {syncs.map((sync) => (
            <SyncCard
              key={sync.id}
              sync={sync}
              onEdit={() => { setEditTarget(sync); setModalOpen(true); }}
              onDelete={() => {
                if (confirm(`هل تريد حذف "${sync.name}"؟`)) deleteMut.mutate(sync.id);
              }}
              onRun={() => runMut.mutate(sync.id)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <SyncFormModal
          initial={editTarget}
          onClose={() => setModalOpen(false)}
          onSaved={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
