"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { salesApi, productionApi } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import { useState } from "react";
import { Check, Clock, Package, Pause, Play, Plus, Search } from "lucide-react";
import toast from "react-hot-toast";

const STAGE_TYPES = [
  { id: "prepress", labelAr: "التحضير للطباعة", labelEn: "Pre-press" },
  { id: "printing", labelAr: "الطباعة", labelEn: "Printing" },
  { id: "cutting", labelAr: "التكسير والقص", labelEn: "Cutting" },
  { id: "lamination", labelAr: "السلوفان", labelEn: "Lamination" },
  { id: "finishing", labelAr: "التشطيب", labelEn: "Finishing" },
  { id: "packaging", labelAr: "التغليف", labelEn: "Packaging" },
];

export default function ProductionBoardPage() {
  const { language } = useUIStore();
  const isAr = language === "ar";
  const queryClient = useQueryClient();
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  // Fetch jobs that are currently active (not draft, complete, or cancelled)
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["production-jobs"],
    queryFn: async () => {
      const { data } = await salesApi.jobs({ status: "production" });
      // If the backend doesn't filter by status, we do it safely:
      const res = data.results || data;
      return res.filter((j: any) => j.status === "production");
    },
  });

  // Stages for the expanded job
  const { data: jobStages, isLoading: stagesLoading } = useQuery({
    queryKey: ["production-stages", expandedJob],
    queryFn: async () => {
      if (!expandedJob) return [];
      const { data } = await productionApi.stages({ job: expandedJob });
      return data.results || data;
    },
    enabled: !!expandedJob,
  });

  const { mutate: createStage } = useMutation({
    mutationFn: async (payload: any) => {
      await productionApi.createStage(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-stages", expandedJob] });
    },
  });

  const { mutate: updateStageStatus } = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "start" | "complete" }) => {
      if (action === "start") {
        await productionApi.startStage(id);
      } else {
        await productionApi.completeStage(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-stages", expandedJob] });
      toast.success(isAr ? "تم تحديث حالة المرحلة" : "Stage status updated");
    },
  });

  const handleGenerateStages = () => {
    // Generate default stages if they don't exist
    if (!expandedJob) return;
    STAGE_TYPES.forEach((st, idx) => {
      createStage({
        job: expandedJob,
        stage_type: st.id,
        position: idx,
      });
    });
    toast.success(isAr ? "جاري إنشاء سير العمل..." : "Generating workflow...");
  };

  const getStageIcon = (type: string) => {
    return <Package size={16} />;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? "إدارة خطوط الإنتاج" : "Production Tracker"}</h1>
          <p className="page-subtitle">
            {isAr ? "تتبع مراحل الطباعة والتشطيب للطلبات" : "Track printing and finishing stages for active jobs"}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: "var(--space-5)" }}>
        
        {/* Left Column: List of Jobs in Production */}
        <div className="card" style={{ padding: "var(--space-4)" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "var(--space-4)" }}>
            {isAr ? "طلبات قيد الإنتاج" : "Jobs in Production"}
          </h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {isLoading ? (
              <div className="skeleton" style={{ height: "100px" }} />
            ) : jobs?.length === 0 ? (
              <div className="empty-state" style={{ minHeight: "150px" }}>
                <p>{isAr ? "لا يوجد طلبات في خط الإنتاج" : "No jobs in production"}</p>
              </div>
            ) : (
              jobs?.map((job: any) => (
                <div 
                  key={job.id}
                  onClick={() => setExpandedJob(job.id)}
                  style={{ 
                    padding: "var(--space-3)", 
                    borderRadius: "var(--radius-md)", 
                    border: expandedJob === job.id ? "2px solid var(--brand-primary)" : "1px solid var(--border-light)",
                    background: expandedJob === job.id ? "var(--brand-primary-light)" : "var(--bg-card)",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "4px" }}>{job.title}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    <span style={{ fontFamily: "monospace" }}>{job.job_number}</span>
                    <span className={`badge priority-${job.priority}`}>{job.priority}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Stages Tracker for selected job */}
        <div>
          {!expandedJob ? (
            <div className="card empty-state" style={{ height: "100%", minHeight: "400px" }}>
              <Package size={32} style={{ color: "var(--text-muted)" }} />
              <h3>{isAr ? "اختر طلباً لعرض التفاصيل" : "Select a job to view details"}</h3>
            </div>
          ) : (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)" }}>
                <div>
                  <h2 style={{ fontSize: "1.2rem", margin: 0 }}>
                    {isAr ? "مراحل الإنتاج" : "Production Stages"}
                  </h2>
                  <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.9rem" }}>
                    {jobs?.find((j:any) => j.id === expandedJob)?.title}
                  </p>
                </div>
                {jobStages?.length === 0 && (
                  <button className="btn btn-primary btn-sm" onClick={handleGenerateStages}>
                    <Plus size={14} /> {isAr ? "توليد المراحل" : "Generate Workflow"}
                  </button>
                )}
              </div>

              {stagesLoading ? (
                <div className="skeleton" style={{ height: "200px" }} />
              ) : jobStages?.length === 0 ? (
                <div style={{ padding: "var(--space-4)", textAlign: "center", color: "var(--text-muted)" }}>
                  {isAr ? "لم يتم إعداد سير الإنتاج لهذا الطلب" : "No production workflow setup for this job yet."}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {STAGE_TYPES.map((templateStage) => {
                    // Find actual stage, if created
                    const stage = jobStages?.find((s:any) => s.stage_type === templateStage.id);
                    
                    return (
                      <div key={templateStage.id} style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "space-between",
                        padding: "var(--space-4)", 
                        border: "1px solid var(--border-light)",
                        borderRadius: "var(--radius-md)",
                        background: stage?.status === "done" ? "var(--bg-elevated)" : "var(--bg-card)",
                        opacity: stage ? 1 : 0.6
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                          <div style={{ 
                            width: "32px", height: "32px", borderRadius: "50%", 
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: stage?.status === "done" ? "var(--color-success)" : stage?.status === "in_progress" ? "var(--brand-primary)" : "var(--bg-elevated)",
                            color: stage?.status === "done" ? "white" : stage?.status === "in_progress" ? "white" : "var(--text-muted)"
                          }}>
                            {stage?.status === "done" ? <Check size={16} /> : stage?.status === "in_progress" ? <Play size={16} fill="white" /> : <Clock size={16} />}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{isAr ? templateStage.labelAr : templateStage.labelEn}</div>
                            {stage && (
                              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                {stage.status === "in_progress" ? (isAr ? "جاري العمل" : "In Progress") :
                                 stage.status === "done" ? (isAr ? "مكتمل" : "Completed") :
                                 stage.status === "paused" ? (isAr ? "متوقف" : "Paused") :
                                 (isAr ? "قيد الانتظار" : "Pending")}
                              </div>
                            )}
                          </div>
                        </div>

                        {stage && (
                          <div style={{ display: "flex", gap: "var(--space-2)" }}>
                            {stage.status !== "done" && (
                              <button 
                                className={`btn btn-sm ${stage.status === "in_progress" ? "btn-success" : "btn-primary"}`}
                                onClick={() => updateStageStatus({ id: stage.id, action: stage.status === "in_progress" ? "complete" : "start" })}
                              >
                                {stage.status === "in_progress" ? (
                                  <><Check size={14} /> {isAr ? "إنهاء المرحلة" : "Mark Done"}</>
                                ) : (
                                  <><Play size={14} /> {isAr ? "بدء العمل" : "Start"}</>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                        {!stage && (
                          <span className="badge badge-gray">{isAr ? "لم تبدأ" : "Not started"}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
