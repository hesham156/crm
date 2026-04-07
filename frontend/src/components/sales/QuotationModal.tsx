"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { X, Plus, Trash2, Save } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { salesApi } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import toast from "react-hot-toast";

const quotationSchema = z.object({
  notes: z.string().optional(),
  tax_percent: z.number().min(0).max(100),
  discount: z.number().min(0),
  items: z.array(
    z.object({
      description: z.string().min(2, "Description is required"),
      quantity: z.number().min(0.01),
      unit_price: z.number().min(0),
    })
  ).min(1, "At least one item is required"),
});

type QuotationFormValues = z.infer<typeof quotationSchema>;

interface QuotationModalProps {
  jobId: string;
  onClose: () => void;
}

export default function QuotationModal({ jobId, onClose }: QuotationModalProps) {
  const { language } = useUIStore();
  const isAr = language === "ar";
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      tax_percent: 15,
      discount: 0,
      items: [{ description: "", quantity: 1, unit_price: 0 }],
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    name: "items",
    control,
  });

  const watchItems = watch("items");
  const watchTax = watch("tax_percent");
  const watchDiscount = watch("discount");

  const subtotal = watchItems.reduce((acc, current) => acc + (current.quantity || 0) * (current.unit_price || 0), 0);
  const total = subtotal + (subtotal * (watchTax || 0) / 100) - (watchDiscount || 0);

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: QuotationFormValues) => {
      const payload = {
        ...data,
        subtotal,
        total: Math.max(0, total),
      };
      const response = await salesApi.createQuotation(jobId, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId, "quotations"] });
      toast.success(isAr ? "تم إنشاء عرض السعر" : "Quotation created successfully");
      onClose();
    },
    onError: () => {
      toast.error(isAr ? "حدث خطأ أثناء الإنشاء" : "Failed to create quotation");
    },
  });

  const onSubmit = (data: QuotationFormValues) => {
    mutate(data);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal animate-scale-in" style={{ maxWidth: "800px" }}>
        <div className="modal-header">
          <h2 className="modal-title">{isAr ? "إنشاء عرض سعر" : "Create Quotation"}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            
            {/* Items Table */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
                <h3 style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>{isAr ? "عناصر العرض" : "Items"}</h3>
              </div>
              <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                <table className="table" style={{ margin: 0 }}>
                  <thead style={{ background: "var(--bg-card)" }}>
                    <tr>
                      <th style={{ width: "50%" }}>{isAr ? "الوصف" : "Description"}</th>
                      <th style={{ width: "15%" }}>{isAr ? "الكمية" : "Qty"}</th>
                      <th style={{ width: "20%" }}>{isAr ? "سعر الوحدة" : "Unit Price"}</th>
                      <th style={{ width: "15%", textAlign: "right" }}>{isAr ? "الإجمالي" : "Total"}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const qty = watchItems[index]?.quantity || 0;
                      const price = watchItems[index]?.unit_price || 0;
                      
                      return (
                        <tr key={field.id}>
                          <td style={{ padding: "8px" }}>
                            <input
                              className="form-input"
                              placeholder={isAr ? "وصف العنصر..." : "Item description..."}
                              {...register(`items.${index}.description`)}
                            />
                            {errors.items?.[index]?.description && (
                              <span className="form-error" style={{ fontSize: "0.7rem" }}>
                                {errors.items[index]?.description?.message}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "8px" }}>
                            <input
                              type="number"
                              step="0.01"
                              className="form-input"
                              {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                            />
                          </td>
                          <td style={{ padding: "8px" }}>
                            <input
                              type="number"
                              step="0.01"
                              className="form-input"
                              {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                            />
                          </td>
                          <td style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>
                            SAR {(qty * price).toFixed(2)}
                          </td>
                          <td style={{ padding: "8px" }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => remove(index)}
                              style={{ color: "var(--color-danger)" }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => append({ description: "", quantity: 1, unit_price: 0 })}
                style={{ marginTop: "var(--space-3)" }}
              >
                <Plus size={14} /> {isAr ? "إضافة عنصر" : "Add Item"}
              </button>
              {errors.items && !Array.isArray(errors.items) && (
                <div className="form-error" style={{ marginTop: "4px" }}>{errors.items.message}</div>
              )}
            </div>

            <div className="divider" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "var(--space-6)" }}>
              <div>
                <label className="form-label">{isAr ? "ملاحظات إضافية" : "Additional Notes"}</label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder={isAr ? "شروط الدفع، تفاصيل التسليم..." : "Payment terms, delivery details..."}
                  {...register("notes")}
                />
              </div>

              {/* Totals */}
              <div style={{ background: "var(--bg-elevated)", padding: "var(--space-4)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{isAr ? "المجموع الفرعي" : "Subtotal"}</span>
                  <span style={{ fontWeight: 600 }}>SAR {subtotal.toFixed(2)}</span>
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {isAr ? "الضريبة (%)" : "Tax (%)"}
                  </span>
                  <input
                    type="number"
                    style={{ width: "80px", textAlign: "right" }}
                    className="form-input form-input-sm"
                    {...register("tax_percent", { valueAsNumber: true })}
                  />
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {isAr ? "خصم (مبلغ)" : "Discount (Amt)"}
                  </span>
                  <input
                    type="number"
                    style={{ width: "80px", textAlign: "right" }}
                    className="form-input form-input-sm"
                    {...register("discount", { valueAsNumber: true })}
                  />
                </div>

                <div className="divider" style={{ margin: "var(--space-3) 0" }} />
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>{isAr ? "الإجمالي" : "Total"}</span>
                  <span style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--brand-primary)" }}>
                    SAR {Math.max(0, total).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isPending}>
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button type="submit" className="btn btn-primary" disabled={isPending}>
              <Save size={18} />
              {isPending ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "إنشاء عرض السعر" : "Create Quote")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
