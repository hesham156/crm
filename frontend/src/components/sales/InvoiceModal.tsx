"use client";

import { useForm } from "react-hook-form";
import { X, Save, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { salesApi } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import toast from "react-hot-toast";

interface InvoiceModalProps {
  jobId: string;
  defaultAmount: number;
  onClose: () => void;
}

export default function InvoiceModal({ jobId, defaultAmount, onClose }: InvoiceModalProps) {
  const { language } = useUIStore();
  const isAr = language === "ar";
  const queryClient = useQueryClient();

  const { register, handleSubmit, watch } = useForm({
    defaultValues: {
      total_amount: defaultAmount,
      paid_amount: 0,
      payment_status: "unpaid",
      due_date: "",
      notes: "",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        job: jobId,
      };
      // Auto adjust payment status if paid amount is full
      if (payload.paid_amount >= payload.total_amount && payload.total_amount > 0) {
          payload.payment_status = "paid";
      } else if (payload.paid_amount > 0 && payload.paid_amount < payload.total_amount) {
          payload.payment_status = "partial";
      }
      const response = await salesApi.createInvoice(payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId, "invoices"] });
      toast.success(isAr ? "تم إنشاء الفاتورة بنجاح" : "Invoice created successfully");
      onClose();
    },
    onError: () => {
      toast.error(isAr ? "فشل في إنشاء الفاتورة" : "Failed to create invoice");
    },
  });

  const onSubmit = (data: any) => mutate(data);

  return (
    <div className="modal-backdrop">
      <div className="modal animate-scale-in" style={{ maxWidth: "500px" }}>
        <div className="modal-header">
          <h2 className="modal-title">{isAr ? "إنشاء فاتورة جديدة" : "Create New Invoice"}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                <div>
                    <label className="form-label">{isAr ? "إجمالي المبلغ" : "Total Amount"} *</label>
                    <input 
                        type="number" 
                        step="0.01"
                        className="form-input" 
                        {...register("total_amount", { valueAsNumber: true, required: true })}
                    />
                </div>
                <div>
                    <label className="form-label">{isAr ? "المبلغ المدفوع" : "Paid Amount"}</label>
                    <input 
                        type="number" 
                        step="0.01"
                        className="form-input" 
                        {...register("paid_amount", { valueAsNumber: true })}
                    />
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                <div>
                    <label className="form-label">{isAr ? "حالة الدفع" : "Payment Status"}</label>
                    <select className="form-input form-select" {...register("payment_status")}>
                        <option value="unpaid">{isAr ? "غير مدفوع" : "Unpaid"}</option>
                        <option value="partial">{isAr ? "مدفوع جزئياً" : "Partial"}</option>
                        <option value="paid">{isAr ? "مدفوع بالكامل" : "Paid"}</option>
                    </select>
                </div>
                <div>
                    <label className="form-label">{isAr ? "تاريخ الاستحقاق (اختياري)" : "Due Date"}</label>
                    <input type="date" className="form-input" {...register("due_date")} />
                </div>
            </div>

            <div>
                <label className="form-label">{isAr ? "ملاحظات الفاتورة" : "Invoice Notes"}</label>
                <textarea 
                    className="form-input" 
                    rows={3} 
                    {...register("notes")}
                    placeholder={isAr ? "طريقة الدفع، تفاصيل بنكية..." : "Payment method, bank details..."}
                />
            </div>

          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isPending}>
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button type="submit" className="btn btn-primary" disabled={isPending}>
              <Save size={18} />
              {isPending ? <Loader2 className="animate-spin" size={16} /> : (isAr ? "تأكيد وإنشاء" : "Create Invoice")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
