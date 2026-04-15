"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { salesApi, designApi } from "@/lib/api";
import { useUIStore } from "@/store/useUIStore";
import { useState } from "react";
import { Check, Upload, X, Eye, FileImage, Send, MessageSquare, Cloud } from "lucide-react";
import toast from "react-hot-toast";
import { useGoogleDrivePicker } from "@/hooks/useGoogleDrivePicker";

export default function DesignBoardPage() {
  const { language } = useUIStore();
  const isAr = language === "ar";
  const queryClient = useQueryClient();
  const [expandedJob, setExpandedJob] = useState<any | null>(null);
  const { openPicker } = useGoogleDrivePicker();

  // Fetch jobs in design or approval
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["design-jobs"],
    queryFn: async () => {
      const { data } = await salesApi.jobs();
      const res = data.results || data;
      return res.filter((j: any) => j.status === "design" || j.status === "approval");
    },
  });

  // Fetch submissions for the expanded job
  const { data: submissions, isLoading: subsLoading } = useQuery({
    queryKey: ["design-submissions", expandedJob?.id],
    queryFn: async () => {
      if (!expandedJob) return [];
      const { data } = await designApi.submissions({ job: expandedJob.id });
      return data.results || data;
    // Note: If backend doesn't filter by job, we filter manually here if needed.
    // The backend might not have filterset_fields set up on DesignSubmissionListCreate. Let's do client-side filter just in case.
    },
    enabled: !!expandedJob,
  });

  const submissionsForJob = submissions?.filter((s: any) => s.job === expandedJob?.id) || [];

  const { mutate: uploadDesign, isPending: isUploading } = useMutation({
    mutationFn: async (payload: File | { file_url: string; filename: string }) => {
      if (payload instanceof File) {
        const formData = new FormData();
        formData.append("job", expandedJob.id);
        formData.append("file", payload);
        await designApi.createSubmission(formData);
      } else {
        await designApi.createSubmission({
          job: expandedJob.id,
          file_url: payload.file_url,
          filename: payload.filename
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["design-submissions", expandedJob?.id] });
      toast.success(isAr ? "تم رفع التصميم" : "Design uploaded");
    },
    onError: () => toast.error(isAr ? "فشل الرفع" : "Upload failed"),
  });

  const { mutate: performAction } = useMutation({
    mutationFn: async ({ id, action, notes }: { id: string; action: string; notes?: string }) => {
      if (action === "submit") await designApi.submitForReview(id);
      if (action === "approve") await designApi.approve(id, notes);
      if (action === "reject") await designApi.reject(id, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["design-submissions", expandedJob?.id] });
      toast.success(isAr ? "تم التحديث" : "Status updated");
    },
  });

  const handleFileChange = (e: any) => {
    if (e.target.files && e.target.files[0]) {
      uploadDesign(e.target.files[0]);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? "قسم التصميم والمراجعة" : "Design & Review Board"}</h1>
          <p className="page-subtitle">
            {isAr ? "إدارة ملفات التصميم واعتمادات العملاء" : "Manage design files and client approvals"}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: "var(--space-5)" }}>
        
        {/* Left Column: Jobs needing design/approval */}
        <div className="card" style={{ padding: "var(--space-4)" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "var(--space-4)" }}>
            {isAr ? "طلبات قيد التصميم" : "Jobs In Design Pipeline"}
          </h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {isLoading ? (
              <div className="skeleton" style={{ height: "100px" }} />
            ) : jobs?.length === 0 ? (
              <div className="empty-state" style={{ minHeight: "150px" }}>
                <p>{isAr ? "لا توجد طلبات هنا" : "No jobs in design queue"}</p>
              </div>
            ) : (
              jobs?.map((job: any) => (
                <div 
                  key={job.id}
                  onClick={() => setExpandedJob(job)}
                  style={{ 
                    padding: "var(--space-3)", 
                    borderRadius: "var(--radius-md)", 
                    border: expandedJob?.id === job.id ? "2px solid var(--brand-primary)" : "1px solid var(--border-light)",
                    background: expandedJob?.id === job.id ? "var(--brand-primary-light)" : "var(--bg-card)",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "4px" }}>{job.title}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    <span style={{ fontFamily: "monospace" }}>{job.job_number}</span>
                    <span className={`badge badge-${job.status === "approval" ? "warning" : "purple"}`}>{job.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Submission Versions */}
        <div>
          {!expandedJob ? (
            <div className="card empty-state" style={{ height: "100%", minHeight: "400px" }}>
              <FileImage size={32} style={{ color: "var(--text-muted)" }} />
              <h3>{isAr ? "اختر طلباً لعرض التصاميم" : "Select a job to view designs"}</h3>
            </div>
          ) : (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)" }}>
                <div>
                  <h2 style={{ fontSize: "1.2rem", margin: 0 }}>
                    {isAr ? "تصاميم الطلب" : "Design Submissions"} - {expandedJob.job_number}
                  </h2>
                  <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.9rem" }}>
                    {expandedJob.title}
                  </p>
                </div>
                <div>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  {expandedJob.drive_folder_url && (
                    <a href={expandedJob.drive_folder_url} target="_blank" className="btn btn-ghost btn-sm" style={{ color: "var(--brand-primary)" }} title={isAr ? "مجلد جوجل درايف للطلب" : "Job Google Drive Folder"}>
                      <Cloud size={14} /> Drive Folder
                    </a>
                  )}
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => openPicker({
                      onFilePicked: (file) => uploadDesign({ file_url: file.url, filename: file.name })
                    })}
                    disabled={isUploading}
                  >
                    <Cloud size={14} /> {isAr ? "من Drive" : "From Drive"}
                  </button>
                  <input type="file" id="upload-design" style={{ display: "none" }} onChange={handleFileChange} />
                  <label htmlFor="upload-design" className="btn btn-primary btn-sm" style={{ cursor: "pointer", margin: 0 }}>
                    <Upload size={14} /> 
                    {isUploading ? (isAr ? "جاري الرفع..." : "Uploading...") : (isAr ? "رفع ملف" : "Upload File")}
                  </label>
                </div>
              </div>
              </div>

              {subsLoading ? (
                <div className="skeleton" style={{ height: "200px" }} />
              ) : submissionsForJob?.length === 0 ? (
                <div className="empty-state">
                  <FileImage size={24} style={{ color: "var(--text-muted)" }} />
                  <p>{isAr ? "لا توجد تصاميم مرفوعة بعد" : "No designs uploaded yet."}</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {submissionsForJob.sort((a:any, b:any) => b.version - a.version).map((sub: any) => (
                    <div key={sub.id} style={{ 
                      border: "1px solid var(--border-light)",
                      borderRadius: "var(--radius-md)",
                      overflow: "hidden"
                    }}>
                      <div style={{ 
                        padding: "var(--space-3) var(--space-4)", 
                        background: "var(--bg-elevated)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: "1px solid var(--border-light)"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                          <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>V{sub.version}</span>
                          <span className={`badge badge-${
                            sub.status === "approved" ? "success" : 
                            sub.status === "rejected" ? "danger" : 
                            sub.status === "submitted" ? "info" : "gray"
                          }`}>
                            {sub.status}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                          {isAr ? "بواسطة" : "By"} {sub.designer_name}
                        </div>
                      </div>

                      <div style={{ padding: "var(--space-4)", display: "grid", gridTemplateColumns: "1fr 200px", gap: "var(--space-4)" }}>
                        <div>
                          {sub.file_url_display ? (
                            <img 
                              src={sub.file_url_display} 
                              alt={`V${sub.version}`} 
                              style={{ maxWidth: "100%", maxHeight: "300px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}
                            />
                          ) : (
                            <div style={{ padding: "var(--space-6)", textAlign: "center", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)" }}>
                              {isAr ? "ملف غير مدعوم للمعاينة المباشرة" : "File not available for preview"}
                              <br/>
                              <a href={sub.file_url} target="_blank" className="btn btn-ghost btn-sm" style={{ marginTop: "8px" }}>
                                {isAr ? "تحميل الملف" : "Download File"}
                              </a>
                            </div>
                          )}
                          
                          {sub.reviewer_notes && (
                            <div style={{ marginTop: "var(--space-3)", padding: "var(--space-3)", background: "var(--color-danger)10", borderRadius: "var(--radius-sm)", borderLeft: "3px solid var(--color-danger)" }}>
                              <div style={{ fontWeight: 600, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "4px" }}>
                                <MessageSquare size={14} /> {isAr ? "ملاحظات المراجعة:" : "Reviewer Notes:"}
                              </div>
                              <p style={{ margin: "4px 0 0 0", fontSize: "0.9rem" }}>{sub.reviewer_notes}</p>
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                          {sub.status === "draft" && (
                            <button className="btn btn-primary" onClick={() => performAction({ id: sub.id, action: "submit" })}>
                              <Send size={16} /> {isAr ? "إرسال للمراجعة" : "Submit for Review"}
                            </button>
                          )}
                          {sub.status === "submitted" && (
                            <>
                              <button className="btn btn-success" onClick={() => performAction({ id: sub.id, action: "approve" })}>
                                <Check size={16} /> {isAr ? "اعتماد" : "Approve"}
                              </button>
                              <button className="btn btn-danger" onClick={() => {
                                const notes = prompt(isAr ? "أدخل سبب الرفض/الملاحظات:" : "Enter rejection reason/notes:");
                                if (notes) performAction({ id: sub.id, action: "reject", notes });
                              }}>
                                <X size={16} /> {isAr ? "رفض" : "Reject"}
                              </button>
                            </>
                          )}
                          <a href={sub.file_url_display || sub.file_url} target="_blank" className="btn btn-secondary">
                            <Eye size={16} /> {isAr ? "فتح الملف بملء الشاشة" : "View Full Screen"}
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
