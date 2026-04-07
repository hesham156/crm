import { create } from "zustand";

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  is_read: boolean;
  sender_name?: string;
  created_at: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  ws: WebSocket | null;
  setNotifications: (notifications: Notification[]) => void;
  setUnreadCount: (count: number) => void;
  addNotification: (notification: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  connectWebSocket: (userId: string, token: string) => void;
  disconnectWebSocket: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isConnected: false,
  ws: null,

  setNotifications: (notifications) =>
    set({ notifications, unreadCount: notifications.filter((n) => !n.is_read).length }),

  setUnreadCount: (count) => set({ unreadCount: count }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    })),

  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    })),

  connectWebSocket: (userId, token) => {
    const { ws } = get();
    if (ws) ws.close();

    const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
    const socket = new WebSocket(
      `${WS_BASE}/ws/notifications/${userId}/?token=${token}`
    );

    socket.onopen = () => {
      set({ isConnected: true, ws: socket });
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "connected") {
        set({ unreadCount: data.unread_count });
      } else if (data.type === "notification") {
        get().addNotification(data.notification);
        // Browser notification
        if (Notification.permission === "granted") {
          new Notification(data.notification.title, {
            body: data.notification.body,
            icon: "/favicon.ico",
          });
        }
      }
    };

    socket.onclose = () => set({ isConnected: false, ws: null });
    socket.onerror = () => set({ isConnected: false });
  },

  disconnectWebSocket: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
      set({ ws: null, isConnected: false });
    }
  },
}));
