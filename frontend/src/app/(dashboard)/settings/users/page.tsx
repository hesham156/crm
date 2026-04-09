"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Shield, Plus, Mail, Users, Edit, X, Save, Phone } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import toast from "react-hot-toast";

export default function UsersSettingsPage() {
  const { language } = useUIStore();
  const { user: currentUser } = useAuthStore();
  const isAr = language === "ar";
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await usersApi.list();
      return data.results || data;
    },
  });

  const { mutate: saveUser, isPending } = useMutation({
    mutationFn: async (data: any) => {
      if (editingUser) {
        await usersApi.update(editingUser.id, data);
      } else {
        await usersApi.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(isAr ? "تم حفظ المستخدم" : "User saved successfully");
      setShowModal(false);
      setEditingUser(null);
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data;
      if (errMsg && typeof errMsg === "object") {
        const firstKey = Object.keys(errMsg)[0];
        const errorText = Array.isArray(errMsg[firstKey]) ? errMsg[firstKey][0] : errMsg[firstKey];
        toast.error(`${firstKey}: ${errorText}`);
      } else {
        toast.error(isAr ? "حدث خطأ أثناء الحفظ" : "Error saving user");
      }
    }
  });

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setShowModal(true);
  };

  // Admin and Managers only
  if (currentUser?.role !== "admin" && currentUser?.role !== "manager") {
    return (
      <div className="card empty-state" style={{ height: "400px" }}>
        <Shield size={32} style={{ color: "var(--color-danger)" }} />
        <h3>{isAr ? "صلاحيات غير كافية" : "Access Denied"}</h3>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? "إدارة المستخدمين" : "Users Management"}</h1>
          <p className="page-subtitle">
            {isAr ? "إدارة الصلاحيات وحسابات الموظفين" : "Manage staff accounts and permissions"}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={16} />{isAr ? "مستخدم جديد" : "New User"}
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {isLoading ? (
          <div className="skeleton" style={{ height: "300px" }} />
        ) : users?.length === 0 ? (
          <div className="empty-state">
            <Users size={24} style={{ color: "var(--text-muted)" }} />
            <p>{isAr ? "لا يوجد مستخدمون" : "No users found"}</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>{isAr ? "المستخدم" : "User"}</th>
                  <th>{isAr ? "الدور / الصلاحية" : "Role"}</th>
                  <th>{isAr ? "القسم" : "Department"}</th>
                  <th>{isAr ? "تاريخ الانضمام" : "Joined Date"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users?.map((u: any) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                        <div className="avatar avatar-sm" style={{ background: "var(--brand-primary-light)", color: "var(--brand-primary)" }}>
                          {u.full_name_en.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{isAr ? u.full_name_ar || u.full_name_en : u.full_name_en}</div>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                            <Mail size={12} /> {u.email}
                          </div>
                          {u.phone && (
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                              <Phone size={11} /> {u.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        u.role === "admin" ? "badge-danger" : 
                        u.role === "manager" ? "badge-warning" : 
                        u.role === "sales" ? "badge-success" : 
                        u.role === "designer" ? "badge-purple" : 
                        u.role === "production" ? "badge-info" : "badge-gray"
                      }`}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {u.department_name ? (
                        <span style={{ color: "var(--text-secondary)" }}>{u.department_name}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td><span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>{u.date_joined && !isNaN(new Date(u.date_joined).getTime()) ? format(new Date(u.date_joined), "MMM d, yyyy") : "—"}</span></td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(u)}>
                        <Edit size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal animate-scale-in" style={{ maxWidth: "500px" }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingUser
                  ? (isAr ? "تعديل المستخدم" : "Edit User")
                  : (isAr ? "إضافة مستخدم جديد" : "Add New User")}
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowModal(false); setEditingUser(null); }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const data: Record<string, any> = {};
              fd.forEach((value, key) => {
                if (value !== "" && value !== undefined) {
                  data[key] = value;
                }
              });
              // Don't send password if editing and field is empty
              if (editingUser && !data.password) {
                delete data.password;
              }
              saveUser(data);
            }}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <div>
                  <label className="form-label">{isAr ? "الاسم الكامل (إنجليزي)" : "Full Name (En)"}</label>
                  <input type="text" name="full_name_en" className="form-input" required defaultValue={editingUser?.full_name_en || ""} />
                </div>
                <div>
                  <label className="form-label">{isAr ? "البريد الإلكتروني" : "Email"}</label>
                  <input type="email" name="email" className="form-input" required defaultValue={editingUser?.email || ""} />
                </div>
                <div>
                  <label className="form-label">
                    {editingUser
                      ? (isAr ? "كلمة المرور (اتركها فارغة لعدم التغيير)" : "Password (leave blank to keep)")
                      : (isAr ? "كلمة المرور" : "Password")}
                  </label>
                  <input type="password" name="password" className="form-input" {...(!editingUser ? { required: true } : {})} />
                </div>
                <div>
                  <label className="form-label">{isAr ? "رقم الهاتف (واتساب)" : "Phone (WhatsApp)"}</label>
                  <input type="tel" name="phone" className="form-input" placeholder="+966531549560" dir="ltr" defaultValue={editingUser?.phone || ""} />
                </div>
                <div>
                  <label className="form-label">{isAr ? "الدور" : "Role"}</label>
                  <select name="role" className="form-input" required defaultValue={editingUser?.role || "sales"}>
                    <option value="sales">Sales</option>
                    <option value="designer">Designer</option>
                    <option value="production">Production</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setEditingUser(null); }}>{isAr ? "إلغاء" : "Cancel"}</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  <Save size={18} /> {isAr ? "حفظ" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

