"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";
import {
  LayoutDashboard, Columns, Users, ShoppingBag, Palette,
  Factory, Package, BarChart3, Settings, ChevronLeft,
  ChevronRight, Bell, Globe, MonitorPlay
} from "lucide-react";

interface NavItem {
  label: string;
  labelAr: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  roles?: string[];
}

const NAV_SECTIONS: { title: string; titleAr: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    titleAr: "عام",
    items: [
      { label: "Dashboard", labelAr: "لوحة التحكم", href: "/", icon: <LayoutDashboard size={18} /> },
      { label: "My Workspace", labelAr: "تاسكاتي", href: "/my-workspace", icon: <Columns size={18} color="#8b5cf6" /> },
      { label: "Tasks & Boards", labelAr: "المهام واللوحات", href: "/tasks", icon: <Columns size={18} /> },
    ],
  },
  {
    title: "Business",
    titleAr: "الأعمال",
    items: [
      { label: "CRM", labelAr: "إدارة العملاء", href: "/crm", icon: <Users size={18} />, roles: ["admin", "manager", "sales"] },
      { label: "Sales & Jobs", labelAr: "المبيعات والطلبات", href: "/sales", icon: <ShoppingBag size={18} />, roles: ["admin", "manager", "sales"] },
    ],
  },
  {
    title: "Operations",
    titleAr: "العمليات",
    items: [
      { label: "Design", labelAr: "التصميم", href: "/design", icon: <Palette size={18} />, roles: ["admin", "manager", "designer"] },
      { label: "Production", labelAr: "الإنتاج", href: "/production", icon: <Factory size={18} />, roles: ["admin", "manager", "production"] },
      { label: "Inventory", labelAr: "المخزون", href: "/inventory", icon: <Package size={18} />, roles: ["admin", "manager", "production", "sales"] },
    ],
  },
  {
    title: "Insights",
    titleAr: "التحليلات",
    items: [
      { label: "Analytics", labelAr: "التحليلات", href: "/analytics", icon: <BarChart3 size={18} />, roles: ["admin", "manager"] },
    ],
  },
  {
    title: "Admin",
    titleAr: "الإدارة",
    items: [
      { label: "Users & Roles", labelAr: "المستخدمون والأدوار", href: "/settings/users", icon: <Settings size={18} />, roles: ["admin", "manager"] },
      { label: "Boards Monitor", labelAr: "مراقبة اللوحات", href: "/tasks/admin", icon: <MonitorPlay size={18} />, roles: ["admin", "manager"] },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, language } = useUIStore();
  const { user } = useAuthStore();
  const isAr = language === "ar";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside 
      className={`app-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}
      onClick={() => {
        if (sidebarCollapsed) toggleSidebar();
      }}
      style={{ cursor: sidebarCollapsed ? "pointer" : "default" }}
    >
      {/* Logo */}
      <div className="sidebar-logo" style={{ padding: sidebarCollapsed ? "var(--space-5) auto" : "var(--space-5) var(--space-5)", justifyContent: sidebarCollapsed ? "center" : "flex-start" }}>
        <div className="sidebar-logo-icon" style={{ margin: sidebarCollapsed ? "0 auto" : "0" }}>🖨️</div>
        {!sidebarCollapsed && (
          <>
            <div className="sidebar-logo-text">
              <h1>ProSticker</h1>
              <span>ERP Platform</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); toggleSidebar(); }}
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: "auto", padding: "4px" }}
              data-tooltip="Collapse sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => {
          const filteredItems = section.items.filter(
            (item) => !item.roles || (user && item.roles.includes(user.role))
          );
          if (!filteredItems.length) return null;

          return (
            <div key={section.title}>
              {!sidebarCollapsed && (
                <div className="sidebar-section-label">
                  {isAr ? section.titleAr : section.title}
                </div>
              )}
              {filteredItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${isActive(item.href) ? "active" : ""}`}
                  data-tooltip={sidebarCollapsed ? (isAr ? item.labelAr : item.label) : undefined}
                >
                  <span className="nav-item-icon">{item.icon}</span>
                  {!sidebarCollapsed && (
                    <span>{isAr ? item.labelAr : item.label}</span>
                  )}
                  {!sidebarCollapsed && item.badge ? (
                    <span className="nav-badge">{item.badge}</span>
                  ) : null}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>

      {/* User section */}
      {user && (
        <div style={{
          padding: "var(--space-3) var(--space-3)",
          borderTop: "1px solid var(--border-subtle)",
        }}>
          <Link href="/profile" style={{ textDecoration: 'none' }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              padding: "var(--space-2) var(--space-2)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              transition: "background var(--transition-fast)",
            }}
            className="hover:bg-hover"
            >
              <div
                className="avatar avatar-sm"
                style={{ background: "linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))" }}
              >
                {user.full_name_en.charAt(0)}
              </div>
              {!sidebarCollapsed && (
                <div style={{ overflow: "hidden", flex: 1 }}>
                  <div style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {user.full_name_en}
                  </div>
                  <div style={{
                    fontSize: "0.7rem",
                    color: "var(--text-muted)",
                    textTransform: "capitalize",
                  }}>
                    {user.role}
                  </div>
                </div>
              )}
            </div>
          </Link>
        </div>
      )}
    </aside>
  );
}
