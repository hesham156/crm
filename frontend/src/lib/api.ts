import axios from "axios";
import Cookies from "js-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
apiClient.interceptors.request.use((config) => {
  const token = Cookies.get("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    // Must remove Content-Type so browser sets multipart/form-data with correct boundary.
    // In axios v1.x config.headers is an AxiosHeaders instance — use .delete() not delete operator.
    if (typeof config.headers.delete === "function") {
      config.headers.delete("Content-Type");
    } else {
      delete (config.headers as Record<string, unknown>)["Content-Type"];
    }
  }
  return config;
});

// Auto-refresh token on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    // Don't intercept 401s if we are already trying to login
    if (originalRequest.url?.includes("/auth/login/")) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refresh = Cookies.get("refresh_token");
        if (!refresh) throw new Error("No refresh token");
        const { data } = await apiClient.post("/auth/refresh/", {
          refresh,
        });
        Cookies.set("access_token", data.access, { expires: 1 });
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return apiClient(originalRequest);
      } catch {
        Cookies.remove("access_token");
        Cookies.remove("refresh_token");
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post("/auth/login/", { email, password }),
  logout: (refresh: string) =>
    apiClient.post("/auth/logout/", { refresh }),
  me: () => apiClient.get("/auth/me/"),
  updateMe: (data: unknown) => apiClient.patch("/auth/me/", data),
  changePassword: (data: { old_password: string; new_password: string }) =>
    apiClient.post("/auth/me/change-password/", data),
};

// ─── Users ────────────────────────────────────────────────────────────────
export const usersApi = {
  list: (params?: Record<string, unknown>) => apiClient.get("/auth/users/", { params }),
  get: (id: string) => apiClient.get(`/auth/users/${id}/`),
  create: (data: unknown) => apiClient.post("/auth/users/", data),
  update: (id: string, data: unknown) => apiClient.patch(`/auth/users/${id}/`, data),
  delete: (id: string) => apiClient.delete(`/auth/users/${id}/`),
  departments: () => apiClient.get("/auth/departments/"),
};

