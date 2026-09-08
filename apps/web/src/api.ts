import type { ActivityRecord, ApiKeyRequest, DashboardData, InformationSystem, McpRecord, ModelRecord, Provider, UsageLog } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://10.10.10.59:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? `API 요청 실패 (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const adminApi = {
  dashboard: (informationSystemId?: string, tenantId?: string) => request<DashboardData>(`/admin/dashboard?informationSystemId=${encodeURIComponent(informationSystemId ?? '')}&tenantId=${encodeURIComponent(tenantId ?? '')}`),
  activities: () => request<ActivityRecord[]>('/admin/activities'),
  apiKeyRequests: () => request<ApiKeyRequest[]>('/admin/api-key-requests'),
  informationSystems: () => request<InformationSystem[]>('/admin/information-systems'),
  createApiKeyRequest: (requestData: { applicantName: string; applicantEmail: string; informationSystemId: string; tenantId: string; modelIds: string[]; reason: string }) => request<ApiKeyRequest>('/admin/api-key-requests', { method: 'POST', body: JSON.stringify(requestData) }),
  reviewApiKeyRequest: (id: string, decision: 'APPROVED' | 'REJECTED', rejectionReason?: string) => request<{ id: string; status: string; token?: string; expiresAt?: string }>(`/admin/api-key-requests/${id}/review`, { method: 'PUT', body: JSON.stringify({ decision, rejectionReason }) }),
  deleteApiKeyRequest: (id: string) => request<{ id: string; status: string }>(`/admin/api-key-requests/${id}`, { method: 'DELETE' }),
  models: () => request<ModelRecord[]>('/admin/models'),
  providers: () => request<Provider[]>('/admin/providers'),
  createModel: (model: { alias: string; providerId: string; providerModel: string }) => request<ModelRecord>('/admin/models', { method: 'POST', body: JSON.stringify(model) }),
  deleteModel: (id: string) => request<{ id: string; status: string }>(`/admin/models/${id}`, { method: 'DELETE' }),
  updateModel: (id: string, model: { alias: string; providerId: string; providerModel: string }) => request<ModelRecord>(`/admin/models/${id}`, { method: 'PUT', body: JSON.stringify(model) }),
  mcps: () => request<McpRecord[]>('/admin/mcps'),
  createMcp: (mcp: { code: string; name: string; endpoint: string; bearerToken?: string }) => request<McpRecord>('/admin/mcps', { method: 'POST', body: JSON.stringify(mcp) }),
  updateMcp: (id: string, mcp: { code: string; name: string; endpoint: string; bearerToken?: string }) => request<McpRecord>(`/admin/mcps/${id}`, { method: 'PUT', body: JSON.stringify(mcp) }),
  checkMcp: (id: string) => request<{ code: string; response?: { result?: { tools?: Array<Record<string, unknown>> } }; tools?: Array<Record<string, unknown>> }>(`/admin/mcps/${id}/connection-check`, { method: 'POST' }),
  deleteMcp: (id: string) => request<{ id: string; status: string }>(`/admin/mcps/${id}`, { method: 'DELETE' }),
  usageLogs: (from?: string, to?: string) => request<UsageLog[]>(`/admin/usage-logs?from=${encodeURIComponent(from ?? '')}&to=${encodeURIComponent(to ?? '')}`),
  settings: () => request<Record<string, string>>('/admin/settings'),
  updateSettings: (values: Record<string, string>) => request<Record<string, string>>('/admin/settings', { method: 'PUT', body: JSON.stringify(values) }),
};
