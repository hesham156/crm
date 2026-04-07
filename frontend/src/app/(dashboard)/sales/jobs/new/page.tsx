"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { salesApi, crmApi } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import { FileText, Save, Users, Calendar, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const jobSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  customer: z.string().uuid("Please select a customer"),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  deadline: z.string().optional(),
  description: z.string().optional(),
  client_requirements: z.string().optional(),
});

type JobFormValues = z.infer<typeof jobSchema>;

export default function NewJobPage() {
  const router = useRouter();
  const { language } = useUIStore();
  const isAr = language === "ar";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      priority: "normal",
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data } = await crmApi.customers();
      return data.results || data;
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: JobFormValues) => {
      const response = await salesApi.createJob(data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(isAr ? "تم إنشاء الطلب بنجاح!" : "Job created successfully!");
      router.push(`/sales/jobs/${data.id}`);
    },
    onError: () => {
      toast.error(isAr ? "حدث خطأ أثناء الإنشاء" : "Failed to create job");
    },
  });

  const onSubmit = (data: JobFormValues) => {
    mutate(data);
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <Link href="/sales/jobs" className="btn btn-ghost btn-sm" style={{ padding: "var(--space-2)" }}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            {isAr ? "إنشاء طلب جديد" : "Create New Job"}
          </h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            {isAr ? "إدخال تفاصيل طلب العميل لإنشاء عرض سعر" : "Enter client request details to generate a quote"}
          </p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          {/* Customer Selection */}
          <div>
            <label className="form-label">
              <Users size={16} /> {isAr ? "العميل" : "Customer"} *
            </label>
            <select
              className="form-input"
              {...register("customer")}
              defaultValue=""
            >
              <option value="" disabled>
                {isAr ? "اختر العميل..." : "Select Customer..."}
              </option>
              {customers?.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.company_name})
                </option>
              ))}
            </select>
            {errors.customer && <span className="form-error">{errors.customer.message}</span>}
            <div style={{ marginTop: "var(--space-2)", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              {isAr ? "هل العميل غير موجود؟" : "Customer not found?"}{" "}
              <Link href="/crm" style={{ color: "var(--brand-primary)" }}>
                {isAr ? "إضافة عميل جديد" : "Add new customer"}
              </Link>
            </div>
          </div>

          <div className="divider" />

          {/* Job Details */}
          <div>
            <label className="form-label">
              <FileText size={16} /> {isAr ? "عنوان الطلب" : "Job Title"} *
            </label>
            <input
              type="text"
              className="form-input"
              placeholder={isAr ? "مثال: طباعة 1000 كرت شخصي" : "e.g. Print 1000 Business Cards"}
              {...register("title")}
            />
            {errors.title && <span className="form-error">{errors.title.message}</span>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <div>
              <label className="form-label">
                <AlertCircle size={16} /> {isAr ? "الأولوية" : "Priority"}
              </label>
              <select className="form-input" {...register("priority")}>
                <option value="low">{isAr ? "منخفضة" : "Low"}</option>
                <option value="normal">{isAr ? "عادية" : "Normal"}</option>
                <option value="high">{isAr ? "عالية" : "High"}</option>
                <option value="urgent">{isAr ? "عاجلة جداً" : "Urgent"}</option>
              </select>
            </div>
            <div>
              <label className="form-label">
                <Calendar size={16} /> {isAr ? "تاريخ التسليم المتوقع" : "Expected Deadline"}
              </label>
              <input type="date" className="form-input" {...register("deadline")} />
            </div>
          </div>

          <div>
            <label className="form-label">{isAr ? "وصف الطلب الداخلي" : "Internal Description"}</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder={isAr ? "ملاحظات فريق المبيعات..." : "Sales team notes..."}
              {...register("description")}
            />
          </div>

          <div>
            <label className="form-label">{isAr ? "متطلبات العميل (ستظهر في عرض السعر)" : "Client Requirements (Visible on Quote)"}</label>
            <textarea
              className="form-input"
              rows={4}
              placeholder={isAr ? "تفاصيل المواصفات..." : "Specification details..."}
              {...register("client_requirements")}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
            <Link href="/sales/jobs" className="btn btn-secondary">
              {isAr ? "إلغاء" : "Cancel"}
            </Link>
            <button type="submit" className="btn btn-primary" disabled={isPending}>
              <Save size={18} />
              {isPending ? (isAr ? "جاري الإنشاء..." : "Creating...") : (isAr ? "حفظ ومتابعة" : "Save & Continue")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
