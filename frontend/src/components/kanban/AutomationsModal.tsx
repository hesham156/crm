"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi, usersApi } from "@/lib/api";
import { X, Search, Filter, Upload, MoreHorizontal, Check, Zap, Mail, Calendar, Grid, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";

interface AutomationsModalProps {
  boardId: string;
  onClose: () => void;
}

// ─── Trigger Field Config ───────────────────────────────────────────────────
const TRIGGER_FIELDS = [
  { value: "client_status",  label: "Client Status",  labelAr: "حالة العميل",     color: "#8b5cf6", trigger_type: "client_status_change" },
  { value: "column",         label: "Board Column",   labelAr: "قائمة البورد",    color: "#3b82f6", trigger_type: "column_change"        },
  { value: "priority",       label: "Priority",       labelAr: "الأولوية",         color: "#f97316", trigger_type: "priority_change"      },
  { value: "assigned_to",    label: "Assign To",      labelAr: "المسؤول",          color: "#22c55e", trigger_type: "assignment_change"    },
  { value: "due_date",       label: "Due Date",       labelAr: "تاريخ الاستحقاق", color: "#ef4444", trigger_type: "due_date_arrived"     },
];

const PRIORITY_OPTIONS = [
  { value: "low",    label: "Low"    },
  { value: "normal", label: "Normal" },
  { value: "high",   label: "High"   },
  { value: "urgent", label: "Urgent" },
];

const CLIENT_STATUS_OPTIONS = [
  "Pending", "In Review", "Approved", "Rejected", "Done",
  "تعديل جديد", "معاينات", "اعتمد التعديل", "بانتظار مراجعة المدير", "بانتظار التصميم",
];

// ─── Styled Field Selector (replaces purple "Status" badge) ───────────────
function TriggerFieldSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const selected = TRIGGER_FIELDS.find(f => f.value === value) || TRIGGER_FIELDS[0];
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          appearance: "none",
          background: selected.color,
          color: "#fff",
          fontWeight: 700,
          fontSize: "1rem",
          border: "none",
          borderRadius: "6px",
          padding: "4px 28px 4px 10px",
          cursor: "pointer",
          minWidth: "140px",
          outline: "none",
        }}
      >
        {TRIGGER_FIELDS.map(f => (
          <option key={f.value} value={f.value} style={{ background: "#1a1f36", color: "#fff" }}>
            {f.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#fff" }}
      />
    </div>
  );
}

// ─── Dynamic "changes to" value selector ──────────────────────────────────
function TriggerValueSelector({
  triggerField,
  value,
  onChange,
  boardColumns,
  users,
}: {
  triggerField: string;
  value: string;
  onChange: (v: string) => void;
  boardColumns: any[];
  users: any[];
}) {
  const selectStyle = {
    padding: "4px 30px 4px 8px",
    fontSize: "1rem",
    height: "auto",
    minHeight: "36px",
    width: "auto",
    minWidth: "160px",
  };

  if (triggerField === "client_status") {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className="form-input form-select" style={selectStyle}>
        <option value="">Select Status ▾</option>
        {CLIENT_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    );
  }

  if (triggerField === "column") {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className="form-input form-select" style={selectStyle}>
        <option value="">Select Column ▾</option>
        {boardColumns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    );
  }

  if (triggerField === "priority") {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className="form-input form-select" style={selectStyle}>
        <option value="">Select Priority ▾</option>
        {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
    );
  }

  if (triggerField === "assigned_to") {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className="form-input form-select" style={selectStyle}>
        <option value="">Select Employee ▾</option>
        {users?.map((u: any) => <option key={u.id} value={u.id}>{u.full_name_en}</option>)}
      </select>
    );
  }

  if (triggerField === "due_date") {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className="form-input form-select" style={selectStyle}>
        <option value="arrives">arrives</option>
        <option value="passed">has passed</option>
        <option value="1_day_before">1 day before</option>
        <option value="3_days_before">3 days before</option>
      </select>
    );
  }

  return null;
}

