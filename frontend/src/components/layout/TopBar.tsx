"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { useUIStore } from "@/store/useUIStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useQuery } from "@tanstack/react-query";
import { notificationsApi, authApi } from "@/lib/api";
import {
  Bell, Search, Sun, Moon, Globe, LogOut,
  User, Settings, ChevronDown, Wifi, WifiOff
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { NotificationsPanel } from "./NotificationsPanel";

export default function TopBar() {
  const router = useRouter();
  const { user, logout, refreshToken } = useAuthStore();
  const { theme, toggleTheme, language, toggleLanguage } = useUIStore();
  const { unreadCount, isConnected } = useNotificationStore();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Don't close if clicking inside the panel
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {}
    logout();
    router.push("/login");
    toast.success("Signed out successfully");
  };

  const isAr = language === "ar";

  return (
    <header className="app-topbar">
      {/* Search */}
      <div className="search-input-wrapper">
        <Search size={16} className="search-icon" style={{ position: "absolute", left: "12px", color: "var(--text-muted)" }} />
        <input
          id="topbar-search"
          type="text"
          className="form-input search-input"
          placeholder={isAr ? "بحث..." : "Search anything..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ height: "36px" }}
        />
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* WS Status */}
      <div
        data-tooltip={isConnected ? "Realtime connected" : "Realtime disconnected"}
        style={{ color: isConnected ? "var(--color-success)" : "var(--text-muted)", display: "flex", alignItems: "center" }}
      >
        {isConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
      </div>

      {/* Theme toggle */}
      <button
        id="theme-toggle"
        className="btn btn-ghost btn-sm"
        onClick={toggleTheme}
        data-tooltip={theme === "dark" ? "Light mode" : "Dark mode"}
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Language toggle */}
      <button
        id="lang-toggle"
        className="btn btn-ghost btn-sm"
        onClick={toggleLanguage}
        data-tooltip="Toggle Arabic/English"
        style={{ fontWeight: 700, fontSize: "0.75rem" }}
      >
        <Globe size={16} />
        {isAr ? "EN" : "عR"}
      </button>

      {/* Notifications */}
      <div style={{ position: "relative" }} ref={notifRef}>
        <button
          id="notif-bell"
          className="btn btn-ghost btn-sm"
          onClick={() => setShowNotifications(!showNotifications)}
          style={{ position: "relative" }}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
          )}
        </button>

        {showNotifications && (
          <NotificationsPanel onClose={() => setShowNotifications(false)} />
        )}
      </div>

      {/* User menu */}
      <div style={{ position: "relative" }} ref={userRef}>
        <button
          id="user-menu"
          className="btn btn-ghost btn-sm"
          onClick={() => setShowUserMenu(!showUserMenu)}
          style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", height: "36px" }}
        >
          <div className="avatar avatar-sm">
            {user?.full_name_en?.charAt(0)}
          </div>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{user?.full_name_en}</span>
          <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
        </button>

        {showUserMenu && (
          <div className="dropdown" style={{ right: 0, top: "calc(100% + 8px)" }}>
            <div style={{
              padding: "var(--space-3) var(--space-4)",
              borderBottom: "1px solid var(--border-subtle)",
            }}>
              <p style={{ fontSize: "0.82rem", fontWeight: 700 }}>{user?.full_name_en}</p>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{user?.email}</p>
              <span className={`badge badge-orange`} style={{ marginTop: "4px", textTransform: "capitalize" }}>
                {user?.role}
              </span>
            </div>
            <Link href="/profile" className="dropdown-item">
              <User size={16} />
              {isAr ? "الملف الشخصي" : "Profile"}
            </Link>
            <Link href="/settings" className="dropdown-item">
              <Settings size={16} />
              {isAr ? "الإعدادات" : "Settings"}
            </Link>
            <div style={{ height: "1px", background: "var(--border-subtle)", margin: "var(--space-1) 0" }} />
            <button className="dropdown-item danger" onClick={handleLogout} style={{ width: "100%" }}>
              <LogOut size={16} />
              {isAr ? "تسجيل الخروج" : "Sign Out"}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
