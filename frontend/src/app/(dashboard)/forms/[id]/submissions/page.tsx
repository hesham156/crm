"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formsApi } from "@/lib/api";
import {
  ArrowLeft, Mail, User, Eye, EyeOff, BarChart2,
  Download, Clock, Globe, CheckCircle, Circle,
  FileIcon, ExternalLink,
} from "lucide-react";

interface FieldResponse {
  id: string;
  field: string | null;
  field_type: string;
  label_snapshot: string;
  value: unknown;
}

interface Submission {
  id: string;
  submitted_at: string;
  is_read: boolean;
  customer: string | null;
  ip_address: string;
  responses: FieldResponse[];
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join("، ");
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  return String(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ar-EG", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function SubmissionsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Submission | null>(null);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["submissions", id],
    queryFn: () => formsApi.submissions(id).then((r) => (r.data.results ?? r.data) as Submission[]),
  });

  const markReadMutation = useMutation({
    mutationFn: (subId: string) => formsApi.markRead(subId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["submissions", id] }),
  });

  const unread = submissions.filter((s) => !s.is_read).length;

  const exportCSV = () => {
    if (!submissions.length) return;
    const allLabels = Array.from(
      new Set(submissions.flatMap((s) => s.responses.map((r) => r.label_snapshot)))
    );
    const header = ["التاريخ", "IP", ...allLabels];
    const rows = submissions.map((s) => {
      const map: Record<string, unknown> = {};
      s.responses.forEach((r) => { map[r.label_snapshot] = r.value; });
      return [formatDate(s.submitted_at), s.ip_address, ...allLabels.map((l) => formatValue(map[l]))];
    });
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `submissions-${id.slice(0, 8)}.csv`;
    a.click();
  };

  return (
    <div style={{
      display: "flex",
      height: "calc(100vh - var(--topbar-height))",
      overflow: "hidden",
      flexDirection: "column",
      margin: "calc(var(--space-6) * -1)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "var(--space-3)",
        padding: "0 var(--space-5)", height: 56,
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-card)", flexShrink: 0,
      }}>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push("/forms")}>
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontWeight: 700, fontSize: "1rem", margin: 0 }}>ردود الفورم</h1>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {submissions.length} رد إجمالي · {unread} غير مقروء
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={exportCSV}>
          <Download size={15} /> تصدير CSV
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* List */}
        <div style={{
          width: 320, flexShrink: 0,
          borderRight: "1px solid var(--border-subtle)",
          overflowY: "auto", background: "var(--bg-card)",
        }}>
          {isLoading ? (
            <div style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--text-muted)" }}>جاري التحميل...</div>
          ) : submissions.length === 0 ? (
            <div style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--text-muted)" }}>
              <BarChart2 size={32} style={{ margin: "0 auto var(--space-3)", display: "block" }} />
              لا توجد ردود بعد
            </div>
          ) : (
            submissions.map((sub) => (
              <div
                key={sub.id}
                onClick={() => {
                  setSelected(sub);
                  if (!sub.is_read) markReadMutation.mutate(sub.id);
                }}
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--border-subtle)",
                  background: selected?.id === sub.id ? "rgba(249,115,22,0.08)" : "transparent",
                  transition: "background 0.15s",
                  display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
                }}
              >
                <div style={{ paddingTop: 2 }}>
                  {sub.is_read ? (
                    <CheckCircle size={14} style={{ color: "var(--text-muted)" }} />
                  ) : (
                    <Circle size={14} style={{ color: "var(--brand-primary)" }} fill="currentColor" />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: sub.is_read ? 400 : 700, fontSize: "0.85rem", color: "var(--text-primary)", marginBottom: 2 }}>
                    {sub.responses.find((r) => ["name", "الاسم"].some((k) => r.label_snapshot.includes(k)))
                      ? formatValue(sub.responses.find((r) => r.label_snapshot.includes("اسم"))?.value)
                      : `رد #${sub.id.slice(0, 6)}`}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Clock size={11} />
                    {formatDate(sub.submitted_at)}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Globe size={11} /> {sub.ip_address || "—"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail */}
        <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-elevated)", padding: "var(--space-5)" }}>
          {!selected ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", paddingTop: "var(--space-10)" }}>
              <Eye size={40} style={{ margin: "0 auto var(--space-3)", display: "block" }} />
              اختر رداً من القائمة لعرض تفاصيله
            </div>
          ) : (
            <div style={{ maxWidth: 640, margin: "0 auto" }}>
              {/* Meta */}
              <div className="card" style={{ marginBottom: "var(--space-4)" }}>
                <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
                  <MetaItem icon={<Clock size={14} />} label="وقت الإرسال" value={formatDate(selected.submitted_at)} />
                  <MetaItem icon={<Globe size={14} />} label="IP" value={selected.ip_address || "—"} />
                  {selected.customer && (
                    <MetaItem icon={<User size={14} />} label="عميل في CRM" value="✓ تم الإنشاء" />
                  )}
                </div>
              </div>

              {/* Responses */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {selected.responses.map((resp) => (
                  <div key={resp.id} className="card">
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "var(--space-1)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {resp.label_snapshot}
                    </div>
                    <div style={{ fontSize: "0.95rem", color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.6 }}>
                      {Array.isArray(resp.value) ? (
                        <FileListValue items={resp.value as unknown[]} />
                      ) : typeof resp.value === "boolean" ? (
                        <span className={`badge ${resp.value ? "badge-success" : "badge-gray"}`}>
                          {resp.value ? "نعم" : "لا"}
                        </span>
                      ) : resp.value !== null && typeof resp.value === "object" ? (
                        <FileListValue items={[resp.value]} />
                      ) : (
                        formatValue(resp.value)
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── File / Image list renderer ──────────────────────────────────────────────
function FileListValue({ items }: { items: unknown[] }) {
  const formatSize = (bytes: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Check if item looks like an uploaded-file object
  const isFileObj = (v: unknown): v is { url: string; name: string; size: number; type: string } =>
    typeof v === "object" && v !== null && "url" in v && "name" in v;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, i) => {
        if (!isFileObj(item)) {
          // Fallback: plain string values (e.g. multiple_choice)
          return <div key={i}>{item === null || item === undefined ? "—" : String(item)}</div>;
        }
        const isImage = item.type?.startsWith("image/");
        return (
          <div key={i} style={{
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            overflow: "hidden",
            background: "var(--bg-elevated)",
          }}>
            {isImage && (
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.name}
                  style={{
                    width: "100%",
                    maxHeight: 240,
                    objectFit: "contain",
                    display: "block",
                    background: "#f3f4f6",
                  }}
                />
              </a>
            )}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 12px",
            }}>
              <FileIcon size={15} style={{ color: "var(--brand-primary)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name}
                </div>
                {item.size > 0 && (
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{formatSize(item.size)}</div>
                )}
              </div>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--text-muted)", display: "flex", flexShrink: 0 }}
                title="فتح"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}
