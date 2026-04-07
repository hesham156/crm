"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { useUIStore } from "@/store/useUIStore";
import Cookies from "js-cookie";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, user, accessToken } = useAuthStore();
  const { connectWebSocket } = useNotificationStore();
  const { sidebarCollapsed } = useUIStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    // Connect WebSocket for notifications
    if (user && accessToken) {
      connectWebSocket(user.id, accessToken);
    }
    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [isAuthenticated, user, accessToken]);

  if (!isAuthenticated) return null;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
        <TopBar />
        <main className="app-content animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
