"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useUIStore } from "@/store/useUIStore";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { X, Settings, MoreHorizontal, Search, Bell, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface NotificationsPanelProps {
  onClose: () => void;
}

export function NotificationsPanel({ onClose }: NotificationsPanelProps) {
  const { user } = useAuthStore();
  const { language } = useUIStore();
  const isAr = language === "ar";
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"all" | "mentioned" | "assigned">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const { data: notifications = [], refetch } = useQuery({
    queryKey: ["notifications", activeTab, debouncedSearch, unreadOnly],
    queryFn: async () => {
      const params: any = {};
      if (activeTab !== "all") params.tab = activeTab;
      if (debouncedSearch) params.search = debouncedSearch;
      if (unreadOnly) params.unread_only = "true";

      const { data } = await notificationsApi.list(params);
      return data.results || data;
    },
    refetchInterval: 30000,
  });

  const markAllRead = async () => {
    await notificationsApi.markRead();
    refetch();
  };

  const markAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await notificationsApi.markRead([id]);
    refetch();
  };

  const getDayGroup = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return isAr ? "اليوم" : "Today";
    if (isYesterday(date)) return isAr ? "الأمس" : "Yesterday";
    return isAr ? "أقدم" : "Older";
  };

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    notifications.forEach((n: any) => {
      const g = getDayGroup(n.created_at);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(n);
    });
    return map;
  }, [notifications, isAr]);

  return (
    <div
      className="notifications-panel"
      style={{
        position: "absolute",
        top: "40px",
        right: isAr ? "auto" : "0",
        left: isAr ? "0" : "auto",
        width: "420px",
        height: "calc(100vh - 64px)",
        maxHeight: "800px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
        borderRadius: "var(--radius-md)",
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "var(--space-4)", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)" }}>
        <h2 style={{ fontSize: "1.25rem", margin: 0, fontWeight: "600", color: "var(--text-primary)" }}>
          {isAr ? "الإشعارات" : "Notifications"}
        </h2>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button className="btn btn-ghost btn-icon" title={isAr ? "الإعدادات" : "Settings"}><Settings size={18} /></button>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "var(--space-4)", padding: "0 var(--space-4)", borderBottom: "1px solid var(--border-subtle)" }}>
        {(["all", "mentioned", "assigned"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "var(--space-3) 0",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid var(--brand-primary)" : "2px solid transparent",
              color: activeTab === tab ? "var(--text-primary)" : "var(--text-muted)",
              fontWeight: activeTab === tab ? 600 : 500,
              fontSize: "0.9rem",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
            }}
          >
            {tab === "all" ? (isAr ? "الكل" : "All") : tab === "mentioned" ? (isAr ? "الإشارات" : "Mentioned") : (isAr ? "المُسندة" : "Assigned to me")}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div style={{ padding: "var(--space-3) var(--space-4)", display: "flex", gap: "var(--space-3)", alignItems: "center", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? "ابحث عن إشعار..." : "Search notifications..."}
            style={{
              width: "100%",
              padding: "6px 12px 6px 32px",
              background: "var(--bg-inset)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "4px",
              color: "var(--text-primary)",
              fontSize: "0.85rem",
              outline: "none",
            }}
          />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "var(--text-secondary)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            style={{ accentColor: "var(--brand-primary)", width: "16px", height: "16px", cursor: "pointer" }}
          />
          {isAr ? "غير مقروء" : "Unread only"}
        </label>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-2) 0" }}>
        {notifications.length === 0 ? (
          <div style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--text-muted)" }}>
            <Bell size={32} style={{ margin: "0 auto var(--space-3)", opacity: 0.5 }} />
            <p>{isAr ? "لا توجد إشعارات" : "No notifications found."}</p>
          </div>
        ) : (
          Array.from(grouped).map(([group, notifs]) => (
            <div key={group}>
              <div style={{ padding: "var(--space-2) var(--space-4)", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)", background: "var(--bg-base)" }}>
                {group}
              </div>
              {notifs.map((n: any) => {
                const isUUID = n.link && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(n.link);
                const badgeText = isUUID ? (n.type === "mention" ? "Task" : "Item") : n.link || "Notification";
                
                return (
                  <div
                    key={n.id}
                    onClick={async (e) => {
                      if (!n.is_read) {
                        await markAsRead(n.id, e);
                      }
                      if (n.link && n.link.startsWith("/")) {
                        router.push(n.link);
                        onClose();
                      } else if (n.type === "mention") {
                        onClose();
                      }
                    }}
                    style={{
                      padding: "var(--space-3) var(--space-4)",
                      background: n.is_read ? "transparent" : "rgba(249,115,22,0.05)",
                      borderBottom: "1px solid var(--border-subtle)",
                      display: "flex",
                      gap: "var(--space-3)",
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    <div className="avatar" style={{ width: "32px", height: "32px", fontSize: "0.9rem", flexShrink: 0, background: "var(--brand-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }}>
                      {n.sender_name ? n.sender_name.charAt(0).toUpperCase() : "-"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: "24px" }}>
                      <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: "1.4", color: "var(--text-primary)" }}>
                        <span style={{ fontWeight: 600 }}>{n.sender_name || "System"}</span> {n.title}
                      </p>
                      {n.body && (
                        <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {n.body}
                        </p>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: "6px" }}>
                        {n.link && (
                          <span style={{ fontSize: "0.75rem", color: "var(--brand-primary)", background: "rgba(249,115,22,0.1)", padding: "2px 6px", borderRadius: "4px", display: "inline-flex", alignItems: "center" }}>
                            {badgeText}
                          </span>
                        )}
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </span>
                      </div>
                  </div>
                  {!n.is_read && (
                    <div
                      title="Mark as read"
                      onClick={(e) => markAsRead(n.id, e)}
                      style={{
                        position: "absolute",
                        right: "16px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        background: "var(--brand-primary)",
                        cursor: "pointer",
                      }}
                    />
                  )}
                </div>
                );
              })}
            </div>
          ))
        )}
      </div>

    </div>
  );
}
