"use client";
import { useState } from "react";
import { Users, Plus, Search, Phone, Mail, Building2, X, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { crmApi } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import toast from "react-hot-toast";
import Link from "next/link";

const STAGE_COLORS: Record<string, string> = {
  new: "var(--text-muted)",
  contacted: "var(--color-info)",
  proposal: "var(--color-warning)",
  negotiation: "var(--brand-primary)",
  won: "var(--color-success)",
  lost: "var(--color-danger)",
};

export default function CRMPage() {
  const qc = useQueryClient();
  const { language } = useUIStore();
  const isAr = language === "ar";
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data } = await crmApi.customers();
      return data.results || data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => crmApi.createCustomer(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(isAr ? "تمت إضافة العميل!" : "Customer added!");
      setIsModalOpen(false);
      reset();
    },
    onError: () => {
      toast.error(isAr ? "حدث خطأ أثناء الإضافة" : "Failed to add customer");
    }
  });

  const onSubmit = (data: any) => {
    createMutation.mutate(data);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? "إدارة العملاء" : "CRM"}</h1>
          <p className="page-subtitle">{isAr ? "العملاء والعملاء المحتملون" : "Customers, leads and deals"}</p>
        </div>
        <button id="new-customer-btn" className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />{isAr ? "عميل جديد" : "New Customer"}
        </button>
      </div>

      {isLoading ? (
        <div className="skeleton" style={{ height: "400px", borderRadius: "var(--radius-lg)" }} />
      ) : customers.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon"><Users size={24} /></div>
          <h3>{isAr ? "لا عملاء بعد" : "No customers yet"}</h3>
          <p>{isAr ? "أضف أول عميل للبدء" : "Add your first customer to get started"}</p>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} />{isAr ? "إضافة عميل" : "Add Customer"}
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? "الاسم" : "Name"}</th>
                <th>{isAr ? "الشركة" : "Company"}</th>
                <th>{isAr ? "البريد الإلكتروني" : "Email"}</th>
                <th>{isAr ? "الهاتف" : "Phone"}</th>
                <th>{isAr ? "النوع" : "Type"}</th>
                <th>{isAr ? "المرحلة" : "Stage"}</th>
                <th>{isAr ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c: {id: string; name: string; company: string; email: string; phone: string; type: string; stage: string}) => (
                <tr key={c.id}>
                  <td><span style={{ fontWeight: 600 }}>{c.name}</span></td>
                  <td><span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-secondary)" }}><Building2 size={14} />{c.company || "—"}</span></td>
                  <td><span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-secondary)" }}><Mail size={14} />{c.email || "—"}</span></td>
                  <td><span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Phone size={14} />{c.phone || "—"}</span></td>
                  <td><span className={`badge ${c.type === "customer" ? "badge-success" : c.type === "prospect" ? "badge-warning" : "badge-gray"}`}>{c.type}</span></td>
                  <td><span className="badge" style={{ background: `${STAGE_COLORS[c.stage]}18`, color: STAGE_COLORS[c.stage] }}>{c.stage}</span></td>
                  <td><button className="btn btn-ghost btn-sm">Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Customer Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="modal modal-md">
            <div className="modal-header">
              <h3 className="modal-title">{isAr ? "إضافة عميل جديد" : "Add New Customer"}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                  <div className="form-group">
                    <label className="form-label">{isAr ? "اسم العميل / المؤسسة *" : "Customer Name *"}</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      {...register("name", { required: true })} 
                      autoFocus
                    />
                    {errors.name && <span className="form-error">Required</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">{isAr ? "الشركة" : "Company"}</label>
                    <input type="text" className="form-input" {...register("company")} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                  <div className="form-group">
                    <label className="form-label">{isAr ? "البريد الإلكتروني" : "Email"}</label>
                    <input type="email" className="form-input" {...register("email")} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{isAr ? "الهاتف" : "Phone"}</label>
                    <input type="tel" className="form-input" {...register("phone")} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                  <div className="form-group">
                    <label className="form-label">{isAr ? "النوع" : "Type"}</label>
                    <select className="form-input form-select" {...register("type")}>
                      <option value="lead">Lead</option>
                      <option value="prospect">Prospect</option>
                      <option value="customer">Customer</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{isAr ? "المرحلة" : "Stage"}</label>
                    <select className="form-input form-select" {...register("stage")}>
                      {Object.keys(STAGE_COLORS).map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : (isAr ? "إضافة" : "Add Customer")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