// ─── Tasks ────────────────────────────────────────────────────────────────
export const tasksApi = {
  boards: () => apiClient.get("/tasks/boards/"),
  board: (id: string) => apiClient.get(`/tasks/boards/${id}/`),
  createBoard: (data: unknown) => apiClient.post("/tasks/boards/", data),
  updateBoard: (id: string, data: unknown) => apiClient.patch(`/tasks/boards/${id}/`, data),
  deleteBoard: (id: string) => apiClient.delete(`/tasks/boards/${id}/`),

  columns: (boardId: string) => apiClient.get(`/tasks/boards/${boardId}/columns/`),
  createColumn: (boardId: string, data: unknown) =>
    apiClient.post(`/tasks/boards/${boardId}/columns/`, data),
  updateColumn: (id: string, data: unknown) => apiClient.patch(`/tasks/columns/${id}/`, data),
  deleteColumn: (id: string) => apiClient.delete(`/tasks/columns/${id}/`),

  tasks: (params?: Record<string, unknown>) => apiClient.get("/tasks/tasks/", { params }),
  task: (id: string) => apiClient.get(`/tasks/tasks/${id}/`),
  createTask: (data: unknown) => apiClient.post("/tasks/tasks/", data),
  updateTask: (id: string, data: unknown) => apiClient.patch(`/tasks/tasks/${id}/`, data),
  deleteTask: (id: string) => apiClient.delete(`/tasks/tasks/${id}/`),
  moveTask: (id: string, data: { column_id: string; position: number }) =>
    apiClient.post(`/tasks/tasks/${id}/move/`, data),

  comments: (taskId: string) => apiClient.get(`/tasks/tasks/${taskId}/comments/`),
  addComment: (taskId: string, body: string, mentions?: string[]) =>
    apiClient.post(`/tasks/tasks/${taskId}/comments/`, { body, mention_ids: mentions }),
  updateComment: (commentId: string, body: string) =>
    apiClient.patch(`/tasks/comments/${commentId}/`, { body }),
  deleteComment: (commentId: string) =>
    apiClient.delete(`/tasks/comments/${commentId}/`),

  archivedTasks: (params?: Record<string, unknown>) =>
    apiClient.get("/tasks/tasks/archived/", { params }),
  bulkAction: (taskIds: string[], action: string, payload?: Record<string, unknown>) =>
    apiClient.post("/tasks/tasks/bulk-action/", { task_ids: taskIds, action, payload }),
  workload: (boardId?: string) =>
    apiClient.get("/tasks/tasks/workload/", { params: boardId ? { board: boardId } : {} }),
  spawnRecurrence: (taskId: string) =>
    apiClient.post(`/tasks/tasks/${taskId}/spawn-recurrence/`),

  customFields: (boardId: string) =>
    apiClient.get(`/tasks/boards/${boardId}/custom-fields/`),
  createCustomField: (boardId: string, data: unknown) =>
    apiClient.post(`/tasks/boards/${boardId}/custom-fields/`, data),
  updateCustomField: (fieldId: string, data: unknown) =>
    apiClient.patch(`/tasks/custom-fields/${fieldId}/`, data),
  deleteCustomField: (fieldId: string) =>
    apiClient.delete(`/tasks/custom-fields/${fieldId}/`),

  sprints: (boardId: string) =>
    apiClient.get(`/tasks/boards/${boardId}/sprints/`),
  createSprint: (boardId: string, data: unknown) =>
    apiClient.post(`/tasks/boards/${boardId}/sprints/`, data),
  updateSprint: (sprintId: string, data: unknown) =>
    apiClient.patch(`/tasks/sprints/${sprintId}/`, data),
  deleteSprint: (sprintId: string) =>
    apiClient.delete(`/tasks/sprints/${sprintId}/`),

  logTime: (taskId: string, data: { duration: number; note?: string }) =>
    apiClient.post(`/tasks/tasks/${taskId}/time-log/`, data),

  toggleTimer: (taskId: string, action: "start" | "stop") =>
    apiClient.post(`/tasks/tasks/${taskId}/timer/`, { action }),

  attachments: (taskId: string) => apiClient.get(`/tasks/tasks/${taskId}/attachments/`),
  uploadAttachment: (taskId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("attachment_type", "file");
    return apiClient.post(`/tasks/tasks/${taskId}/attachments/`, form);
  },
  addLinkAttachment: (taskId: string, url: string, filename?: string) =>
    apiClient.post(`/tasks/tasks/${taskId}/attachments/`, {
      attachment_type: "link",
      external_url: url,
      filename: filename || url,
    }),
  deleteAttachment: (attachmentId: string) =>
    apiClient.delete(`/tasks/attachments/${attachmentId}/`),

  tags: () => apiClient.get("/tasks/tags/"),
  
  createAutomation: (boardId: string, data: any) =>
    apiClient.post(`/tasks/boards/${boardId}/automations/`, data),
    
  updateAutomation: (id: string, data: any) =>
    apiClient.patch(`/tasks/automations/${id}/`, data),
    
  deleteAutomation: (id: string) =>
    apiClient.delete(`/tasks/automations/${id}/`),

  adminOverview: () => apiClient.get("/tasks/admin-overview/"),
  taskTracker: (params?: Record<string, unknown>) => apiClient.get("/tasks/tracker/", { params }),
};

// ─── CRM ──────────────────────────────────────────────────────────────────
export const crmApi = {
  customers: (params?: Record<string, unknown>) =>
    apiClient.get("/crm/customers/", { params }),
  customer: (id: string) => apiClient.get(`/crm/customers/${id}/`),
  createCustomer: (data: unknown) => apiClient.post("/crm/customers/", data),
  updateCustomer: (id: string, data: unknown) =>
    apiClient.patch(`/crm/customers/${id}/`, data),
};

