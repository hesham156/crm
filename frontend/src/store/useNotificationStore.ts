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
  _retryTimeout: ReturnType<typeof setTimeout> | null;
  _retryDelay: number;
  _userId: string | null;
  _token: string | null;
  setNotifications: (notifications: Notification[]) => void;
  setUnreadCount: (count: number) => void;
  addNotification: (notification: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  connectWebSocket: (userId: string, token: string) => void;
  disconnectWebSocket: () => void;
  requestNotificationPermission: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isConnected: false,
  ws: null,
  _retryTimeout: null,
  _retryDelay: 1000,
  _userId: null,
  _token: null,

  setNotifications: (notifications) =>
    set({ notifications, unreadCount: notifications.filter((n) => !n.is_read).length }),

  setUnreadCount: (count) => set({ unreadCount: count }),

  addNotification: (notification) =>
    set((state) => {
      // Deduplicate — ignore if same id already present
      if (state.notifications.some((n) => n.id === notification.id)) return state;
      return {
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      };
    }),

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

  requestNotificationPermission: () => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  },

  connectWebSocket: (userId, token) => {
    const state = get();

    // Cancel any pending reconnect
    if (state._retryTimeout) clearTimeout(state._retryTimeout);

    // Close existing connection
    if (state.ws) state.ws.close();

    set({ _userId: userId, _token: token });

    const WS_BASE = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000").replace(/\/$/, "");
    const socket = new WebSocket(`${WS_BASE}/ws/notifications/${userId}/?token=${token}`);

    socket.onopen = () => {
      set({ isConnected: true, ws: socket, _retryDelay: 1000 });
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "connected") {
        set({ unreadCount: data.unread_count });
      } else if (data.type === "notification") {
        get().addNotification(data.notification);
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          new Notification(data.notification.title, {
            body: data.notification.body,
            icon: "/favicon.ico",
          });
        }
      }
    };

    socket.onclose = () => {
      set({ isConnected: false, ws: null });
      const { _userId, _token, _retryDelay } = get();
      if (_userId && _token) {
        const nextDelay = Math.min(_retryDelay * 2, 30000); // cap at 30s
        const timeout = setTimeout(() => {
          get().connectWebSocket(_userId, _token);
        }, _retryDelay);
        set({ _retryTimeout: timeout, _retryDelay: nextDelay });
      }
    };

    socket.onerror = () => set({ isConnected: false });
  },

  disconnectWebSocket: () => {
    const { ws, _retryTimeout } = get();
    if (_retryTimeout) clearTimeout(_retryTimeout);
    if (ws) ws.close();
    set({ ws: null, isConnected: false, _userId: null, _token: null, _retryTimeout: null, _retryDelay: 1000 });
  },
}));
