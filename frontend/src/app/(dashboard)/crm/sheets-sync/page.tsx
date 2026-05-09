"use client";

import { useState } from "react";
import {
  Sheet,
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
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { crmApi } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
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
  updated_at: string;
}

const CRM_FIELDS = [
  { value: "", label: "— Skip this column —" },
  { value: "name", label: "Name (الاسم)" },
  { value: "company", label: "Company (الشركة)" },
  { value: "email", label: "Email (البريد الإلكتروني)" },
  { value: "phone", label: "Phone (الهاتف)" },
  { value: "type", label: "Type: lead / prospect / customer" },
  { value: "stage", label: "Stage: new / contacted / proposal / negotiation / won / lost" },
  { value: "address", label: "Address (العنوان)" },
  { value: "notes", label: "Notes (ملاحظات)" },
  { value: "website", label: "Website (الموقع)" },
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

// ─── Helper: extract spreadsheet ID from URL ──────────────────────────────────

function extractSpreadsheetId(input: string): string {
  // Accept full URL like https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#...
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : input.trim();
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "success")
    return (
      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-success)" }}>
        <CheckCircle size={12} /> نجاح
      </span>
    );
  if (status === "error")
    return (
      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-danger)" }}>
        <XCircle size={12} /> خطأ
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
      <Clock size={12} /> في الانتظار
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
  const [interval, setInterval] = useState(initial?.sync_interval_minutes ?? 60);
  const [matchField, setMatchField] = useState(initial?.match_field ?? "email");
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>(initial?.field_mapping ?? {});
  const [headers, setHeaders] = useState<string[]>(
    initial?.field_mapping ? Object.keys(initial.field_mapping) : []
  );
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState("");

  const createMut = useMutation({
    mutationFn: (data: unknown) => crmApi.createSheetsSync(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sheets-syncs"] }); onSaved(); toast.success("تم إنشاء الربط بنجاح"); },
    onError: () => toast.error("فشل إنشاء الربط"),
  });

  const updateMut = useMutation({
    mutationFn: (data: unknown) => crmApi.updateSheetsSync(initial!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sheets-syncs"] }); onSaved(); toast.success("تم تحديث الربط بنجاح"); },
    onError: () => toast.error("فشل تحديث الربط"),
  });

  async function handleTest() {
    setTestError("");
    setTestLoading(true);
    const sid = extractSpreadsheetId(spreadsheetInput);
    try {
      const res = await crmApi.testSheetsConnection({
        spreadsheet_id: sid,
        sheet_name: sheetName || "Sheet1",
        header_row: headerRow,
      });
      const fetchedHeaders: string[] = res.data.headers ?? [];
      setHeaders(fetchedHeaders);
      // Initialise mapping from existing or empty
      const newMapping: Record<string, string> = {};
      fetchedHeaders.forEach((h) => {
        newMapping[h] = fieldMapping[h] ?? "";
      });
      setFieldMapping(newMapping);
      toast.success(`تم الاتصال — وجدنا ${fetchedHeaders.length} عمود و ${res.data.row_count} سطر`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "فشل الاتصال";
      setTestError(msg);
      toast.error(msg);
    } finally {
      setTestLoading(false);
    }
  }

  function handleSave() {
    if (!name.trim()) { toast.error("الاسم مطلوب"); return; }
    const sid = extractSpreadsheetId(spreadsheetInput);
    if (!sid) { toast.error("رابط أو ID الشيت مطلوب"); return; }

    const payload = {
      name: name.trim(),
      spreadsheet_id: sid,
      sheet_name: sheetName || "Sheet1",
      header_row: headerRow,
      sync_interval_minutes: interval,
      match_field: matchField,
      field_mapping: fieldMapping,
    };

    if (isEdit) {
      updateMut.mutate(payload);
    } else {
      createMut.mutate(payload);
    }
  }

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--bg-primary)", maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
          <h2 className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>
            {isEdit ? "تعديل الربط" : "ربط جديد مع Google Sheets"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: "var(--text-muted)" }}>✕</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 flex flex-col gap-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>اسم الربط *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: بيانات العملاء من CRM Sheet"
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
            />
          </div>

          {/* Spreadsheet URL / ID */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              رابط Google Sheet أو ID الجدول *
            </label>
            <input
              value={spreadsheetInput}
              onChange={(e) => setSpreadsheetInput(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/... أو فقط الـ ID"
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              dir="ltr"
            />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              تأكد أن Service Account لديه صلاحية Viewer على هذا الملف
            </p>
          </div>

          {/* Sheet name + header row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>اسم الورقة (Sheet)</label>
              <input
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder="Sheet1"
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>رقم سطر الأعمدة</label>
              <input
                type="number"
                min={1}
                value={headerRow}
                onChange={(e) => setHeaderRow(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>
          </div>

          {/* Test connection */}
          <button
            onClick={handleTest}
            disabled={testLoading || !spreadsheetInput.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium self-start"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", opacity: testLoading ? 0.7 : 1 }}
          >
            <RefreshCw size={14} className={testLoading ? "animate-spin" : ""} />
            {testLoading ? "جاري الاتصال..." : "اختبر الاتصال واجلب الأعمدة"}
          </button>
          {testError && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{testError}</p>}

          {/* Field mapping */}
          {headers.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3" style={{ color: "var(--text-primary)" }}>
                ربط الأعمدة بحقول CRM
              </h3>
              <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--border-color)" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                      <th className="px-3 py-2 text-right font-medium">عمود الشيت</th>
                      <th className="px-3 py-2 text-right font-medium">حقل CRM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map((header) => (
                      <tr key={header} style={{ borderTop: "1px solid var(--border-color)" }}>
                        <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--text-primary)" }}>{header}</td>
                        <td className="px-3 py-2">
                          <select
                            value={fieldMapping[header] ?? ""}
                            onChange={(e) => setFieldMapping((prev) => ({ ...prev, [header]: e.target.value }))}
                            className="w-full px-2 py-1 rounded border text-xs"
                            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                          >
                            {CRM_FIELDS.map((f) => (
                              <option key={f.value} value={f.value}>{f.label}</option>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>فترة التحديث</label>
              <select
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              >
                {INTERVAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                حقل التعريف (لتجنب التكرار)
              </label>
              <select
                value={matchField}
                onChange={(e) => setMatchField(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              >
                <option value="email">Email</option>
                <option value="name">Name</option>
                <option value="phone">Phone</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: "var(--border-color)" }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--brand-primary)", color: "#fff", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إنشاء الربط"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sync Card ────────────────────────────────────────────────────────────────

function SyncCard({ sync, onEdit, onDelete, onRun }: { sync: SheetsSync; onEdit: () => void; onDelete: () => void; onRun: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const toggleMut = useMutation({
    mutationFn: () => crmApi.updateSheetsSync(sync.id, { is_enabled: !sync.is_enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sheets-syncs"] }),
  });

  const mappedFields = Object.entries(sync.field_mapping).filter(([, v]) => v);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)" }}>
      {/* Card header */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--bg-secondary)" }}
        >
          <Sheet size={20} style={{ color: "var(--brand-primary)" }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{sync.name}</span>
            <StatusBadge status={sync.last_sync_status} />
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs font-mono truncate" style={{ color: "var(--text-muted)" }}>{sync.spreadsheet_id}</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>·</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{sync.sheet_name}</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>·</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {INTERVAL_OPTIONS.find((o) => o.value === sync.sync_interval_minutes)?.label ?? `كل ${sync.sync_interval_minutes} دقيقة`}
            </span>
            {sync.total_synced > 0 && (
              <>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>·</span>
                <span className="text-xs" style={{ color: "var(--color-success)" }}>{sync.total_synced} سجل مُزامن</span>
              </>
            )}
          </div>
          {sync.last_sync_at && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              آخر مزامنة: {new Date(sync.last_sync_at).toLocaleString("ar-EG")}
            </p>
          )}
          {sync.last_sync_status === "error" && sync.last_sync_message && (
            <p className="text-xs mt-0.5" style={{ color: "var(--color-danger)" }}>{sync.last_sync_message}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => toggleMut.mutate()}
            title={sync.is_enabled ? "إيقاف" : "تفعيل"}
            className="p-1"
            style={{ color: sync.is_enabled ? "var(--color-success)" : "var(--text-muted)" }}
          >
            {sync.is_enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
          </button>
          <button
            onClick={onRun}
            title="تشغيل الآن"
            className="p-1.5 rounded-lg hover:opacity-80"
            style={{ background: "var(--bg-secondary)", color: "var(--brand-primary)" }}
          >
            <Play size={14} />
          </button>
          <button
            onClick={onEdit}
            title="تعديل"
            className="p-1.5 rounded-lg hover:opacity-80"
            style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}
          >
            <Settings2 size={14} />
          </button>
          <button
            onClick={onDelete}
            title="حذف"
            className="p-1.5 rounded-lg hover:opacity-80"
            style={{ background: "var(--bg-secondary)", color: "var(--color-danger)" }}
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setExpanded((p) => !p)}
            className="p-1.5 rounded-lg hover:opacity-80"
            style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded field mapping */}
      {expanded && (
        <div className="px-5 pb-4 border-t" style={{ borderColor: "var(--border-color)" }}>
          <h4 className="text-xs font-semibold mt-3 mb-2" style={{ color: "var(--text-secondary)" }}>
            ربط الأعمدة ({mappedFields.length} حقل مربوط)
          </h4>
          {mappedFields.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>لا يوجد حقول مربوطة — عدّل الإعدادات لإضافة الربط</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {mappedFields.map(([sheetCol, crmField]) => (
                <span
                  key={sheetCol}
                  className="text-xs px-2 py-1 rounded-md"
                  style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}
                >
                  <span className="font-mono">{sheetCol}</span>
                  <span className="mx-1" style={{ color: "var(--text-muted)" }}>→</span>
                  <span style={{ color: "var(--brand-primary)" }}>{crmField}</span>
                </span>
              ))}
            </div>
          )}
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            حقل التعريف (لتجنب التكرار): <strong>{sync.match_field}</strong>
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
        toast.success("تم إضافة المهمة للطابور ✓");
      } else {
        toast.success(`✓ مزامنة ناجحة — ${d.total ?? 0} سجل (${d.created ?? 0} جديد، ${d.updated ?? 0} محدّث)`);
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "فشلت المزامنة";
      toast.error(msg);
    },
  });

  const syncs = Array.isArray(data) ? data : [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/crm"
          className="p-2 rounded-lg hover:opacity-70"
          style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            ربط Google Sheets بالـ CRM
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            استورد بيانات العملاء تلقائياً من جداول Google Sheets بفترة منتظمة
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--brand-primary)", color: "#fff" }}
        >
          <Plus size={16} />
          ربط جديد
        </button>
      </div>

      {/* How it works banner */}
      <div
        className="rounded-xl p-4 mb-6 flex gap-3"
        style={{ background: "rgba(var(--brand-primary-rgb,99,102,241),0.08)", border: "1px solid rgba(var(--brand-primary-rgb,99,102,241),0.2)" }}
      >
        <Link2 size={18} style={{ color: "var(--brand-primary)", flexShrink: 0, marginTop: 2 }} />
        <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
          <strong style={{ color: "var(--text-primary)" }}>كيف يعمل:</strong>{" "}
          أضف Service Account كـ Viewer على جدول Google Sheets، ثم أنشئ ربطاً هنا وحدّد الأعمدة. النظام يجلب البيانات تلقائياً حسب الفترة المحددة ويضيف/يحدّث سجلات العملاء في CRM.
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <RefreshCw size={24} className="animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      ) : syncs.length === 0 ? (
        <div
          className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-16 text-center"
          style={{ borderColor: "var(--border-color)" }}
        >
          <Sheet size={40} className="mb-3" style={{ color: "var(--text-muted)", opacity: 0.5 }} />
          <p className="font-medium" style={{ color: "var(--text-secondary)" }}>لا يوجد روابط بعد</p>
          <p className="text-sm mt-1 mb-4" style={{ color: "var(--text-muted)" }}>اضغط "ربط جديد" لإعداد المزامنة الأولى</p>
          <button
            onClick={() => { setEditTarget(null); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--brand-primary)", color: "#fff" }}
          >
            <Plus size={16} /> ربط جديد
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
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
