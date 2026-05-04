"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { backupApi, apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import toast from "react-hot-toast";
import {
  DatabaseBackup, Plus, Trash2, Download, RefreshCw,
  HardDrive, FileArchive, Loader2, AlertTriangle,
  CheckCircle2, Clock, Server, FolderOpen, ShieldCheck,
  Upload, RotateCcw,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface BackupFile {
  name: string;
  size_bytes: number;
  size_mb: number;
  created_at: string;
}
interface BackupStats {
  backup_count: number;
  total_backup_size_mb: number;
  db_size_mb: number;
  media_size_mb: number;
  designs_size_mb: number;
  latest_backup: BackupFile | null;
}

function formatBytes(mb: number) {
  if (mb < 1) return `${Math.round(mb * 1024)} KB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(2)} MB`;
}

export default function BackupPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const importRef = useRef<HTMLInputElement>(null);

  const [confirmDelete,   setConfirmDelete]   = useState<string | null>(null);
  const [confirmRestore,  setConfirmRestore]  = useState<string | null>(null);
  const [restoreOpts,     setRestoreOpts]     = useState({ restore_db: true, restore_media: true, restore_config: false });
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  // ── Authenticated blob download — fixes missing .zip extension ──
  const handleDownload = async (filename: string) => {
    setDownloadingFile(filename);
    try {
      const res = await apiClient.get(`/backup/${filename}/download/`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/zip" });
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = filename;   // forces browser to save with .zip extension
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Downloaded: ${filename}`);
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloadingFile(null);
    }
  };

  // Access guard
  if (user?.role !== "admin") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: "var(--space-4)" }}>
        <ShieldCheck size={56} style={{ color: "var(--text-muted)" }} />
        <h2 style={{ color: "var(--text-secondary)" }}>Access Denied</h2>
        <p style={{ color: "var(--text-muted)" }}>Only administrators can access the backup system.</p>
      </div>
    );
  }

  const { data: listData, isLoading: listLoading, refetch: refetchList } = useQuery({
    queryKey: ["backups"],
    queryFn: async () => { const { data } = await backupApi.list(); return data; },
    refetchInterval: 30000,
  });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["backup-stats"],
    queryFn: async () => { const { data } = await backupApi.stats(); return data as BackupStats; },
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: () => backupApi.create(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["backups"] });
      qc.invalidateQueries({ queryKey: ["backup-stats"] });
      toast.success(`✅ Backup created: ${res.data.filename} (${res.data.size_mb} MB)`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || "Backup failed"),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => backupApi.import(file),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["backups"] });
      qc.invalidateQueries({ queryKey: ["backup-stats"] });
      toast.success(`✅ Imported: ${res.data.filename} (${res.data.size_mb} MB)`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || "Import failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (filename: string) => backupApi.delete(filename),
    onSuccess: (_d, filename) => {
      qc.invalidateQueries({ queryKey: ["backups"] });
      qc.invalidateQueries({ queryKey: ["backup-stats"] });
      setConfirmDelete(null);
      toast.success(`Deleted: ${filename}`);
    },
    onError: () => toast.error("Failed to delete backup"),
  });

  const restoreMutation = useMutation({
    mutationFn: ({ filename, opts }: { filename: string; opts: typeof restoreOpts }) =>
      backupApi.restore(filename, opts),
    onSuccess: (res) => {
      setConfirmRestore(null);
      toast.success(`✅ Restore complete: ${res.data.restored?.join(", ")}`, { duration: 6000 });
      res.data.warnings?.forEach((w: string) => toast.error(`⚠️ ${w}`));
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || "Restore failed"),
  });

  const backups: BackupFile[] = listData?.backups || [];

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "1100px", margin: "0 auto" }}>
      {/* Hidden import input */}
      <input
        ref={importRef} type="file" accept=".zip" style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importMutation.mutate(f);
          e.target.value = "";
        }}
      />

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div style={{ width: 44, height: 44, borderRadius: "var(--radius-lg)", background: "linear-gradient(135deg, #f97316, #ea580c)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DatabaseBackup size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Backup Manager</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", margin: 0 }}>Database · Media files · Config & secrets</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => { refetchList(); refetchStats(); }} disabled={listLoading}>
            <RefreshCw size={14} className={listLoading ? "animate-spin" : ""} /> Refresh
          </button>
          <button className="btn btn-secondary" onClick={() => importRef.current?.click()} disabled={importMutation.isPending} title="Upload a backup .zip from your device">
            {importMutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Importing...</> : <><Upload size={16} /> Import Backup</>}
          </button>
          <button id="create-backup-btn" className="btn btn-primary" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : <><Plus size={16} /> Create Backup Now</>}
          </button>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        {[
          { icon: <FileArchive size={20} />, label: "Total Backups",  value: statsLoading ? "..." : stats?.backup_count ?? 0,            sub: `${formatBytes(stats?.total_backup_size_mb ?? 0)} total`,    color: "#f97316" },
          { icon: <HardDrive   size={20} />, label: "Database Size",  value: statsLoading ? "..." : formatBytes(stats?.db_size_mb ?? 0),  sub: "SQLite / PostgreSQL",                                        color: "#3b82f6" },
          { icon: <FolderOpen  size={20} />, label: "Media Files",    value: statsLoading ? "..." : formatBytes(stats?.media_size_mb ?? 0), sub: "Uploads & attachments",                                    color: "#8b5cf6" },
          {
            icon: <Clock size={20} />, label: "Last Backup",
            value: stats?.latest_backup ? formatDistanceToNow(new Date(stats.latest_backup.created_at), { addSuffix: true }) : "Never",
            sub:   stats?.latest_backup?.name?.slice(0, 30) ?? "No backups yet",
            color: stats?.latest_backup ? "#22c55e" : "#ef4444",
          },
        ].map((card) => (
          <div key={card.label} className="card" style={{ padding: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
              <div style={{ color: card.color }}>{card.icon}</div>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{card.label}</span>
            </div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{card.value}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── In-progress banner ── */}
      {(createMutation.isPending || importMutation.isPending) && (
        <div style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.1), rgba(234,88,12,0.05))", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <Loader2 size={18} className="animate-spin" style={{ color: "#f97316", flexShrink: 0 }} />
          <div>
            <p style={{ fontWeight: 700, margin: 0, fontSize: "0.9rem" }}>{importMutation.isPending ? "Importing backup..." : "Creating backup..."}</p>
            <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "0.8rem" }}>{importMutation.isPending ? "Uploading and validating .zip file..." : "Compressing DB, media files, and config..."}</p>
          </div>
        </div>
      )}

      {/* ── Backup List ── */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "var(--space-4) var(--space-5)", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <Server size={16} style={{ color: "var(--text-muted)" }} />
            Backup Files
            {!listLoading && <span style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "999px", fontSize: "0.72rem", padding: "1px 8px", fontWeight: 600 }}>{backups.length}</span>}
          </h3>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>D:\saas\erp-backups\</span>
        </div>

        {listLoading ? (
          <div style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--text-muted)" }}>
            <Loader2 size={28} className="animate-spin" style={{ marginBottom: "var(--space-2)" }} />
            <p>Loading backups...</p>
          </div>
        ) : backups.length === 0 ? (
          <div style={{ padding: "var(--space-8)", textAlign: "center" }}>
            <DatabaseBackup size={44} style={{ color: "var(--text-muted)", marginBottom: "var(--space-3)" }} />
            <p style={{ fontWeight: 700, color: "var(--text-secondary)" }}>No backups yet</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "var(--space-4)" }}>Create your first backup or import an existing .zip file.</p>
            <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "center" }}>
              <button className="btn btn-secondary" onClick={() => importRef.current?.click()}><Upload size={16} /> Import Backup</button>
              <button className="btn btn-primary" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}><Plus size={16} /> Create First Backup</button>
            </div>
          </div>
        ) : (
          <div>
            {backups.map((backup, index) => (
              <div key={backup.name}
                style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3) var(--space-5)", borderBottom: index < backups.length - 1 ? "1px solid var(--border-subtle)" : "none", transition: "background var(--transition-fast)" }}
                className="hover:bg-hover"
              >
                {/* Icon */}
                <div style={{ width: 38, height: 38, borderRadius: "var(--radius-md)", background: index === 0 ? "rgba(34,197,94,0.1)" : "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {index === 0 ? <CheckCircle2 size={18} style={{ color: "#22c55e" }} /> : <FileArchive size={18} style={{ color: "var(--text-muted)" }} />}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.88rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{backup.name}</span>
                    {index === 0 && <span style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", fontSize: "0.65rem", fontWeight: 700, padding: "1px 6px", borderRadius: "999px", flexShrink: 0 }}>LATEST</span>}
                    {backup.name.includes("imported") && <span style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6", fontSize: "0.65rem", fontWeight: 700, padding: "1px 6px", borderRadius: "999px", flexShrink: 0 }}>IMPORTED</span>}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", gap: "var(--space-3)", marginTop: "2px" }}>
                    <span>{format(new Date(backup.created_at), "MMM d, yyyy · HH:mm")}</span>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(backup.created_at), { addSuffix: true })}</span>
                  </div>
                </div>

                {/* Size */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{formatBytes(backup.size_mb)}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>compressed</div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
                  <button className="btn btn-sm" style={{ padding: "6px 10px", background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }} onClick={() => setConfirmRestore(backup.name)} title="Restore this backup">
                    <RotateCcw size={14} />
                  </button>
                  <button className="btn btn-secondary btn-sm" style={{ padding: "6px 10px" }} onClick={() => handleDownload(backup.name)} disabled={downloadingFile === backup.name} title="Download (.zip)">
                    {downloadingFile === backup.name ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  </button>
                  <button className="btn btn-sm" style={{ padding: "6px 10px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }} onClick={() => setConfirmDelete(backup.name)} title="Delete backup">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Info Box ── */}
      <div style={{ marginTop: "var(--space-4)", padding: "var(--space-4)", background: "var(--bg-elevated)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
        <AlertTriangle size={16} style={{ color: "#f59e0b", flexShrink: 0, marginTop: "2px" }} />
        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          <strong>Backed up:</strong> SQLite DB · Media files · Designs · .env files · credentials.json · docker-compose · nginx.conf<br />
          <strong>Import:</strong> Click "Import Backup" to upload any <code style={{ background: "var(--bg-default)", padding: "1px 5px", borderRadius: "4px" }}>.zip</code> backup from your device — it will appear in the list and can be restored.<br />
          <strong>Auto-backup:</strong> Run <code style={{ background: "var(--bg-default)", padding: "1px 5px", borderRadius: "4px" }}>setup_scheduler.ps1</code> as Administrator for daily 2:00 AM automatic backups.
        </div>
      </div>

      {/* ── Delete Modal ── */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal modal-sm" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title" style={{ color: "#ef4444" }}><Trash2 size={18} style={{ display: "inline", marginRight: "8px" }} />Delete Backup</h3></div>
            <div className="modal-body">
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Permanently delete this backup?</p>
              <div style={{ background: "var(--bg-elevated)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", fontWeight: 700, fontSize: "0.85rem", wordBreak: "break-all", marginTop: "var(--space-2)" }}>{confirmDelete}</div>
              <p style={{ color: "#ef4444", fontSize: "0.82rem", marginTop: "var(--space-2)" }}>⚠️ This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn" style={{ background: "#ef4444", color: "white", border: "none" }} onClick={() => deleteMutation.mutate(confirmDelete)} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Restore Modal ── */}
      {confirmRestore && (
        <div className="modal-overlay" onClick={() => setConfirmRestore(null)}>
          <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title" style={{ color: "#3b82f6" }}><RotateCcw size={18} style={{ display: "inline", marginRight: "8px" }} />Restore Backup</h3></div>
            <div className="modal-body">
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Restore from:</p>
              <div style={{ background: "var(--bg-elevated)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", fontWeight: 700, fontSize: "0.85rem", wordBreak: "break-all", marginBottom: "var(--space-4)" }}>{confirmRestore}</div>

              <p style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "var(--space-2)" }}>What to restore:</p>
              {[
                { key: "restore_db",     label: "Database (db.sqlite3)",  desc: "Overwrites current database ⚠️" },
                { key: "restore_media",  label: "Media Files",            desc: "Restores all uploaded files" },
                { key: "restore_config", label: "Config (.env files)",    desc: "Restores secrets — use with care ⚠️" },
              ].map(({ key, label, desc }) => (
                <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)", marginBottom: "var(--space-3)", cursor: "pointer" }}>
                  <input type="checkbox" checked={restoreOpts[key as keyof typeof restoreOpts]} onChange={(e) => setRestoreOpts((o) => ({ ...o, [key]: e.target.checked }))} style={{ marginTop: "3px" }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{label}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{desc}</div>
                  </div>
                </label>
              ))}

              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "var(--radius-md)", padding: "var(--space-3)", marginTop: "var(--space-2)" }}>
                <p style={{ color: "#ef4444", fontSize: "0.82rem", margin: 0 }}>⚠️ Current data will be overwritten. A <code>.pre_restore_bak</code> copy is saved automatically.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmRestore(null)}>Cancel</button>
              <button className="btn" style={{ background: "#3b82f6", color: "white", border: "none" }}
                onClick={() => restoreMutation.mutate({ filename: confirmRestore, opts: restoreOpts })}
                disabled={restoreMutation.isPending || !Object.values(restoreOpts).some(Boolean)}>
                {restoreMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Restoring...</> : <><RotateCcw size={14} /> Restore Now</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
