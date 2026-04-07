"use client";

import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import { 
  Activity, CheckCircle, Clock, AlertCircle, Briefcase, 
  TrendingUp, Users, PenTool, LayoutDashboard
} from "lucide-react";

export default function AnalyticsPage() {
  const { language } = useUIStore();
  const isAr = language === "ar";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analyticsDashboard"],
    queryFn: async () => {
      const response = await analyticsApi.dashboard();
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="page-container animate-fade-in">
        <div className="page-header">
          <h1 className="page-title skeleton" style={{ width: "200px" }}></h1>
        </div>
        <div className="grid-4" style={{ marginTop: "var(--space-6)" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card skeleton" style={{ height: "120px" }} />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <AlertCircle size={48} style={{ color: "var(--danger-main)" }} />
          <h3>{isAr ? "حدث خطأ" : "An error occurred"}</h3>
          <p>{isAr ? "فشل في تحميل بيانات لوحة القيادة" : "Failed to load dashboard data"}</p>
        </div>
      </div>
    );
  }

  const { role, tasks, time_logged_hours, jobs, revenue, customers, designs, production, jobs_in_design } = data;

  // Colors for Recharts
  const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

  // Formatter for Currency
  const formatCurrency = (val: number) => `SAR ${val.toLocaleString()}`;

  // Prepare Pie Chart Data for Tasks
  const taskPieData = [
    { name: isAr ? 'مكتملة هذا الأسبوع' : 'Completed (Week)', value: tasks?.completed_this_week || 0 },
    { name: isAr ? 'متأخرة' : 'Overdue', value: tasks?.overdue || 0 },
    { name: isAr ? 'أولوية قصوى' : 'High Priority', value: tasks?.high_priority || 0 },
  ].filter(item => item.value > 0);

  // Default fallback if all 0 
  if (taskPieData.length === 0 && tasks?.my_tasks > 0) {
    taskPieData.push({ name: isAr ? 'أخرى' : 'Other Tasks', value: tasks.my_tasks });
  }

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1 className="page-title">
            <TrendingUp size={28} style={{ color: "var(--brand-primary)", marginRight: isAr ? 0 : "12px", marginLeft: isAr ? "12px" : 0 }} />
            {isAr ? "لوحة القيادة والتحليلات" : "Analytics & Dashboard"}
          </h1>
          <p className="page-subtitle">
            {isAr ? `مرحباً بك. دورك الحالي في النظام هو: ${role}` : `Welcome back. Your current role is: ${role}`}
          </p>
        </div>
      </div>

      {/* ─── GLOBAL KPI ROW (MY TASKS) ────────────────────────────── */}
      <div className="grid-4" style={{ marginBottom: "var(--space-8)" }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(139, 92, 246, 0.1)", color: "var(--brand-primary)" }}>
            <Activity size={24} />
          </div>
          <p className="stat-title">{isAr ? "مهامي الحالية" : "My Active Tasks"}</p>
          <h3 className="stat-value">{tasks?.my_tasks || 0}</h3>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.1)", color: "var(--warning-main)" }}>
            <Clock size={24} />
          </div>
          <p className="stat-title">{isAr ? "ساعات العمل (الشهر)" : "Hours Logged (Month)"}</p>
          <h3 className="stat-value">{time_logged_hours || 0} <span style={{fontSize:"1rem", fontWeight:400, color:"var(--text-muted)"}}>hrs</span></h3>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--success-main)" }}>
            <CheckCircle size={24} />
          </div>
          <p className="stat-title">{isAr ? "مهام أُنجزت (أسبوع)" : "Completed (Week)"}</p>
          <h3 className="stat-value">{tasks?.completed_this_week || 0}</h3>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--danger-main)" }}>
            <AlertCircle size={24} />
          </div>
          <p className="stat-title">{isAr ? "مهام متأخرة" : "Overdue Tasks"}</p>
          <h3 className="stat-value">{tasks?.overdue || 0}</h3>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "var(--space-6)", marginBottom: "var(--space-8)" }}>
        
        {/* Task Breakdown Pie Chart */}
        <div style={{ background: "var(--bg-elevated)", padding: "var(--space-5)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)" }}>
          <h3 style={{ marginBottom: "var(--space-4)", fontSize: "1.1rem" }}>{isAr ? "تحليل حالة مهامي" : "My Tasks Breakdown"}</h3>
          {taskPieData.length > 0 ? (
            <div style={{ height: "300px", width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {taskPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)" }}
                    itemStyle={{ color: "var(--text-primary)" }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state" style={{ height: "300px" }}>
              <p>{isAr ? "لا توجد بيانات كافية" : "Not enough data"}</p>
            </div>
          )}
        </div>

        {/* ─── SALES & REVENUE BLOCK ────────────────────────────── */}
        {revenue && jobs && (
          <div style={{ background: "var(--bg-elevated)", padding: "var(--space-5)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)" }}>
            <h3 style={{ marginBottom: "var(--space-4)", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "8px" }}>
              <Briefcase size={20} className="text-primary" />
              {isAr ? "المبيعات والإيرادات (الشهر الحالي)" : "Sales & Revenue (This Month)"}
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
                <div style={{ background: "var(--bg-card)", padding: "var(--space-4)", borderRadius: "var(--radius-md)" }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "4px" }}>{isAr ? "إجمالي الإيرادات" : "Total Revenue"}</p>
                    <h4 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--brand-primary)" }}>{formatCurrency(revenue.this_month)}</h4>
                </div>
                <div style={{ background: "var(--bg-card)", padding: "var(--space-4)", borderRadius: "var(--radius-md)" }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "4px" }}>{isAr ? "تم تحصيله" : "Collected"}</p>
                    <h4 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--success-main)" }}>{formatCurrency(revenue.collected)}</h4>
                </div>
            </div>

            <div style={{ height: "200px", width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: isAr ? 'مكتمل' : 'Completed', value: jobs.completed_this_month },
                  { name: isAr ? 'قيد التنفيذ' : 'In Progress', value: jobs.in_progress },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'var(--bg-card)' }}
                    contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)" }}
                  />
                  <Bar dataKey="value" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ─── ADDITIONAL MODULE BLOCKS ────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--space-6)" }}>
          
        {/* CUSTOMERS */}
        {customers && (
           <div style={{ background: "var(--bg-elevated)", padding: "var(--space-5)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)" }}>
             <h3 style={{ marginBottom: "var(--space-4)", fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
               <Users size={18} className="text-primary" /> {isAr ? "العملاء" : "Customers"}
             </h3>
             <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{isAr ? "إجمالي العملاء" : "Total Customers"}</span>
                  <span style={{ fontWeight: 600 }}>{customers.total}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{isAr ? "العملاء المحتملين (Leads)" : "Leads"}</span>
                  <span style={{ fontWeight: 600 }}>{customers.leads}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{isAr ? "عملاء جدد هذا الشهر" : "New This Month"}</span>
                  <span style={{ fontWeight: 600, color: "var(--success-main)" }}>+{customers.new_this_month}</span>
                </div>
             </div>
           </div>
        )}

        {/* DESIGNS */}
        {designs && (
           <div style={{ background: "var(--bg-elevated)", padding: "var(--space-5)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)" }}>
             <h3 style={{ marginBottom: "var(--space-4)", fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
               <PenTool size={18} className="text-primary" /> {isAr ? "التصميم" : "Design"}
             </h3>
             <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{isAr ? "بانتظار المراجعة" : "Pending Review"}</span>
                  <span style={{ fontWeight: 600, color: "var(--warning-main)" }}>{designs.pending_review}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{isAr ? "تلميحات تصميم جديدة" : "New Design Submissions"}</span>
                  <span style={{ fontWeight: 600 }}>{designs.this_month}</span>
                </div>
                {jobs_in_design !== undefined && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>{isAr ? "طلبات في مرحلة التصميم" : "Jobs in Design Status"}</span>
                    <span style={{ fontWeight: 600, color: "var(--brand-primary)" }}>{jobs_in_design}</span>
                  </div>
                )}
             </div>
           </div>
        )}

        {/* PRODUCTION */}
        {production && (
           <div style={{ background: "var(--bg-elevated)", padding: "var(--space-5)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)" }}>
             <h3 style={{ marginBottom: "var(--space-4)", fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
               <LayoutDashboard size={18} className="text-primary" /> {isAr ? "الإنتاج والتنفيذ" : "Production"}
             </h3>
             <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{isAr ? "طلبات قيد الإنتاج" : "Jobs In Production"}</span>
                  <span style={{ fontWeight: 600 }}>{production.jobs_in_production}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{isAr ? "مراحل نشطة حالياً" : "Active Stages"}</span>
                  <span style={{ fontWeight: 600, color: "var(--brand-primary)" }}>{production.active_stages}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{isAr ? "طلبات في التوصيل" : "Jobs in Delivery"}</span>
                  <span style={{ fontWeight: 600 }}>{production.jobs_in_delivery}</span>
                </div>
             </div>
           </div>
        )}

      </div>
    </div>
  );
}
