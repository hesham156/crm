"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";
import { User, Lock, Palette, Save, Moon, Sun, Globe, Phone } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

export default function ProfilePage() {
  const { language, setLanguage, theme, toggleTheme } = useUIStore();
  const { user, updateUser } = useAuthStore();
  const isAr = language === "ar";
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"info" | "security" | "preferences">("info");

  const [name, setName] = useState(user?.full_name_en || "");
  const [phone, setPhone] = useState(user?.phone || "");

  const { mutate: updateProfile, isPending: isUpdatingInfo } = useMutation({
    mutationFn: async () => {
      const { data } = await authApi.updateMe({ full_name_en: name, phone });
      return data;
    },
    onSuccess: (data) => {
      updateUser(data);
      toast.success(isAr ? "تم تحديث الملف الشخصي" : "Profile updated");
    },
    onError: () => {
      toast.error(isAr ? "فشل تحديث الملف الشخصي" : "Failed to update profile");
    }
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? "الملف الشخصي والإعدادات" : "Profile & Settings"}</h1>
          <p className="page-subtitle">
            {isAr ? "تخصيص الواجهة وإدارة حسابك" : "Customize interface and manage your account"}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: "var(--space-6)" }}>
        {/* Sidebar Nav */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <button 
            className={`btn ${activeTab === "info" ? "btn-primary" : "btn-ghost"}`} 
            style={{ justifyContent: "flex-start", padding: "var(--space-3)" }}
            onClick={() => setActiveTab("info")}
          >
            <User size={18} /> {isAr ? "المعلومات الشخصية" : "Personal Info"}
          </button>
          <button 
            className={`btn ${activeTab === "preferences" ? "btn-primary" : "btn-ghost"}`} 
            style={{ justifyContent: "flex-start", padding: "var(--space-3)" }}
            onClick={() => setActiveTab("preferences")}
          >
            <Palette size={18} /> {isAr ? "تخصيص الواجهة" : "Interface Preferences"}
          </button>
          <button 
            className={`btn ${activeTab === "security" ? "btn-primary" : "btn-ghost"}`} 
            style={{ justifyContent: "flex-start", padding: "var(--space-3)" }}
            onClick={() => setActiveTab("security")}
          >
            <Lock size={18} /> {isAr ? "الأمان وكلمة المرور" : "Security & Password"}
          </button>
        </div>

        {/* Content Area */}
        <div className="card" style={{ minHeight: "400px" }}>
          {activeTab === "info" && (
            <div>
              <h2 style={{ fontSize: "1.2rem", marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "8px" }}>
                <User size={20} /> {isAr ? "المعلومات الشخصية" : "Personal Information"}
              </h2>
              <form onSubmit={(e) => { e.preventDefault(); updateProfile(); }} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", maxWidth: "500px" }}>
                <div>
                  <label className="form-label">{isAr ? "الاسم" : "Name"}</label>
                  <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">{isAr ? "البريد الإلكتروني" : "Email"}</label>
                  <input type="email" className="form-input" defaultValue={user?.email} disabled />
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    {isAr ? "لا يمكنك تغيير البريد الإلكتروني" : "You cannot change your email address"}
                  </p>
                </div>
                <div>
                  <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Phone size={14} /> {isAr ? "رقم الهاتف (واتساب)" : "Phone (WhatsApp)"}
                  </label>
                  <input type="tel" className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+966531549560" dir="ltr" />
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    {isAr ? "سيتم إرسال إشعارات العمل على هذا الرقم" : "Work notifications will be sent to this number"}
                  </p>
                </div>
                <div>
                  <label className="form-label">{isAr ? "الدور / الصلاحية" : "Role"}</label>
                  <input type="text" className="form-input" defaultValue={user?.role} disabled style={{ textTransform: "uppercase" }} />
                </div>
                <div style={{ marginTop: "var(--space-2)" }}>
                  <button type="submit" className="btn btn-primary" disabled={isUpdatingInfo}>
                    <Save size={16} /> {isAr ? "حفظ التغييرات" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === "preferences" && (
            <div>
              <h2 style={{ fontSize: "1.2rem", marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Palette size={20} /> {isAr ? "تخصيص الواجهة" : "Interface Customization"}
              </h2>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: "500px" }}>
                {/* Theme Toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-4)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "1rem" }}>{isAr ? "المظهر" : "Theme"}</h3>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      {isAr ? "تغيير ألوان الواجهة بين الوضع الفاتح والداكن" : "Toggle between light and dark mode"}
                    </p>
                  </div>
                  <button className="btn btn-secondary" onClick={toggleTheme}>
                    {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
                    {theme === "light" ? (isAr ? "الوضع الداكن" : "Dark Mode") : (isAr ? "الوضع الفاتح" : "Light Mode")}
                  </button>
                </div>

                {/* Language Toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-4)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "1rem" }}>{isAr ? "اللغة" : "Language"}</h3>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      {isAr ? "اختر لغة العرض المفضلة لك" : "Choose your preferred display language"}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    <button 
                      className={`btn btn-sm ${language === "en" ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => setLanguage("en")}
                    >
                      English
                    </button>
                    <button 
                      className={`btn btn-sm ${language === "ar" ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => setLanguage("ar")}
                    >
                      العربية
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div>
              <h2 style={{ fontSize: "1.2rem", marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Lock size={20} /> {isAr ? "تغيير كلمة المرور" : "Change Password"}
              </h2>
              <form onSubmit={(e) => { 
                e.preventDefault(); 
                toast.error(isAr ? "هذه الميزة ستتوفر قريباً" : "Feature coming soon"); 
              }} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", maxWidth: "400px" }}>
                <div>
                  <label className="form-label">{isAr ? "كلمة المرور الحالية" : "Current Password"}</label>
                  <input type="password" required className="form-input" />
                </div>
                <div>
                  <label className="form-label">{isAr ? "كلمة المرور الجديدة" : "New Password"}</label>
                  <input type="password" required className="form-input" />
                </div>
                <div>
                  <label className="form-label">{isAr ? "تأكيد كلمة المرور" : "Confirm Password"}</label>
                  <input type="password" required className="form-input" />
                </div>
                <div style={{ marginTop: "var(--space-2)" }}>
                  <button type="submit" className="btn btn-danger">
                    <Lock size={16} /> {isAr ? "تحديث التشفير" : "Update Password"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