// ─── Main Component ──────────────────────────────────────────────────────
export default function AutomationsModal({ boardId, onClose }: AutomationsModalProps) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"board" | "templates">("board");
  const [configuringTemplate, setConfiguringTemplate] = useState<any>(null);
  const [builderParams, setBuilderParams] = useState({
    triggerField:     "client_status",  // ← NEW: which field triggers
    triggerVal:       "",
    actionVal:        "",
    targetBoardId:    "",
    targetColumnId:   "",
    targetAssigneeId: "",
  });
  const [targetBoardColumns, setTargetBoardColumns] = useState<any[]>([]);
  const [loadingColumns, setLoadingColumns]         = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: board } = useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => { const { data } = await tasksApi.board(boardId); return data; },
  });

  const { data: boards } = useQuery({
    queryKey: ["boards"],
    queryFn: async () => { const { data } = await tasksApi.boards(); return data.results || data; },
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => { const { data } = await usersApi.list(); return data.results || data; },
  });

  // ── Fetch columns for target board ───────────────────────────────────────
  const handleTargetBoardChange = async (newBoardId: string) => {
    setBuilderParams(prev => ({ ...prev, targetBoardId: newBoardId, targetColumnId: "" }));
    setTargetBoardColumns([]);
    if (!newBoardId) return;
    setLoadingColumns(true);
    try {
      const { data } = await tasksApi.board(newBoardId);
      setTargetBoardColumns(data.columns || []);
    } catch {
      setTargetBoardColumns([]);
    } finally {
      setLoadingColumns(false);
    }
  };

  // ── Reset on cancel ───────────────────────────────────────────────────────
  const handleCancelTemplate = () => {
    setConfiguringTemplate(null);
    setBuilderParams({ triggerField: "client_status", triggerVal: "", actionVal: "", targetBoardId: "", targetColumnId: "", targetAssigneeId: "" });
    setTargetBoardColumns([]);
  };

  // ── Handle trigger field change (reset triggerVal) ────────────────────────
  const handleTriggerFieldChange = (newField: string) => {
    setBuilderParams(prev => ({ ...prev, triggerField: newField, triggerVal: "" }));
  };

  // ── Build & save automation ───────────────────────────────────────────────
  const handleCreateAutomation = () => {
    if (!builderParams.triggerVal && builderParams.triggerField !== "due_date") {
      toast.error("Please select a trigger value");
      return;
    }

    const fieldConfig    = TRIGGER_FIELDS.find(f => f.value === builderParams.triggerField) || TRIGGER_FIELDS[0];
    const triggerValLabel = (() => {
      if (builderParams.triggerField === "column") {
        return board?.columns?.find((c: any) => c.id === builderParams.triggerVal)?.name || builderParams.triggerVal;
      }
      if (builderParams.triggerField === "assigned_to") {
        return users?.find((u: any) => u.id === builderParams.triggerVal)?.full_name_en || builderParams.triggerVal;
      }
      return builderParams.triggerVal;
    })();

    let newAuto: any = {};

    if (configuringTemplate.id === "status_move") {
      if (!builderParams.actionVal) { toast.error("Please select a target column"); return; }
      const colName = board?.columns?.find((c: any) => c.id === builderParams.actionVal)?.name || "another column";
      newAuto = {
        trigger_type:  fieldConfig.trigger_type,
        trigger_value: builderParams.triggerVal,
        actions:       [{ type: "move_to_column", value: builderParams.actionVal }],
        label_text:    `When **${fieldConfig.label}** changes to **${triggerValLabel}** move item to **${colName}**`,
      };

    } else if (configuringTemplate.id === "status_move_board") {
      if (!builderParams.triggerVal || !builderParams.targetBoardId || !builderParams.targetColumnId) {
        toast.error("Please fill all required fields");
        return;
      }
      const bName   = boards?.find((x: any) => x.id === builderParams.targetBoardId)?.name || "Another Board";
      const colName = targetBoardColumns.find((c: any) => c.id === builderParams.targetColumnId)?.name || "Column";
      const empName = users?.find((u: any) => u.id === builderParams.targetAssigneeId)?.full_name_en || "nobody";
      newAuto = {
        trigger_type:  fieldConfig.trigger_type,
        trigger_value: builderParams.triggerVal,
        actions: [{ type: "move_to_board", value: { board_id: builderParams.targetBoardId, column_id: builderParams.targetColumnId, assignee_id: builderParams.targetAssigneeId }}],
        label_text: `When **${fieldConfig.label}** changes to **${triggerValLabel}** move item to board **${bName}** › **${colName}** and assign to **${empName}**`,
      };

    } else {
      newAuto = {
        trigger_type:  "item_created",
        trigger_value: "",
        actions:       [{ type: "notify_user", value: "creator" }],
        label_text:    `When an item is created notify creator`,
      };
    }

    tasksApi.createAutomation(boardId, newAuto).then(() => {
      qc.invalidateQueries({ queryKey: ["board", boardId] });
      toast.success("Automation created successfully!");
      handleCancelTemplate();
      setActiveTab("board");
    }).catch(() => toast.error("Failed to create automation."));
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const automations = board?.automations || [
    { id: "1", trigger_type: "client_status_change", label_text: 'When **حالة العميل** changes to **تعديل جديد** move item to **معاينات** and notify **الموظف**', is_active: true, updated_at: "1mo ago" },
    { id: "2", trigger_type: "client_status_change", label_text: 'When **حالة العميل** changes to **اعتمد التعديل** notify **الموظف** and move item to **تم تأكيد المعاينه**', is_active: true, updated_at: "1mo ago" },
    { id: "3", trigger_type: "column_change",        label_text: 'When an item is moved to this board start **Time tracking 1**', is_active: true, updated_at: "1mo ago" },
  ];

  const handleToggle = (id: string, currentStatus: boolean) => {
    if (id.length < 5) return toast.success(`Automation ${currentStatus ? "disabled" : "enabled"}`);
    tasksApi.updateAutomation(id, { is_active: !currentStatus })
      .then(() => { qc.invalidateQueries({ queryKey: ["board", boardId] }); toast.success(`Automation ${currentStatus ? "disabled" : "enabled"}`); })
      .catch(() => toast.error("Failed to update"));
  };

  const renderFormattedText = (text: string) => {
    return text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <span key={i} style={{ fontWeight: 800, color: "var(--text-primary)" }}>{part.slice(2, -2)}</span>;
      return <span key={i} style={{ color: "var(--text-secondary)" }}>{part}</span>;
    });
  };

  const templates = [
    { id: "status_move",       title: "When a field changes to something, move item to a column in this board", icon: <Grid size={16} /> },
    { id: "status_move_board", title: "When a field changes to something, move item to another board and assign", icon: <Grid size={16} color="#4f46e5" /> },
    { id: "create_event",      title: "When an item is created or updated, create an event in Calendar", icon: <Calendar size={16} color="#4285F4" /> },
    { id: "status_notify",     title: "When a field changes to something notify someone", icon: <Grid size={16} /> },
    { id: "create_assign",     title: "When an item is created assign creator as person", icon: <Grid size={16} /> },
    { id: "date_notify",       title: "When date arrives notify someone", icon: <Grid size={16} /> },
    { id: "email_create",      title: "When an email is received, create an item", icon: <Mail size={16} color="#EA4335" /> },
  ];

  // Shared select style for builder
  const selStyle = { padding: "4px 30px 4px 8px", fontSize: "1rem", height: "auto", minHeight: "36px", width: "auto", minWidth: "150px" };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" style={{ background: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(4px)" }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: "90%", maxWidth: "1100px", height: "85vh", display: "flex", flexDirection: "column", background: "#1a1f36", color: "#fff", border: "1px solid #2d3748", padding: 0 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-4) var(--space-6)", borderBottom: "1px solid #2d3748" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>Automations</h2>
            <span style={{ fontSize: "0.9rem", color: "#a0aec0" }}>{board?.name}'s task</span>
          </div>
          <div style={{ display: "flex", background: "#2d3748", borderRadius: "var(--radius-md)", padding: "2px" }}>
            <button style={{ background: activeTab === "templates" ? "#1e1e1e" : "transparent", color: "#fff", border: "none", padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-sm)", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }} onClick={() => setActiveTab("templates")}>Create</button>
            <button style={{ background: activeTab === "board" ? "#4f46e5" : "transparent", color: "#fff", border: "none", padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-sm)", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }} onClick={() => setActiveTab("board")}>Manage / {automations.length}</button>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ color: "#a0aec0" }}><X size={20} /></button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-6)" }}>

          {activeTab === "board" ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
                <h3 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Manage your board automations</h3>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={{ fontSize: "0.8rem", color: "#a0aec0", display: "flex", alignItems: "center", gap: "var(--space-1)" }}><Zap size={14} /> Autopilot hub</span>
                  <button className="btn btn-primary btn-sm" onClick={() => setActiveTab("templates")}>Create automation ▾</button>
                </div>
              </div>

              <div style={{ display: "flex", gap: "var(--space-6)", borderBottom: "1px solid #2d3748", marginBottom: "var(--space-4)", color: "#a0aec0", fontSize: "0.9rem", fontWeight: 600 }}>
                <div style={{ paddingBottom: "var(--space-2)", borderBottom: "2px solid #fff", color: "#fff", cursor: "pointer" }}>Automations</div>
                <div style={{ paddingBottom: "var(--space-2)", cursor: "pointer" }}>Run history</div>
                <div style={{ paddingBottom: "var(--space-2)", cursor: "pointer" }}>My connections</div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
                <div style={{ position: "relative", width: "300px" }}>
                  <Search size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#a0aec0" }} />
                  <input type="text" placeholder="Search" style={{ width: "100%", background: "#2d3748", border: "1px solid #4a5568", color: "#fff", padding: "var(--space-2) var(--space-4)", paddingLeft: "36px", borderRadius: "16px", outline: "none", fontSize: "0.85rem" }} />
                </div>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button className="btn btn-ghost btn-sm" style={{ color: "#a0aec0" }}><Filter size={16} /> Filter</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: "#a0aec0" }}><Upload size={16} /></button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {automations.map((auto: any) => (
                  <div key={auto.id} style={{ background: "#222a42", border: "1px solid #2d3748", borderRadius: "12px", padding: "var(--space-4)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "1.1rem", marginBottom: "var(--space-3)", lineHeight: 1.5 }}>{renderFormattedText(auto.label_text)}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", fontSize: "0.75rem", color: "#718096" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Zap size={12} /> Minor</span>
                        <span>Updated {auto.updated_at}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                      <label style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
                        <input type="checkbox" checked={auto.is_active} onChange={() => handleToggle(auto.id, auto.is_active)} style={{ display: "none" }} />
                        <div style={{ width: "40px", height: "24px", background: auto.is_active ? "#4f46e5" : "#4a5568", borderRadius: "12px", position: "relative", transition: "all 0.3s" }}>
                          <div style={{ width: "18px", height: "18px", background: "#fff", borderRadius: "50%", position: "absolute", top: "3px", left: auto.is_active ? "19px" : "3px", transition: "all 0.3s" }} />
                        </div>
                      </label>
                      <button className="btn btn-ghost btn-sm" style={{ color: "#a0aec0" }}><MoreHorizontal size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ maxWidth: "900px", margin: "0 auto" }}>
                {configuringTemplate ? (

                  // ── Configure form ───────────────────────────────────────
                  <div style={{ background: "#222a42", border: "1px solid #2d3748", borderRadius: "12px", padding: "var(--space-6)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-6)" }}>
                      <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>Configure Automation</h3>
                      <button className="btn btn-ghost btn-sm" onClick={handleCancelTemplate}><X size={16} /></button>
                    </div>

                    {/* ── Builder sentence ── */}
                    <div style={{ fontSize: "1.2rem", marginBottom: "var(--space-6)", lineHeight: 2, background: "#1a1f36", padding: "var(--space-5)", borderRadius: "var(--radius-md)", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>

                      {(configuringTemplate.id === "status_move" || configuringTemplate.id === "status_move_board") ? (
                        <>
                          <span style={{ color: "#a0aec0" }}>When</span>

                          {/* ▼ Trigger field dropdown (replaces static "Status" badge) */}
                          <TriggerFieldSelector
                            value={builderParams.triggerField}
                            onChange={handleTriggerFieldChange}
                          />

                          <span style={{ color: "#a0aec0" }}>
                            {builderParams.triggerField === "due_date" ? "" : "changes to"}
                          </span>

                          {/* ▼ Dynamic value selector */}
                          <TriggerValueSelector
                            triggerField={builderParams.triggerField}
                            value={builderParams.triggerVal}
                            onChange={v => setBuilderParams(prev => ({ ...prev, triggerVal: v }))}
                            boardColumns={board?.columns || []}
                            users={users || []}
                          />

                          {/* ▼ Action part */}
                          {configuringTemplate.id === "status_move" ? (
                            <>
                              <span style={{ color: "#a0aec0" }}>move item to</span>
                              <select value={builderParams.actionVal} onChange={e => setBuilderParams({ ...builderParams, actionVal: e.target.value })} className="form-input form-select" style={selStyle}>
                                <option value="">Select Column ▾</option>
                                {board?.columns?.map((col: any) => <option key={col.id} value={col.id}>{col.name}</option>)}
                              </select>
                            </>
                          ) : (
                            <>
                              <span style={{ color: "#a0aec0" }}>move item to board</span>
                              <select value={builderParams.targetBoardId} onChange={e => handleTargetBoardChange(e.target.value)} className="form-input form-select" style={selStyle}>
                                <option value="">Board ▾</option>
                                {boards?.filter((b: any) => b.id !== boardId).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                              </select>

                              {builderParams.targetBoardId && (
                                <>
                                  <span style={{ color: "#a0aec0" }}>in column</span>
                                  <select value={builderParams.targetColumnId} onChange={e => setBuilderParams({ ...builderParams, targetColumnId: e.target.value })} className="form-input form-select" style={selStyle} disabled={loadingColumns}>
                                    <option value="">{loadingColumns ? "Loading..." : "Column ▾"}</option>
                                    {targetBoardColumns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                                </>
                              )}

                              <span style={{ color: "#a0aec0" }}>and assign to</span>
                              <select value={builderParams.targetAssigneeId} onChange={e => setBuilderParams({ ...builderParams, targetAssigneeId: e.target.value })} className="form-input form-select" style={selStyle}>
                                <option value="">Employee ▾</option>
                                {users?.map((u: any) => <option key={u.id} value={u.id}>{u.full_name_en}</option>)}
                              </select>
                            </>
                          )}
                        </>
                      ) : (
                        renderFormattedText(configuringTemplate.title)
                      )}
                    </div>

                    {/* Field color legend */}
                    {(configuringTemplate.id === "status_move" || configuringTemplate.id === "status_move_board") && (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
                        {TRIGGER_FIELDS.map(f => (
                          <span
                            key={f.value}
                            onClick={() => handleTriggerFieldChange(f.value)}
                            style={{
                              fontSize: "0.72rem", fontWeight: 600, padding: "3px 10px", borderRadius: "20px",
                              background: builderParams.triggerField === f.value ? f.color : "transparent",
                              color: builderParams.triggerField === f.value ? "#fff" : "#a0aec0",
                              border: `1px solid ${builderParams.triggerField === f.value ? f.color : "#4a5568"}`,
                              cursor: "pointer", transition: "all 0.15s",
                            }}
                          >
                            {f.label}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                      <p style={{ color: "#a0aec0", margin: 0 }}>Set conditions and actions to activate this template.</p>
                      <div style={{ display: "flex", gap: "var(--space-3)" }}>
                        <button className="btn btn-primary" onClick={handleCreateAutomation}>Create Automation</button>
                        <button className="btn btn-secondary" onClick={handleCancelTemplate}>Cancel</button>
                      </div>
                    </div>
                  </div>

                ) : (
                  // ── Template gallery ─────────────────────────────────────
                  <>
                    <h3 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "var(--space-6)" }}>Automations Center</h3>
                    <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
                      <button style={{ background: "#fff", color: "#000", border: "none", padding: "var(--space-3) var(--space-6)", borderRadius: "var(--radius-md)", fontWeight: 600, display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
                        <Mail size={16} color="#EA4335" /> Gmail
                      </button>
                      <button style={{ background: "#fff", color: "#000", border: "none", padding: "var(--space-3) var(--space-6)", borderRadius: "var(--radius-md)", fontWeight: 600, display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
                        <Calendar size={16} color="#4285F4" /> Google Calendar
                      </button>
                      <button style={{ background: "#0078d4", color: "#fff", border: "none", padding: "var(--space-3) var(--space-6)", borderRadius: "var(--radius-md)", fontWeight: 600, cursor: "pointer" }}>
                        Outlook
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }}>
                      {templates.map((tpl, i) => (
                        <div key={i} style={{ background: "#222a42", border: "1px solid #2d3748", borderRadius: "12px", padding: "var(--space-4)", display: "flex", flexDirection: "column", minHeight: "180px", cursor: "pointer", transition: "transform 0.2s" }}
                          onMouseOver={e => e.currentTarget.style.transform = "translateY(-2px)"}
                          onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}
                        >
                          <div style={{ marginBottom: "var(--space-3)" }}>{tpl.icon}</div>
                          <div style={{ fontSize: "1rem", fontWeight: 500, lineHeight: 1.5, flex: 1, color: "#e2e8f0" }}>{tpl.title}</div>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setConfiguringTemplate(tpl);
                              setBuilderParams({ triggerField: "client_status", triggerVal: "", actionVal: "", targetBoardId: "", targetColumnId: "", targetAssigneeId: "" });
                            }}
                            style={{ background: "transparent", border: "1px solid #4a5568", color: "#fff", padding: "var(--space-2)", borderRadius: "var(--radius-md)", marginTop: "var(--space-4)", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                            onMouseOver={e => e.currentTarget.style.background = "#2d3748"}
                            onMouseOut={e => e.currentTarget.style.background = "transparent"}
                          >
                            Use template
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
