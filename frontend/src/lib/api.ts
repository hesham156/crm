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
    // Let browser set the boundary
    delete config.headers["Content-Type"];
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
        const { data } = await axios.post(`${API_BASE}/api/auth/refresh/`, {
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

  logTime: (taskId: string, data: { duration: number; note?: string }) =>
    apiClient.post(`/tasks/tasks/${taskId}/time-log/`, data),

  tags: () => apiClient.get("/tasks/tags/"),
  
  createAutomation: (boardId: string, data: any) =>
    apiClient.post(`/tasks/boards/${boardId}/automations/`, data),
    
  updateAutomation: (id: string, data: any) =>
    apiClient.patch(`/tasks/automations/${id}/`, data),
    
  deleteAutomation: (id: string) =>
    apiClient.delete(`/tasks/automations/${id}/`),

  adminOverview: () => apiClient.get("/tasks/admin-overview/"),
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