// ─── Sales ────────────────────────────────────────────────────────────────
export const salesApi = {
  jobs: (params?: Record<string, unknown>) => apiClient.get("/sales/jobs/", { params }),
  job: (id: string) => apiClient.get(`/sales/jobs/${id}/`),
  createJob: (data: unknown) => apiClient.post("/sales/jobs/", data),
  updateJob: (id: string, data: unknown) => apiClient.patch(`/sales/jobs/${id}/`, data),
  quotations: (jobId: string) => apiClient.get(`/sales/jobs/${jobId}/quotations/`),
  createQuotation: (jobId: string, data: unknown) => apiClient.post(`/sales/jobs/${jobId}/quotations/`, data),
  invoices: (params?: Record<string, unknown>) => apiClient.get(`/sales/invoices/`, { params }),
  createInvoice: (data: unknown) => apiClient.post(`/sales/invoices/`, data),
};

// ─── Notifications ────────────────────────────────────────────────────────
export const notificationsApi = {
  list: (params?: Record<string, unknown>) => apiClient.get("/notifications/", { params }),
  unreadCount: () => apiClient.get("/notifications/unread-count/"),
  markRead: (ids?: string[]) => apiClient.post("/notifications/mark-read/", { ids }),
};

// ─── Analytics ────────────────────────────────────────────────────────────
export const analyticsApi = {
  dashboard: () => apiClient.get("/analytics/dashboard/"),
};

// ─── Design ───────────────────────────────────────────────────────────────
export const designApi = {
  submissions: (params?: Record<string, unknown>) => apiClient.get("/design/submissions/", { params }),
  createSubmission: (data: FormData | unknown) => apiClient.post("/design/submissions/", data),
  submitForReview: (id: string) => apiClient.post(`/design/submissions/${id}/submit/`),
  approve: (id: string, notes?: string) => apiClient.post(`/design/submissions/${id}/approve/`, { notes }),
  reject: (id: string, notes?: string) => apiClient.post(`/design/submissions/${id}/reject/`, { notes }),
};

// ─── Production ───────────────────────────────────────────────────────────
export const productionApi = {
  stages: (params?: Record<string, unknown>) => apiClient.get("/production/stages/", { params }),
  createStage: (data: unknown) => apiClient.post("/production/stages/", data),
  updateStage: (id: string, data: unknown) => apiClient.patch(`/production/stages/${id}/`, data),
  startStage: (id: string) => apiClient.post(`/production/stages/${id}/start/`),
  completeStage: (id: string) => apiClient.post(`/production/stages/${id}/complete/`),
};

// ─── Inventory ────────────────────────────────────────────────────────────
export const inventoryApi = {
  categories: () => apiClient.get("/inventory/categories/"),
  items: (params?: Record<string, unknown>) => apiClient.get("/inventory/items/", { params }),
  createItem: (data: unknown) => apiClient.post("/inventory/items/", data),
  transactions: (params?: Record<string, unknown>) => apiClient.get("/inventory/transactions/", { params }),
  createTransaction: (data: unknown) => apiClient.post("/inventory/transactions/", data),
  lowStock: () => apiClient.get("/inventory/reports/low-stock/"),
};

// ─── Backup ───────────────────────────────────────────────
export const backupApi = {
  list:    () => apiClient.get("/backup/"),
  stats:   () => apiClient.get("/backup/stats/"),
  create:  () => apiClient.post("/backup/create/"),
  delete:  (filename: string) => apiClient.delete(`/backup/${filename}/`),
  restore: (filename: string, opts: { restore_db?: boolean; restore_media?: boolean; restore_config?: boolean }) =>
    apiClient.post(`/backup/${filename}/restore/`, opts),
  import:  (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post("/backup/import/", form);
  },
};
