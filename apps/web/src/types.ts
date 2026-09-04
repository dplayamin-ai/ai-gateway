export type Menu = '대시보드' | '인증키 신청 관리' | 'AI Model 관리' | 'MCP 관리' | 'API 사용이력' | '최근 활동' | '시스템 설정';

export interface DashboardData {
  activeKeys: number;
  pendingKeyRequests: number;
  activeModels: number;
  activeMcps: number;
  todayUsage: number;
  tenantStats: Array<{ tenant_id: string; tenant_name: string; provider_name: string; api_key_count: number; model_count: number; api_call_count: number }>;
}

export interface ApiKeyRequest {
  id: string;
  applicant_name: string;
  applicant_email?: string;
  system_name: string;
  tenant_names?: string;
  provider_names?: string;
  model_aliases?: string;
  reason?: string;
  rejection_reason?: string | null;
  status: string;
  created_at: string;
}

export interface InformationSystem {
  id: string;
  tenant_id: string;
  name: string;
  tenant_name: string;
  tenants?: Array<{
    id: string;
    code: string;
    name: string;
    provider?: { id: string; code: string; name: string };
    models?: Array<{ id: string; alias: string; provider_model: string }>;
  }>;
}

export interface ModelRecord {
  id: string;
  alias: string;
  provider: string;
  provider_id?: string;
  provider_model: string;
  status: string;
  updated_at: string;
}

export interface Provider {
  id: string;
  code: string;
  name: string;
}

export interface McpRecord {
  id: string;
  code?: string;
  name: string;
  endpoint: string;
  has_bearer_token?: boolean;
}

export interface UsageLog {
  id: string;
  trace_id: string;
  tenant_id: string;
  agent_id: string | null;
  request_type: string;
  resource_name: string;
  status: string;
  error_code: string | null;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number | null;
  requested_at: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityRecord {
  action: string;
  resource_type: string;
  details: Record<string, unknown>;
  created_at: string;
  actor_name: string | null;
}
