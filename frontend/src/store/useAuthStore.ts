import { create } from "zustand";
import { persist } from "zustand/middleware";
import Cookies from "js-cookie";

export type UserRole = "admin" | "manager" | "sales" | "designer" | "production";

export interface User {
  id: string;
  email: string;
  full_name_en: string;
  full_name_ar: string;
  role: UserRole;
  department: string | null;
  department_name: string | null;
  avatar: string | null;
  avatar_url: string | null;
  phone: string;
  language: "en" | "ar";
  is_active: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, access: string, refresh: string) => void;
  updateUser: (user: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, access, refresh) => {
        Cookies.set("access_token", access, { expires: 1, sameSite: "Lax" });
        Cookies.set("refresh_token", refresh, { expires: 7, sameSite: "Lax" });
        set({ user, accessToken: access, refreshToken: refresh, isAuthenticated: true });
      },

      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),

      logout: () => {
        Cookies.remove("access_token");
        Cookies.remove("refresh_token");
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    {
      name: "prosticker-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
