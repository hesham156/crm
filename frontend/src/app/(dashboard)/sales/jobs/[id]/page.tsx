"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { salesApi } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import { format } from "date-fns";
import { ArrowLeft, FileText, Download, Plus, Check, DollarSign } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

import QuotationModal from "@/components/sales/QuotationModal";
import InvoiceModal from "@/components/sales/InvoiceModal";
import SendTaskModal from "@/components/sales/SendTaskModal";

const STATUS_STYLES: Record<string, { class: string }> = {
  draft: { class: "badge badge-gray" },
  design: { class: "badge badge-purple" },
  approval: { class: "badge badge-warning" },
  production: { class: "badge badge-info" },
  delivery: { class: "badge badge-orange" },
  complete: { class: "badge badge-success" },
  cancelled: { class: "badge badge-danger" },
};

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const { language } = useUIStore();
  const isAr = language === "ar";
  const [activeTab, setActiveTab] = useState<"overview" | "tasks" | "quotations" | "invoices">("overview");
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showSendTaskModal, setShowSendTaskModal] = useState(false);

  const queryClient = useQueryClient();

  const statuses = [
    { id: "draft", label: isAr ? "مسودة" : "Draft" },
    { id: "design", label: isAr ? "التصميم" : "Design" },
    { id: "approval", label: isAr ? "قيد الموافقة" : "Approval" },
    { id: "production", label: isAr ? "الإنتاج" : "Production" },
    { id: "delivery", label: isAr ? "التوصيل" : "Delivery" },
    { id: "complete", label: isAr ? "مكتمل" : "Complete" },
    { id: "cancelled", label: isAr ? "ملغي" : "Cancelled" },
  ];

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", params.id],
    queryFn: async () => {
      const { data } = await salesApi.job(params.id);
      return data;
    },
  });

  const { data: quotations } = useQuery({
    queryKey: ["job", params.id, "quotations"],
    queryFn: async () => {
      const { data } = await salesApi.quotations(params.id);
      return data.results || data;
    },
    enabled: !!job,
  });

  const { data: invoices } = useQuery({
    queryKey: ["job", params.id, "invoices"],
    queryFn: async () => {
      const { data } = await salesApi.invoices({ job: params.id });
      return data.results || data;
    },
    enabled: !!job,
  });

  if (isLoading) return <div className="skeleton" style={{ height: "400px", borderRadius: "12px" }} />;
  if (!job) return <div>{isAr ? "الطلب غير موجود" : "Job not found"}</div>;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <Link href="/sales" className="btn btn-ghost btn-sm" style={{ padding: "var(--space-2)" }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <h1 className="page-title" style={{ margin: 0 }}>{job.title}</h1>
            <span className={STATUS_STYLES[job.status]?.class || "badge badge-gray"}>{job.status}</span>
            <span className={`badge priority-${job.priority}`}>{job.priority}</span>
          </div>
          <p className="page-subtitle" style={{ margin: 0, marginTop: "4px" }}>
            <span style={{ fontFamily: "monospace", color: "var(--brand-primary)", fontWeight: 700 }}>
              {job.job_number}
            </span>
            {" • "}
            {job.customer_name}
            {" • "}
            {format(new Date(job.created_at), "MMM d, yyyy")}
          </p>
        </div>
        <div style={{ position: "relative", display: "flex", gap: "var(--space-2)" }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowSendTaskModal(true)}
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            {isAr ? "إرسال كـ مهمة" : "Send to Board"}
          </button>
          
          <button 
            className="btn btn-primary" 
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            {isAr ? "تحديث الحالة" : "Update Status"}
          </button>
          
          {showStatusMenu && (
            <div 
              style={{ 
                position: "absolute", top: "100%", right: 0, marginTop: "8px",
                background: "var(--bg-card)", border: "1px solid var(--border-light)",
                borderRadius: "var(--radius-md)", boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                zIndex: 50, minWidth: "220px", padding: "var(--space-2)"
              }}
            >
              <div style={{ padding: "var(--space-2) var(--space-3)", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
                {isAr ? "تغيير الحالة إلى:" : "Change status to:"}
              </div>
              {statuses.map(s => (
                <button 
                  key={s.id}
                  style={{
                    display: "block", width: "100%", textAlign: isAr ? "right" : "left",
                    padding: "var(--space-3)", background: job.status === s.id ? "var(--bg-elevated)" : "transparent",
                    border: "none", cursor: "pointer", borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)", transition: "background 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = job.status === s.id ? "var(--bg-elevated)" : "var(--bg-base)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = job.status === s.id ? "var(--bg-elevated)" : "transparent"}
                  onClick={() => {
                    setShowStatusMenu(false);
                    if (s.id !== job.status) {
                       salesApi.updateJob(job.id, { status: s.id }).then(() => {
                         queryClient.invalidateQueries({ queryKey: ["job", job.id] });
                         queryClient.invalidateQueries({ queryKey: ["jobs"] });
                         toast.success(isAr ? "تم تحديث الحالة بنجاح" : "Status updated successfully");
                       }).catch(() => toast.error(isAr ? "حدث خطأ" : "Error updating status"));
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                       <span className={STATUS_STYLES[s.id]?.class || "badge badge-gray"} style={{ width: "12px", height: "12px", padding: 0, borderRadius: "50%" }}></span>
                       <span style={{ fontWeight: job.status === s.id ? 600 : 400 }}>{s.label}</span>
                    </div>
                    {job.status === s.id && <Check size={16} color="var(--brand-primary)" />}
                  </div>
                </button>
              ))}
            </div>
          )}
          {showStatusMenu && (
            <div 
              style={{ position: "fixed", inset: 0, zIndex: 40 }} 
              onClick={() => setShowStatusMenu(false)}
            />
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "var(--space-6)" }}>
        {/* Main Content */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--border-light)" }}>
            {[
              { id: "overview", label: isAr ? "نظرة عامة" : "Overview" },
              { id: "tasks", label: isAr ? "المهام المرتبطة" : "Linked Tasks" },
              { id: "quotations", label: isAr ? "عروض الأسعار" : "Quotations" },
              { id: "invoices", label: isAr ? "الفواتير" : "Invoices" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                style={{
                  padding: "var(--space-4) var(--space-5)",
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === t.id ? "2px solid var(--brand-primary)" : "2px solid transparent",
                  color: activeTab === t.id ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: activeTab === t.id ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ padding: "var(--space-5)" }}>
            {activeTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
                <div>
                  <h3 style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
                    {isAr ? "استفسار العميل" : "Client Requirements"}
                  </h3>
                  <div style={{ background: "var(--bg-elevated)", padding: "var(--space-4)", borderRadius: "var(--radius-md)", whiteSpace: "pre-wrap" }}>
                    {job.client_requirements || (isAr ? "لا توجد متطلبات مسجلة" : "No client requirements provided.")}
                  </div>
                </div>
                <div>
                  <h3 style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
                    {isAr ? "ملاحظات داخلية" : "Internal Description"}
                  </h3>
                  <p style={{ margin: 0 }}>
                    {job.description || "—"}
                  </p>
                </div>
              </div>
            )}

            {activeTab === "tasks" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
                  <h3 style={{ margin: 0 }}>{isAr ? "المهام المرتبطة بالطلب" : "Tasks linked to this job"}</h3>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowSendTaskModal(true)}>
                    <Plus size={14} /> {isAr ? "إرسال كـ مهمة" : "Send Task"}
                  </button>
                </div>
                {!job.linked_tasks || job.linked_tasks.length === 0 ? (
                  <div className="empty-state">
                    <FileText size={24} style={{ color: "var(--text-muted)" }} />
                    <p style={{ margin: "var(--space-2) 0", color: "var(--text-secondary)" }}>
                      {isAr ? "لا توجد أي مهام بورد مرتبطة بهذا الطلب" : "No tasks linked to this job yet"}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {job.linked_tasks?.map((t: any) => (
                      <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-4)", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)" }}>
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: "4px", fontSize: "1.05rem" }}>
                            {t.title}
                          </div>
                          <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>{isAr ? "موجودة في: " : "Board: "}<strong style={{color:"var(--text-primary)"}}>{t.board_name}</strong></span>
                            <span>•</span>
                            <span style={{ color: t.column_color || "var(--brand-primary)", fontWeight: 600 }}>{t.column_name}</span>
                            <span>•</span>
                            <span className={`badge priority-${t.priority}`}>{t.priority}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                          {t.assigned_to?.length > 0 ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              {t.assigned_to.map((u: any) => (
                                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--bg-card)", padding: "2px 8px 2px 2px", borderRadius: "16px", border: "1px solid var(--border-light)" }}>
                                  <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--brand-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", overflow: "hidden" }}>
                                    {u.avatar ? <img src={u.avatar} style={{width:"100%", height:"100%", objectFit:"cover"}} alt={u.name}/> : u.name.charAt(0)}
                                  </div>
                                  <span style={{ fontSize: "0.8rem", fontWeight: 500 }}>{u.name}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{isAr ? "غير معينة" : "Unassigned"}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "quotations" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
                  <h3 style={{ margin: 0 }}>{isAr ? "عروض الأسعار المسجلة" : "Logged Quotations"}</h3>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowQuoteModal(true)}>
                    <Plus size={14} /> {isAr ? "إضافة عرض" : "New Quote"}
                  </button>
                </div>
                {quotations?.length === 0 ? (
                  <div className="empty-state">
                    <FileText size={24} style={{ color: "var(--text-muted)" }} />
                    <p style={{ margin: "var(--space-2) 0", color: "var(--text-secondary)" }}>
                      {isAr ? "لم يتم إنشاء عروض أسعار بعد" : "No quotations created yet"}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {quotations?.map((q: any) => (
                      <div key={q.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-4)", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)" }}>
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                            {isAr ? "عرض سعر #" : "Quote #"}{q.id.split("-")[0]}
                          </div>
                          <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                            {format(new Date(q.created_at), "MMM d, yyyy")}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                          <span className={`badge badge-${q.status === "approved" ? "success" : q.status === "draft" ? "gray" : "info"}`}>
                            {q.status}
                          </span>
                          <span style={{ fontWeight: 700, fontFamily: "monospace", fontSize: "1.1rem" }}>
                            SAR {q.total}
                          </span>
                          <button className="btn btn-ghost btn-sm" title="Download PDF">
                            <Download size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "invoices" && (
              <div>
                 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
                  <h3 style={{ margin: 0 }}>{isAr ? "الفواتير" : "Invoices"}</h3>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowInvoiceModal(true)}>
                    <Plus size={14} /> {isAr ? "إنشاء فاتورة" : "Create Invoice"}
                  </button>
                </div>
                {invoices?.length === 0 ? (
                  <div className="empty-state">
                    <DollarSign size={24} style={{ color: "var(--text-muted)" }} />
                    <p style={{ margin: "var(--space-2) 0", color: "var(--text-secondary)" }}>
                      {isAr ? "لم يتم إنشاء فواتير بعد" : "No invoices created yet"}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {invoices?.map((inv: any) => (
                      <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-4)", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)" }}>
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                            {isAr ? "فاتورة للطلب " : "Invoice for "}{inv.job_number}
                          </div>
                          <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                            {format(new Date(inv.created_at), "MMM d, yyyy")} {inv.due_date && `• Due: ${inv.due_date}`}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                          <span className={`badge badge-${inv.payment_status === "paid" ? "success" : "warning"}`}>
                            {inv.payment_status}
                          </span>
                          <span style={{ fontWeight: 700, fontFamily: "monospace", fontSize: "1.1rem" }}>
                            SAR {inv.total_amount}
                          </span>
                          <button className="btn btn-ghost btn-sm" title="Download PDF">
                            <Download size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div className="card" style={{ padding: "var(--space-4)" }}>
            <h3 style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "var(--space-3)" }}>
              {isAr ? "معلومات هامة" : "Key Info"}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{isAr ? "العميل" : "Client"}</div>
                <div style={{ fontWeight: 600 }}>{job.customer_name}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{isAr ? "تم الإنشاء بواسطة" : "Created By"}</div>
                <div>{job.created_by_name}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{isAr ? "الموعد النهائي" : "Deadline"}</div>
                <div style={{ color: job.deadline ? "inherit" : "var(--text-muted)" }}>
                  {job.deadline ? format(new Date(job.deadline), "MMMM d, yyyy") : (isAr ? "غير محدد" : "Not Set")}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{isAr ? "المبلغ الكلي" : "Total Amount"}</div>
                <div style={{ fontWeight: 700, color: "var(--brand-primary)", fontSize: "1.1rem" }}>
                  SAR {job.total_amount}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {showQuoteModal && (
        <QuotationModal jobId={job.id} onClose={() => setShowQuoteModal(false)} />
      )}
      
      {showInvoiceModal && (
        <InvoiceModal 
          jobId={job.id} 
          defaultAmount={job.total_amount ? Number(job.total_amount) : 0}
          onClose={() => setShowInvoiceModal(false)} 
        />
      )}
      
      {showSendTaskModal && (
        <SendTaskModal
          jobId={job.id}
          jobNumber={job.job_number}
          jobTitle={job.title}
          jobDescription={job.description}
          jobClientRequirements={job.client_requirements}
          jobPriority={job.priority}
          onClose={() => setShowSendTaskModal(false)}
        />
      )}
    </div>
  );
}
