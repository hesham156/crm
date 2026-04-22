"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import { useState } from "react";
import { PackageOpen, AlertTriangle, Plus, ArrowDownRight, ArrowUpRight, Search, X, Check } from "lucide-react";
import toast from "react-hot-toast";

export default function InventoryPage() {
  const { language } = useUIStore();
  const isAr = language === "ar";
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"items" | "low_stock">("items");
  const [showItemModal, setShowItemModal] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [txType, setTxType] = useState<"addition" | "deduction">("addition");

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["inventory_items"],
    queryFn: async () => {
      const { data } = await inventoryApi.items();
      return data.results || data;
    },
  });

  const { data: lowStockItems } = useQuery({
    queryKey: ["inventory_low_stock"],
    queryFn: async () => {
      const { data } = await inventoryApi.lowStock();
      return data.results || data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["inventory_categories"],
    queryFn: async () => {
      const { data } = await inventoryApi.categories();
      return data.results || data;
    },
  });

  const { mutate: createItem, isPending: isCreatingItem } = useMutation({
    mutationFn: async (data: any) => inventoryApi.createItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      toast.success(isAr ? "تم حفظ العنصر" : "Item saved");
      setShowItemModal(false);
    },
    onError: () => toast.error(isAr ? "خطأ في الحفظ" : "Error saving item"),
  });

  const { mutate: createTx, isPending: isCreatingTx } = useMutation({
    mutationFn: async (data: any) => inventoryApi.createTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_low_stock"] });
      toast.success(isAr ? "تم تسجيل الحركة" : "Transaction recorded");
      setShowTxModal(false);
    },
    onError: () => toast.error(isAr ? "خطأ في التسجيل" : "Error recording transaction"),
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? "إدارة المخزون" : "Inventory"}</h1>
          <p className="page-subtitle">
            {isAr ? "تتبع الورق، الأحبار، ومواد التغليف" : "Track paper, ink, and packaging materials"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <button className="btn btn-secondary" onClick={() => { setTxType("addition"); setSelectedItem(null); setShowTxModal(true); }}>
            <ArrowDownRight size={16} /> {isAr ? "إضافة كمية" : "Stock In"}
          </button>
          <button className="btn btn-secondary" onClick={() => { setTxType("deduction"); setSelectedItem(null); setShowTxModal(true); }}>
            <ArrowUpRight size={16} /> {isAr ? "صرف كمية" : "Stock Out"}
          </button>
          <button className="btn btn-primary" onClick={() => setShowItemModal(true)}>
            <Plus size={16} /> {isAr ? "صنف جديد" : "New Item"}
          </button>
        </div>
      </div>

      {lowStockItems?.length > 0 && (
        <div style={{ marginBottom: "var(--space-5)", padding: "var(--space-4)", background: "var(--color-warning)20", border: "1px solid var(--color-warning)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "flex-start", gap: "var(--space-4)" }}>
          <AlertTriangle size={24} style={{ color: "var(--color-warning)" }} />
          <div>
            <h3 style={{ margin: "0 0 4px 0", color: "var(--color-warning)" }}>
              {isAr ? "تنبيه نقص المخزون" : "Low Stock Alert"}
            </h3>
            <p style={{ margin: 0, fontSize: "0.95rem" }}>
              {isAr ? `يوجد ${lowStockItems.length} أصناف أوشكت على النفاذ، يتوجب طلبها قريباً.` : `There are ${lowStockItems.length} items running low on stock. Please restock soon.`}
            </p>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--border-light)", display: "flex", gap: "var(--space-4)", background: "var(--bg-elevated)" }}>
          <button 
            className={`btn btn-sm ${activeTab === "items" ? "btn-primary" : "btn-ghost"}`} 
            onClick={() => setActiveTab("items")}
          >
            {isAr ? "كل الأصناف" : "All Items"}
          </button>
          <button 
            className={`btn btn-sm ${activeTab === "low_stock" ? "btn-primary" : "btn-ghost"}`} 
            style={activeTab === "low_stock" ? {} : { color: "var(--color-warning)" }}
            onClick={() => setActiveTab("low_stock")}
          >
            <AlertTriangle size={14} /> {isAr ? "نواقص" : "Low Stock"}
          </button>
          
          <div style={{ marginLeft: isAr ? 0 : "auto", marginRight: isAr ? "auto" : 0, display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: isAr ? "auto" : "10px", right: isAr ? "10px" : "auto", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input type="text" className="form-input form-input-sm" style={{ paddingLeft: isAr ? "10px" : "30px", paddingRight: isAr ? "30px" : "10px" }} placeholder={isAr ? "بحث..." : "Search..."} />
            </div>
          </div>
        </div>

        {itemsLoading ? (
          <div className="skeleton" style={{ height: "300px", borderRadius: 0 }} />
        ) : items?.length === 0 ? (
          <div className="empty-state" style={{ minHeight: "200px" }}>
            <PackageOpen size={32} style={{ color: "var(--text-muted)", marginBottom: "var(--space-3)" }} />
            <p>{isAr ? "المستودع فارغ" : "Inventory is empty"}</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "var(--space-4)", padding: "var(--space-4)" }}>
            {(activeTab === "items" ? items : lowStockItems)?.map((item: any) => (
              <div 
                key={item.id}
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)",
                  padding: "var(--space-5)",
                  position: "relative",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 20px rgba(0,0,0,0.08)";
                  e.currentTarget.style.borderColor = "var(--border-default)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", background: "var(--bg-elevated)", padding: "2px 8px", borderRadius: "12px", fontFamily: "monospace", display: "inline-block", marginBottom: "4px" }}>
                      {item.sku}
                    </span>
                    <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", gap: "6px", alignItems: "center" }}>
                      {item.name}
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--brand-primary)", fontWeight: 500 }}>{item.category_name || "—"}</p>
                  </div>
                  {item.is_low_stock ? (
                    <span className="badge badge-danger" style={{ padding: "6px 10px" }}><AlertTriangle size={14} /></span>
                  ) : (
                    <span className="badge badge-success" style={{ padding: "6px 10px" }}><Check size={14} /></span>
                  )}
                </div>

                <div style={{ padding: "var(--space-3) var(--space-4)", background: "var(--bg-subtle)", borderRadius: "var(--radius-md)", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{isAr ? "الكمية" : "Quantity"}</p>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                      <span style={{ fontSize: "1.5rem", fontWeight: 800, color: item.is_low_stock ? "var(--color-danger)" : "var(--text-primary)", lineHeight: 1 }}>{item.quantity}</span>
                      <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>{item.unit}</span>
                    </div>
                  </div>
                  <div style={{ width: "1px", height: "30px", background: "var(--border-subtle)" }} />
                  <div>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{isAr ? "الحد الأدنى" : "Min Qty"}</p>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                      <span style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-secondary)", lineHeight: 1 }}>{item.min_quantity}</span>
                      <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>{item.unit}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ITEM CREATION MODAL */}
      {showItemModal && (
        <div className="modal-backdrop">
          <div className="modal animate-scale-in" style={{ maxWidth: "500px" }}>
            <div className="modal-header">
              <h2 className="modal-title">{isAr ? "إضافة صنف جديد" : "Add New Item"}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowItemModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const data = Object.fromEntries(fd.entries());
              createItem({
                ...data,
                category: data.category || null,
                quantity: Number(data.quantity),
                min_quantity: Number(data.min_quantity),
                cost_per_unit: Number(data.cost_per_unit),
              });
            }}>
              <div className="modal-body" style={{ display: "grid", gap: "var(--space-4)" }}>
                <div>
                  <label className="form-label">{isAr ? "اسم الصنف" : "Item Name"}</label>
                  <input type="text" name="name" className="form-input" required />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                  <div>
                    <label className="form-label">{isAr ? "الرمز (SKU)" : "SKU"}</label>
                    <input type="text" name="sku" className="form-input" required />
                  </div>
                  <div>
                    <label className="form-label">{isAr ? "التصنيف" : "Category"}</label>
                    <select name="category" className="form-input">
                      <option value="">{isAr ? "بدون تصنيف" : "No Category"}</option>
                      {categories?.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }}>
                  <div>
                    <label className="form-label">{isAr ? "الكمية الحالية" : "Initial Qty"}</label>
                    <input type="number" step="0.01" name="quantity" defaultValue={0} className="form-input" required />
                  </div>
                  <div>
                    <label className="form-label">{isAr ? "الحد الأدنى" : "Min Qty"}</label>
                    <input type="number" step="0.01" name="min_quantity" defaultValue={10} className="form-input" required />
                  </div>
                  <div>
                    <label className="form-label">{isAr ? "وحدة القياس" : "Unit"}</label>
                    <input type="text" name="unit" placeholder="kg, pack, sheet..." className="form-input" required />
                  </div>
                </div>
                <div>
                  <label className="form-label">{isAr ? "التكلفة للوحدة (SAR)" : "Cost per Unit"}</label>
                  <input type="number" step="0.01" name="cost_per_unit" defaultValue={0} className="form-input" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowItemModal(false)}>{isAr ? "إلغاء" : "Cancel"}</button>
                <button type="submit" className="btn btn-primary" disabled={isCreatingItem}>{isAr ? "حفظ" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSACTION MODAL */}
      {showTxModal && (
        <div className="modal-backdrop">
          <div className="modal animate-scale-in" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h2 className="modal-title">{txType === "addition" ? (isAr ? "إضافة كمية للمخزون" : "Add to Stock") : (isAr ? "صرف كمية من المخزون" : "Deduct from Stock")}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowTxModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createTx({
                type: txType,
                item: fd.get("item"),
                quantity: Number(fd.get("quantity")),
                notes: fd.get("notes"),
              });
            }}>
              <div className="modal-body" style={{ display: "grid", gap: "var(--space-4)" }}>
                <div>
                  <label className="form-label">{isAr ? "اختر الصنف" : "Select Item"}</label>
                  <select name="item" className="form-input" required value={selectedItem || ""} onChange={(e) => setSelectedItem(e.target.value)}>
                    <option value="" disabled>{isAr ? "اختر..." : "Choose..."}</option>
                    {items?.map((item: any) => (
                      <option key={item.id} value={item.id}>{item.name} ({item.quantity} {item.unit} available)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">{txType === "addition" ? (isAr ? "الكمية المضافة" : "Quantity to Add") : (isAr ? "الكمية المصروفة" : "Quantity to Deduct")}</label>
                  <input type="number" step="0.01" min="0.01" name="quantity" className="form-input" required />
                </div>
                <div>
                  <label className="form-label">{isAr ? "ملاحظات / سبب الصرف" : "Notes / Reason"}</label>
                  <textarea name="notes" className="form-input" rows={3}></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTxModal(false)}>{isAr ? "إلغاء" : "Cancel"}</button>
                <button type="submit" className={`btn ${txType === "addition" ? "btn-primary" : "btn-danger"}`} disabled={isCreatingTx}>
                  {txType === "addition" ? (isAr ? "إضافة" : "Add") : (isAr ? "صرف" : "Deduct")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
