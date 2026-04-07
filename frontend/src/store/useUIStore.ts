import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "dark" | "light";
type Language = "en" | "ar";

interface UIStore {
  theme: Theme;
  language: Language;
  sidebarCollapsed: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      theme: "dark",
      language: "en",
      sidebarCollapsed: false,

      setTheme: (theme) => {
        set({ theme });
        document.documentElement.setAttribute("data-theme", theme);
      },

      toggleTheme: () => {
        const newTheme = get().theme === "dark" ? "light" : "dark";
        set({ theme: newTheme });
        document.documentElement.setAttribute("data-theme", newTheme);
      },

      setLanguage: (language) => {
        set({ language });
        document.documentElement.setAttribute("lang", language);
        document.documentElement.setAttribute("dir", language === "ar" ? "rtl" : "ltr");
      },

      toggleLanguage: () => {
        const newLang = get().language === "en" ? "ar" : "en";
        set({ language: newLang });
        document.documentElement.setAttribute("lang", newLang);
        document.documentElement.setAttribute("dir", newLang === "ar" ? "rtl" : "ltr");
      },

      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    { name: "prosticker-ui" }
  )
);
