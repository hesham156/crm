"use client";

import { useQuery } from "@tanstack/react-query";
import { analyticsApi, tasksApi } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useUIStore } from "@/store/useUIStore";
import Link from "next/link";
import {
  Briefcase, Users, CheckSquare, AlertCircle,
  TrendingUp, ArrowRight, Plus, Clock, Star,
  Palette, Package, DollarSign, CheckCircle,
  XCircle, AlertTriangle, Activity, Target,
  Zap, Award, BarChart2
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────
interface DashboardStats {
  role: string;
  tasks: {
    my_tasks: number;
    overdue: number;
    completed_this_week: number;
    high_priority: number;
  };
  time_logged_hours: number;
  jobs?: {
    total: number;
    in_progress: number;
    completed_this_month: number;
    my_jobs_total: number;
    my_jobs_this_month: number;
    by_status: Record<string, number>;
  };
  revenue?: {
    this_month: number;
    collected: number;
    pending: number;
  };
  customers?: {
    total: number;
    leads: number;
    new_this_month: number;
  };
  designs?: {
    total: number;
    pending_review: number;
    approved: number;
    rejected: number;
    this_month: number;
  };
  jobs_in_design?: number;
  production?: {
    active_stages: number;
    completed_this_month: number;
    jobs_in_production: number;
    jobs_in_delivery: number;
  };
}

// ─── Stat Card ────────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, color, sub, href, trend, trendUp = true,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  sub?: string;
  href?: string;
  trend?: string;
  trendUp?: boolean;
}) {
  const card = (
    <div
      className="stat-card"
      style={{
        borderLeftColor: color,
        borderLeftWidth: "3px",
        cursor: href ? "pointer" : "default",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="stat-icon" style={{ background: `${color}18` }}>
          <span style={{ color }}>{icon}</span>
        </div>
        {trend && (
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              color: trendUp ? "var(--color-success)" : "var(--color-error)",
              background: trendUp ? "var(--color-success-bg, #16a34a18)" : "var(--color-error-bg, #ef444418)",
              padding: "2px 6px",
              borderRadius: "20px",
              display: "flex",
              alignItems: "center",
              gap: "2px",
            }}
          >
            <TrendingUp size={10} style={{ transform: trendUp ? "none" : "scaleY(-1)" }} />
            {trend}
          </div>
        )}
      </div>
      <div className="stat-value" style={{ marginTop: "var(--space-3)" }}>{value ?? "—"}</div>
      <div className="stat-label">{label}</div>
      {sub && (
        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>{sub}</div>
      )}
    </div>
  );

  return href ? <Link href={href} style={{ display: "block" }}>{card}</Link> : card;
}

