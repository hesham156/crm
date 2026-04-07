"use client";
import { ShoppingBag, Plus, FileText, Clock, CheckCircle, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { salesApi } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import { format } from "date-fns";
import Link from "next/link";

const STATUS_STYLES: Record<string, { class: string }> = {
  draft: { class: "badge badge-gray" },
  design: { class: "badge badge-purple" },
  approval: { class: "badge badge-warning" },
  production: { class: "badge badge-info" },
  delivery: { class: "badge badge-orange" },
  complete: { class: "badge badge-success" },
  cancelled: { class: "badge badge-danger" },
};

// ─────────────────────────────────────────────
// Shared row type
// ─────────────────────────────────────────────
type Job = {
  id: string;
  job_number: string;
  title: string;
  customer_name: string;
  status: string;
  priority: string;
  deadline: string | null;
  total_amount: number;
  linked_tasks?: any[];
  created_at?: string;
};

// ─────────────────────────────────────────────
// Shared Table Row
// ─────────────────────────────────────────────
function JobRow({ job, isAr }: { job: Job; isAr: boolean }) {
  return (
    <tr>
      <td><span style={{ fontFamily: "monospace", color: "var(--brand-primary)", fontWeight: 700 }}>{job.job_number}</span></td>
      <td><span style={{ fontWeight: 600 }}>{job.title}</span></td>
      <td><span style={{ color: "var(--text-secondary)" }}>{job.customer_name}</span></td>
      <td><span className={STATUS_STYLES[job.status]?.class || "badge badge-gray"}>{job.status}</span></td>
      <td><span className={`badge priority-${job.priority}`}>{job.priority}</span></td>
      <td>{job.deadline ? format(new Date(job.deadline), "MMM d, yyyy") : "—"}</td>
      <td><span style={{ fontWeight: 700 }}>{job.total_amount ? `SAR ${job.total_amount}` : "—"}</span></td>
      <td>
        {(job.linked_tasks?.length || 0) > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {job.linked_tasks?.map((t: any) => (
              <div key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--bg-elevated)", padding: "2px 8px", borderRadius: "12px", border: "1px solid var(--border-light)", fontSize: "0.75rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>{t.board_name}:</span>
                <span style={{ fontWeight: 600, color: t.column_color || "var(--brand-primary)" }}>{t.column_name}</span>
                {t.assigned_to?.length > 0 && (
                  <div style={{ display: "flex", marginLeft: "4px" }}>
                    {t.assigned_to.map((u: any) => (
                      <div key={u.id} style={{ width: "16px", height: "16px", borderRadius: "50%", background: "var(--brand-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", marginLeft: "-4px", border: "1px solid var(--bg-card)", overflow: "hidden" }} title={u.name}>
                        {u.avatar ? <img src={u.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={u.name} /> : u.name.charAt(0)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>—</span>
        )}
      </td>
      <td>
        <Link href={`/sales/jobs/${job.id}`} className="btn btn-ghost btn-sm">
          {isAr ? "عرض" : "View"}
        </Link>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────
// Table columns header (reused)
// ─────────────────────────────────────────────
function TableHead({ isAr, accentBg }: { isAr: boolean; accentBg?: string }) {
  return (
    <thead>
      <tr style={accentBg ? { background: accentBg } : {}}>
        <th>{isAr ? "رقم الطلب" : "Job #"}</th>
        <th>{isAr ? "العنوان" : "Title"}</th>
        <th>{isAr ? "العميل" : "Customer"}</th>
        <th>{isAr ? "الحالة" : "Status"}</th>
        <th>{isAr ? "الأولوية" : "Priority"}</th>
        <th>{isAr ? "الموعد النهائي" : "Deadline"}</th>
        <th>{isAr ? "المبلغ" : "Amount"}</th>
        <th>{isAr ? "المهام" : "Tasks"}</th>
        <th></th>
      </tr>
    </thead>
  );
}

// ─────────────────────────────────────────────
// All Active Jobs Table
// ─────────────────────────────────────────────
function JobsTable({ title, jobs, isLoading, isAr, emptyMsg }: {
  title: string; jobs: Job[]; isLoading: boolean; isAr: boolean; emptyMsg: string;
}) {
  return (
    <div style={{ marginBottom: "var(--space-8)" }}>
      <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "var(--space-3)" }}>
        {title}
        <span style={{ marginLeft: "10px", fontSize: "0.85rem", fontWeight: 500, color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "2px 10px", borderRadius: "99px" }}>
          {jobs.length}
        </span>
      </h2>
      {isLoading ? (
        <div className="skeleton" style={{ height: "200px", borderRadius: "var(--radius-lg)" }} />
      ) : jobs.length === 0 ? (
        <div style={{ padding: "var(--space-6)", textAlign: "center", background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)", color: "var(--text-muted)" }}>
          <FileText size={20} style={{ marginBottom: "8px", opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: "0.9rem" }}>{emptyMsg}</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <TableHead isAr={isAr} />
            <tbody>
              {jobs.map((job) => <JobRow key={job.id} job={job} isAr={isAr} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Delivery / Completed Table
// ─────────────────────────────────────────────
function DeliveryTable({ title, subtitle, jobs, isLoading, isAr, accentColor, emptyMsg }: {
  title: string; subtitle: string; jobs: Job[]; isLoading: boolean; isAr: boolean; accentColor: string; emptyMsg: string;
}) {
  return (
    <div style={{ marginBottom: "var(--space-8)" }}>
      {/* Section Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "var(--space-3)",
        padding: "var(--space-4) var(--space-5)",
        background: `${accentColor}10`,
        border: `1px solid ${accentColor}30`,
        borderRadius: "var(--radius-lg)",
        marginBottom: "var(--space-3)",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>
            {title}
            <span style={{
              marginLeft: "10px", fontSize: "0.8rem", fontWeight: 600,
              color: accentColor, background: `${accentColor}18`,
              padding: "2px 10px", borderRadius: "99px",
            }}>
              {jobs.length}
            </span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>{subtitle}</div>
        </div>
      </div>

      {isLoading ? (
        <div className="skeleton" style={{ height: "200px", borderRadius: "var(--radius-lg)" }} />
      ) : jobs.length === 0 ? (
        <div style={{
          padding: "var(--space-6)", textAlign: "center",
          background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
          border: "1px dashed var(--border-light)", color: "var(--text-muted)",
        }}>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>{emptyMsg}</p>
        </div>
      ) : (
        <div className="table-wrapper" style={{ border: `1px solid ${accentColor}30`, borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          <table className="table">
            <TableHead isAr={isAr} accentBg={`${accentColor}08`} />
            <tbody>
              {jobs.map((job) => <JobRow key={job.id} job={job} isAr={isAr} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function SalesPage() {
  const { language } = useUIStore();
  const isAr = language === "ar";

  const { data, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data } = await salesApi.jobs();
      return data.results || data;
    },
  });

  const jobs: Job[] = data || [];

  const activeJobs    = jobs.filter((j) => !["delivery", "complete", "cancelled"].includes(j.status));
  const deliveryJobs  = jobs.filter((j) => j.status === "delivery");
  const completedJobs = jobs.filter((j) => j.status === "complete");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? "المبيعات والطلبات" : "Sales & Jobs"}</h1>
          <p className="page-subtitle">{isAr ? "إدارة طلبات الطباعة" : "Manage print orders and jobs"}</p>
        </div>
        <Link href="/sales/jobs/new" id="new-job-btn" className="btn btn-primary">
          <Plus size={16} />{isAr ? "طلب جديد" : "New Job"}
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid-4" style={{ marginBottom: "var(--space-6)" }}>
        {[
          {
            label: isAr ? "الكل" : "All Jobs",
            value: jobs.length,
            icon: <ShoppingBag size={18} />,
            color: "var(--brand-primary)",
          },
          {
            label: isAr ? "نشط" : "Active",
            value: activeJobs.length,
            icon: <Clock size={18} />,
            color: "var(--color-info)",
          },
          {
            label: isAr ? "جاهز للتسليم" : "Ready to Deliver",
            value: deliveryJobs.length,
            icon: <CheckCircle size={18} />,
            color: "var(--color-warning)",
          },
          {
            label: isAr ? "تم التسليم" : "Delivered",
            value: completedJobs.length,
            icon: <XCircle size={18} />,
            color: "var(--color-success)",
          },
        ].map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-icon" style={{ background: `${stat.color}18` }}>
              <span style={{ color: stat.color }}>{stat.icon}</span>
            </div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── ALL ACTIVE JOBS ── */}
      <JobsTable
        title={isAr ? "جميع الطلبات النشطة" : "All Active Jobs"}
        jobs={activeJobs}
        isLoading={isLoading}
        isAr={isAr}
        emptyMsg={isAr ? "لا توجد طلبات نشطة" : "No active jobs"}
      />

      {/* ── READY FOR DELIVERY ── */}
      <DeliveryTable
        title={isAr ? "🚚 جاهزة للتسليم" : "🚚 Ready for Delivery"}
        subtitle={isAr ? "الأوردرات التي انتهى تصنيعها وجاهزة لتُسلَّم للعميل" : "Orders finished production and ready to be handed to the customer"}
        jobs={deliveryJobs}
        isLoading={isLoading}
        isAr={isAr}
        accentColor="var(--color-warning)"
        emptyMsg={isAr ? "لا توجد أوردرات جاهزة للتسليم حالياً" : "No orders ready for delivery"}
      />

      {/* ── DELIVERED ── */}
      <DeliveryTable
        title={isAr ? "✅ تم التسليم" : "✅ Delivered Orders"}
        subtitle={isAr ? "الأوردرات التي سُلِّمت للعميل بنجاح" : "Orders that have been successfully delivered to the customer"}
        jobs={completedJobs}
        isLoading={isLoading}
        isAr={isAr}
        accentColor="var(--color-success)"
        emptyMsg={isAr ? "لا توجد أوردرات مسلَّمة بعد" : "No delivered orders yet"}
      />
    </div>
  );
}