// ─── Section Header ────────────────────────────────────────────────────────
function SectionHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)" }}>
      <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1rem", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        {title}
      </h2>
      {href && (
        <Link href={href} className="btn btn-ghost btn-sm">
          {linkLabel || "View all"} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}

// ─── Pipeline Bar ──────────────────────────────────────────────────────────
const JOB_STATUSES = [
  { key: "draft",      label: "Draft",      labelAr: "مسودة",      color: "var(--text-muted)" },
  { key: "design",     label: "Design",     labelAr: "تصميم",      color: "var(--brand-secondary)" },
  { key: "approval",   label: "Approval",   labelAr: "انتظار قبول", color: "var(--color-warning)" },
  { key: "production", label: "Production", labelAr: "إنتاج",      color: "var(--color-info)" },
  { key: "delivery",   label: "Delivery",   labelAr: "شحن",        color: "var(--brand-primary)" },
  { key: "complete",   label: "Complete",   labelAr: "مكتمل",      color: "var(--color-success)" },
];

// ─── Main Dashboard ────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuthStore();
  const { language } = useUIStore();
  const isAr = language === "ar";

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const { data } = await analyticsApi.dashboard();
      return data;
    },
  });

  const { data: boards } = useQuery({
    queryKey: ["boards"],
    queryFn: async () => {
      const { data } = await tasksApi.boards();
      return data.results || data;
    },
  });

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return isAr ? "صباح الخير" : "Good morning";
    if (hour < 17) return isAr ? "مسائك نور" : "Good afternoon";
    return isAr ? "مساء الخير" : "Good evening";
  };

  const role = stats?.role || user?.role || "sales";
  const isSales = ["admin", "manager", "sales"].includes(role);
  const isDesigner = ["admin", "manager", "designer"].includes(role);
  const isProduction = ["admin", "manager", "production"].includes(role);
  const isManager = ["admin", "manager"].includes(role);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", minimumFractionDigits: 0 }).format(n);

  return (
    <div>
      {/* ── Page Header ────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {greeting()}, {isAr ? user?.full_name_ar || user?.full_name_en : user?.full_name_en}! 👋
          </h1>
          <p className="page-subtitle" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {isAr ? "إليك ملخص نشاطك الشخصي" : "Here's your personal activity summary"}
            <span style={{
              fontSize: "0.7rem",
              background: "var(--brand-primary)22",
              color: "var(--brand-primary)",
              padding: "2px 8px",
              borderRadius: "20px",
              fontWeight: 600,
              textTransform: "capitalize",
            }}>
              {user?.role}
            </span>
          </p>
        </div>
        {isSales && (
          <Link href="/sales/jobs/new" className="btn btn-primary">
            <Plus size={16} />
            {isAr ? "طلب جديد" : "New Job"}
          </Link>
        )}
      </div>

      {/* ── Personal Task Stats (All roles) ────────────────────────────────── */}
      {isLoading ? (
        <div className="grid-4" style={{ marginBottom: "var(--space-8)" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "140px" }} />
          ))}
        </div>
      ) : (
        <div className="grid-4" style={{ marginBottom: "var(--space-8)" }}>
          <StatCard
            icon={<CheckSquare size={20} />}
            label={isAr ? "مهامي" : "My Tasks"}
            value={stats?.tasks?.my_tasks ?? 0}
            color="var(--brand-secondary)"
            sub={isAr ? `${stats?.tasks?.completed_this_week ?? 0} مكتملة هذا الأسبوع` : `${stats?.tasks?.completed_this_week ?? 0} done this week`}
            href="/tasks"
            trend={stats?.tasks?.completed_this_week ? `+${stats.tasks.completed_this_week}` : undefined}
          />
          <StatCard
            icon={<AlertCircle size={20} />}
            label={isAr ? "مهام متأخرة" : "Overdue"}
            value={stats?.tasks?.overdue ?? 0}
            color="var(--color-error, #ef4444)"
            sub={isAr ? "تحتاج اهتمام فوري" : "Needs immediate attention"}
            href="/tasks"
            trendUp={false}
          />
          <StatCard
            icon={<Zap size={20} />}
            label={isAr ? "أولوية عالية" : "High Priority"}
            value={stats?.tasks?.high_priority ?? 0}
            color="var(--color-warning)"
            sub={isAr ? "مهام حرجة مفتوحة" : "Critical open tasks"}
            href="/tasks"
          />
          <StatCard
            icon={<Clock size={20} />}
            label={isAr ? "ساعات سجلتها" : "Hours Logged"}
            value={`${stats?.time_logged_hours ?? 0}h`}
            color="var(--color-info)"
            sub={isAr ? "هذا الشهر" : "This month"}
          />
        </div>
      )}

      {/* ── Sales / Manager: Jobs & Revenue ──────────────────────────────── */}
      {isSales && !isLoading && stats?.jobs && (
        <>
          <div style={{ marginBottom: "var(--space-3)" }}>
            <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "0.85rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-4)" }}>
              {isAr ? "📋 إحصائيات الطلبات" : "📋 Jobs Overview"}
            </h2>
            <div className="grid-4" style={{ marginBottom: "var(--space-8)" }}>
              <StatCard
                icon={<Briefcase size={20} />}
                label={isAr ? "طلباتي الكلية" : "My Total Jobs"}
                value={stats.jobs.my_jobs_total}
                color="var(--brand-primary)"
                sub={isAr ? `${stats.jobs.my_jobs_this_month} هذا الشهر` : `${stats.jobs.my_jobs_this_month} this month`}
                href="/sales/jobs"
                trend={stats.jobs.my_jobs_this_month ? `+${stats.jobs.my_jobs_this_month}` : undefined}
              />
              <StatCard
                icon={<Activity size={20} />}
                label={isAr ? "قيد التنفيذ" : "In Progress"}
                value={stats.jobs.in_progress}
                color="var(--color-info)"
                sub={isAr ? "طلبات نشطة الآن" : "Active right now"}
                href="/sales/jobs"
              />
              <StatCard
                icon={<CheckCircle size={20} />}
                label={isAr ? "مكتملة هذا الشهر" : "Completed"}
                value={stats.jobs.completed_this_month}
                color="var(--color-success)"
                sub={isAr ? "هذا الشهر" : "This month"}
                href="/sales/jobs"
                trend={stats.jobs.completed_this_month ? `+${stats.jobs.completed_this_month}` : undefined}
              />
              {stats.revenue && (
                <StatCard
                  icon={<DollarSign size={20} />}
                  label={isAr ? "إيرادات الشهر" : "Revenue"}
                  value={formatCurrency(stats.revenue.this_month)}
                  color="var(--color-success)"
                  sub={isAr ? `محصّل: ${formatCurrency(stats.revenue.collected)}` : `Collected: ${formatCurrency(stats.revenue.collected)}`}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Designer Stats ─────────────────────────────────────────────── */}
      {isDesigner && !isLoading && stats?.designs && (
        <div style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "0.85rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-4)" }}>
            {isAr ? "🎨 إحصائيات التصميم" : "🎨 Design Stats"}
          </h2>
          <div className="grid-4">
            <StatCard
              icon={<Palette size={20} />}
              label={isAr ? "تصاميمي الكلية" : "My Designs"}
              value={stats.designs.total}
              color="var(--brand-secondary)"
              sub={isAr ? `${stats.designs.this_month} هذا الشهر` : `${stats.designs.this_month} this month`}
              href="/design"
              trend={stats.designs.this_month ? `+${stats.designs.this_month}` : undefined}
            />
            <StatCard
              icon={<AlertTriangle size={20} />}
              label={isAr ? "في انتظار المراجعة" : "Pending Review"}
              value={stats.designs.pending_review}
              color="var(--color-warning)"
              sub={isAr ? "تحتاج رد من العميل" : "Awaiting client feedback"}
              href="/design"
            />
            <StatCard
              icon={<CheckCircle size={20} />}
              label={isAr ? "معتمدة" : "Approved"}
              value={stats.designs.approved}
              color="var(--color-success)"
              href="/design"
              trend={stats.designs.approved ? undefined : undefined}
            />
            <StatCard
              icon={<XCircle size={20} />}
              label={isAr ? "مرفوضة / تحتاج تعديل" : "Needs Revision"}
              value={stats.designs.rejected}
              color="var(--color-error, #ef4444)"
              sub={isAr ? "تحتاج تعديلات" : "Requires changes"}
              href="/design"
              trendUp={false}
            />
          </div>
        </div>
      )}

      {/* ── Production Stats ───────────────────────────────────────────── */}
      {isProduction && !isLoading && stats?.production && (
        <div style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "0.85rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-4)" }}>
            {isAr ? "⚙️ إحصائيات الإنتاج" : "⚙️ Production Stats"}
          </h2>
          <div className="grid-4">
            <StatCard
              icon={<Package size={20} />}
              label={isAr ? "مراحل نشطة" : "Active Stages"}
              value={stats.production.active_stages}
              color="var(--color-info)"
              href="/production"
            />
            <StatCard
              icon={<CheckCircle size={20} />}
              label={isAr ? "مكتملة هذا الشهر" : "Done This Month"}
              value={stats.production.completed_this_month}
              color="var(--color-success)"
              href="/production"
              trend={stats.production.completed_this_month ? `+${stats.production.completed_this_month}` : undefined}
            />
            <StatCard
              icon={<Activity size={20} />}
              label={isAr ? "طلبات في الإنتاج" : "In Production"}
              value={stats.production.jobs_in_production}
              color="var(--brand-primary)"
              href="/sales/jobs"
            />
            <StatCard
              icon={<ArrowRight size={20} />}
              label={isAr ? "قيد التوصيل" : "Out for Delivery"}
              value={stats.production.jobs_in_delivery}
              color="var(--brand-secondary)"
              href="/sales/jobs"
            />
          </div>
        </div>
      )}

      {/* ── Two-Column: Pipeline + Quick Panel ─────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: isSales ? "1fr 360px" : "1fr 360px", gap: "var(--space-6)" }}>

        {/* Pipeline (show for sales/admin, else show task summary) */}
        <div className="card">
          {isSales && stats?.jobs ? (
            <>
              <SectionHeader
                title={isAr ? "خط سير الإنتاج" : "Production Pipeline"}
                href="/sales/jobs"
                linkLabel={isAr ? "عرض الكل" : "View all"}
              />
              <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                {JOB_STATUSES.map((status) => {
                  const count = stats.jobs?.by_status?.[status.key] ?? 0;
                  return (
                    <div
                      key={status.key}
                      style={{
                        flex: "1 1 90px",
                        background: "var(--bg-elevated)",
                        borderRadius: "var(--radius-md)",
                        padding: "var(--space-4)",
                        border: `1px solid ${status.color}30`,
                        textAlign: "center",
                        transition: "border-color 0.15s",
                      }}
                    >
                      <div style={{
                        width: "8px", height: "8px",
                        borderRadius: "50%",
                        background: status.color,
                        margin: "0 auto var(--space-2)",
                      }} />
                      <div style={{ fontSize: "1.5rem", fontWeight: 800, fontFamily: "var(--font-heading)" }}>
                        {count}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                        {isAr ? status.labelAr : status.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : isDesigner && stats?.designs ? (
            <>
              <SectionHeader title={isAr ? "حالة التصاميم" : "Design Status"} href="/design" linkLabel={isAr ? "عرض الكل" : "View all"} />
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {[
                  { label: isAr ? "مسودة" : "Draft", count: stats.designs.total - stats.designs.pending_review - stats.designs.approved - stats.designs.rejected, color: "var(--text-muted)" },
                  { label: isAr ? "بانتظار المراجعة" : "Pending Review", count: stats.designs.pending_review, color: "var(--color-warning)" },
                  { label: isAr ? "معتمدة" : "Approved", count: stats.designs.approved, color: "var(--color-success)" },
                  { label: isAr ? "تحتاج تعديل" : "Needs Revision", count: stats.designs.rejected, color: "var(--color-error, #ef4444)" },
                ].map((item) => {
                  const total = stats.designs!.total || 1;
                  const pct = Math.round(((item.count ?? 0) / total) * 100);
                  return (
                    <div key={item.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{item.label}</span>
                        <span style={{ fontSize: "0.82rem", fontWeight: 700 }}>{item.count ?? 0}</span>
                      </div>
                      <div style={{ height: "6px", background: "var(--bg-elevated)", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: item.color, borderRadius: "4px", transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <SectionHeader title={isAr ? "ملخص مهامي" : "My Tasks Summary"} href="/tasks" linkLabel={isAr ? "عرض الكل" : "View all"} />
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                {[
                  { label: isAr ? "إجمالي المهام" : "Total Tasks", value: stats?.tasks?.my_tasks ?? 0, color: "var(--brand-secondary)" },
                  { label: isAr ? "عالية الأولوية" : "High Priority", value: stats?.tasks?.high_priority ?? 0, color: "var(--color-warning)" },
                  { label: isAr ? "متأخرة" : "Overdue", value: stats?.tasks?.overdue ?? 0, color: "var(--color-error, #ef4444)" },
                  { label: isAr ? "مكتملة هذا الأسبوع" : "Done This Week", value: stats?.tasks?.completed_this_week ?? 0, color: "var(--color-success)" },
                ].map((item) => {
                  const max = stats?.tasks?.my_tasks || 1;
                  const pct = Math.min(100, Math.round((item.value / max) * 100));
                  return (
                    <div key={item.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{item.label}</span>
                        <span style={{ fontSize: "0.82rem", fontWeight: 700 }}>{item.value}</span>
                      </div>
                      <div style={{ height: "6px", background: "var(--bg-elevated)", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: item.color, borderRadius: "4px", transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Quick Actions Panel */}
        <div className="card">
          <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1rem", marginBottom: "var(--space-4)" }}>
            {isAr ? "إجراءات سريعة" : "Quick Actions"}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {[
              { label: isAr ? "إنشاء مهمة" : "Create Task", href: "/tasks", icon: <CheckSquare size={16} />, color: "var(--color-info)" },
              { label: isAr ? "إنشاء طلب جديد" : "Create New Job", href: "/sales/jobs/new", icon: <Plus size={16} />, color: "var(--brand-primary)", roles: ["admin", "manager", "sales"] },
              { label: isAr ? "إضافة عميل" : "Add Customer", href: "/crm", icon: <Users size={16} />, color: "var(--brand-secondary)", roles: ["admin", "manager", "sales"] },
              { label: isAr ? "فحص المخزون" : "Check Inventory", href: "/inventory", icon: <AlertCircle size={16} />, color: "var(--color-warning)", roles: ["admin", "manager", "production", "sales"] },
            ].map((action) => {
              if (action.roles && user && !action.roles.includes(user.role)) return null;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="btn btn-secondary"
                  style={{ justifyContent: "flex-start", width: "100%", gap: "var(--space-3)" }}
                >
                  <span style={{ color: action.color }}>{action.icon}</span>
                  {action.label}
                  <ArrowRight size={14} style={{ marginLeft: "auto", color: "var(--text-muted)" }} />
                </Link>
              );
            })}
          </div>

          {/* Customer summary (managers/sales) */}
          {isSales && stats?.customers && (
            <>
              <div className="divider" />
              <h3 style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "var(--space-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {isAr ? "العملاء" : "Customers"}
              </h3>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                {[
                  { label: isAr ? "الكل" : "Total", value: stats.customers.total, color: "var(--brand-primary)" },
                  { label: isAr ? "عملاء محتملون" : "Leads", value: stats.customers.leads, color: "var(--color-warning)" },
                  { label: isAr ? "جدد" : "New", value: stats.customers.new_this_month, color: "var(--color-success)" },
                ].map((c) => (
                  <Link key={c.label} href="/crm" style={{ flex: 1, textAlign: "center", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "var(--space-3)", textDecoration: "none" }}>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: c.color }}>{c.value}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>{c.label}</div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* Recent boards */}
          {boards && boards.length > 0 && (
            <>
              <div className="divider" />
              <h3 style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "var(--space-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {isAr ? "لوحاتي" : "My Boards"}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                {boards.slice(0, 3).map((board: { id: string; color: string; name: string; task_count: number }) => (
                  <Link
                    key={board.id}
                    href={`/tasks/${board.id}`}
                    className="nav-item"
                    style={{ padding: "var(--space-2) var(--space-2)", margin: 0 }}
                  >
                    <div style={{
                      width: "10px", height: "10px",
                      borderRadius: "50%",
                      background: board.color,
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: "0.85rem", flex: 1 }}>{board.name}</span>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      {board.task_count} {isAr ? "مهمة" : "tasks"}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
