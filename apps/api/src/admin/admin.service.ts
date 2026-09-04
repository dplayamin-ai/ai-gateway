import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AdminRepository } from './admin.repository.js';
import { createHash, randomBytes } from 'node:crypto';

@Injectable()
export class AdminService {
  constructor(private readonly repository: AdminRepository) {}

  async health(): Promise<{ status: string; database: string }> {
    await this.repository.query('SELECT 1');
    return { status: 'ok', database: 'connected' };
  }

  async dashboard(informationSystemId?: string, tenantId?: string): Promise<Record<string, unknown>> {
    const systemFilter = informationSystemId?.trim() || null;
    const tenantFilter = tenantId?.trim() || null;
    const [keys, pendingRequests, models, mcps, usage] = await Promise.all([
      this.repository.query<{ count: string }>("SELECT count(*) FROM api_keys k WHERE k.status = 'ACTIVE' AND ($1::uuid IS NULL OR k.information_system_id = $1) AND ($2::uuid IS NULL OR k.tenant_id = $2)", [systemFilter, tenantFilter]),
      this.repository.query<{ count: string }>("SELECT count(*) FROM api_key_requests WHERE status = 'PENDING'"),
      this.repository.query<{ count: string }>(`SELECT count(DISTINCT m.id)
        FROM model_aliases m
        LEFT JOIN tenants t ON t.provider_id = m.provider_id
        LEFT JOIN information_system_tenants st ON st.tenant_id = t.id
        WHERE m.status = 'ACTIVE'
          AND ($1::uuid IS NULL OR st.information_system_id = $1)
          AND ($2::uuid IS NULL OR t.id = $2)`, [systemFilter, tenantFilter]),
      this.repository.query<{ count: string }>("SELECT count(*) FROM mcp_servers WHERE status = 'ACTIVE'"),
      this.repository.query<{ count: string }>('SELECT count(*) FROM usage_logs u WHERE u.requested_at >= current_date AND ($1::uuid IS NULL OR u.information_system_id = $1) AND ($2::uuid IS NULL OR u.tenant_id = $2)', [systemFilter, tenantFilter]),
    ]);
    const tenantStats = await this.repository.query(
      `SELECT t.id AS tenant_id, t.name AS tenant_name, p.name AS provider_name,
              (SELECT count(DISTINCT k.id)
               FROM api_keys k
               JOIN api_key_tenants akt ON akt.api_key_id = k.id AND akt.tenant_id = t.id
               WHERE k.status = 'ACTIVE'
                 AND ($1::uuid IS NULL OR k.information_system_id = $1))::int AS api_key_count,
              (SELECT count(*) FROM model_aliases m WHERE m.provider_id = t.provider_id AND m.status = 'ACTIVE')::int AS model_count,
              (SELECT count(*) FROM usage_logs u WHERE u.tenant_id = t.id AND ($1::uuid IS NULL OR u.information_system_id = $1))::int AS api_call_count
       FROM tenants t
       JOIN providers p ON p.id = t.provider_id
       JOIN information_system_tenants st ON st.tenant_id = t.id
       WHERE ($1::uuid IS NULL OR st.information_system_id = $1)
         AND ($2::uuid IS NULL OR t.id = $2)
       ORDER BY t.name`,
      [systemFilter, tenantFilter],
    );
    return {
      activeKeys: Number(keys.rows[0].count),
      pendingKeyRequests: Number(pendingRequests.rows[0].count),
      activeModels: Number(models.rows[0].count),
      activeMcps: Number(mcps.rows[0].count),
      todayUsage: Number(usage.rows[0].count),
      informationSystemId: systemFilter,
      tenantId: tenantFilter,
      tenantStats: tenantStats.rows,
    };
  }

  async apiKeyRequests(): Promise<unknown[]> {
    const result = await this.repository.query(
      `SELECT r.id, r.applicant_name, r.applicant_email, s.name AS system_name,
              r.tenant_id, r.information_system_id, r.reason, r.status, r.rejection_reason,
              to_char(r.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') AS created_at,
              COALESCE((SELECT string_agg(DISTINCT t.name, ', ' ORDER BY t.name)
                FROM api_key_request_tenants art JOIN tenants t ON t.id = art.tenant_id
                WHERE art.request_id = r.id), t.name) AS tenant_names,
              COALESCE((SELECT string_agg(DISTINCT p.name, ', ' ORDER BY p.name)
                FROM api_key_request_tenants art JOIN tenants t ON t.id = art.tenant_id
                JOIN providers p ON p.id = t.provider_id
                WHERE art.request_id = r.id), p.name) AS provider_names,
              COALESCE((SELECT string_agg(DISTINCT m.alias, ', ' ORDER BY m.alias)
                FROM api_key_request_resources arr JOIN model_aliases m ON m.id = arr.resource_id
                WHERE arr.request_id = r.id AND arr.resource_type = 'MODEL'), '') AS model_aliases
       FROM api_key_requests r
       JOIN information_systems s ON s.id = r.information_system_id
       JOIN tenants t ON t.id = r.tenant_id
       JOIN providers p ON p.id = t.provider_id
       ORDER BY r.created_at DESC`,
    );
    return result.rows;
  }

  async deleteApiKeyRequest(id: string): Promise<{ id: string; status: string }> {
    const request = await this.repository.query<{ status: string }>('SELECT status FROM api_key_requests WHERE id = $1', [id]);
    if (request.rows.length === 0) throw new NotFoundException('인증키 신청을 찾을 수 없습니다.');
    if (request.rows[0].status === 'APPROVED') throw new BadRequestException('승인된 신청은 삭제할 수 없습니다.');
    await this.repository.query('DELETE FROM api_key_request_resources WHERE request_id = $1', [id]);
    await this.repository.query('DELETE FROM api_key_request_tenants WHERE request_id = $1', [id]);
    await this.repository.query('DELETE FROM api_key_requests WHERE id = $1', [id]);
    return { id, status: 'DELETED' };
  }

  async reviewApiKeyRequest(
    id: string,
    body: { decision?: string; rejectionReason?: string },
  ): Promise<unknown> {
    const decision = typeof body.decision === 'string' ? body.decision.toUpperCase() : '';
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      throw new BadRequestException('승인 또는 거절을 선택해야 합니다.');
    }
    const request = await this.repository.query<{ tenant_id: string; information_system_id: string; status: string }>(
      'SELECT tenant_id, information_system_id, status FROM api_key_requests WHERE id = $1',
      [id],
    );
    if (request.rows.length === 0) throw new NotFoundException('인증키 신청을 찾을 수 없습니다.');
    if (request.rows[0].status !== 'PENDING') throw new BadRequestException('대기 중인 신청만 검토할 수 있습니다.');

    if (decision === 'REJECTED') {
      const rejectionReason = typeof body.rejectionReason === 'string' ? body.rejectionReason.trim() : '';
      await this.repository.query(
        `UPDATE api_key_requests SET status = 'REJECTED', rejection_reason = $1, reviewed_at = now(), updated_at = now() WHERE id = $2`,
        [rejectionReason || null, id],
      );
      await this.repository.query(
        `INSERT INTO audit_logs (action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4::jsonb)`,
        ['인증키 신청 거절', 'API_KEY_REQUEST', id, JSON.stringify({ rejectionReason })],
      );
      return { id, status: 'REJECTED' };
    }

    const token = `agw_${randomBytes(32).toString('hex')}`;
    const keyPrefix = token.slice(0, 12);
    const keyHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    await this.repository.query(
      `UPDATE api_key_requests SET status = 'APPROVED', reviewed_at = now(), updated_at = now() WHERE id = $1`,
      [id],
    );
    const issuedKey = await this.repository.query<{ id: string }>(
      `INSERT INTO api_keys (request_id, tenant_id, information_system_id, key_prefix, key_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [id, request.rows[0].tenant_id, request.rows[0].information_system_id, keyPrefix, keyHash, expiresAt],
    );
    await this.repository.query(
      `INSERT INTO api_key_resources (api_key_id, resource_type, resource_id)
       SELECT $1, resource_type, resource_id FROM api_key_request_resources WHERE request_id = $2`,
      [issuedKey.rows[0].id, id],
    );
    await this.repository.query(
      `INSERT INTO api_key_tenants (api_key_id, tenant_id)
       SELECT $1, tenant_id FROM api_key_request_tenants WHERE request_id = $2`,
      [issuedKey.rows[0].id, id],
    );
    await this.repository.query(
      `INSERT INTO audit_logs (action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4::jsonb)`,
      ['인증키 신청 승인 및 발급', 'API_KEY_REQUEST', id, JSON.stringify({ keyPrefix, expiresAt })],
    );
    return { id, status: 'APPROVED', token, expiresAt };
  }

  async informationSystems(): Promise<unknown[]> {
    const result = await this.repository.query(
      `SELECT s.id, s.name,
              COALESCE(string_agg(DISTINCT t.name, ', ' ORDER BY t.name), '') AS tenant_name,
              COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
                'id', t.id, 'code', t.code, 'name', t.name,
                'provider', jsonb_build_object('id', p.id, 'name', p.name, 'code', p.code),
                'models', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'alias', m.alias, 'provider_model', m.provider_model) ORDER BY m.alias)
                  FROM model_aliases m
                  WHERE m.provider_id = t.provider_id AND m.status = 'ACTIVE'), '[]'::jsonb)
              )) FILTER (WHERE t.id IS NOT NULL), '[]'::jsonb) AS tenants
       FROM information_systems s
       LEFT JOIN information_system_tenants st ON st.information_system_id = s.id
       LEFT JOIN tenants t ON t.id = st.tenant_id
       LEFT JOIN providers p ON p.id = t.provider_id AND p.status = 'ACTIVE'
       WHERE s.status = 'ACTIVE'
       GROUP BY s.id ORDER BY s.name`,
    );
    return result.rows;
  }

  async createApiKeyRequest(
    body: { applicantName?: string; applicantEmail?: string; informationSystemId?: string; tenantId?: string; reason?: string; modelIds?: string[]; mcpIds?: string[] },
  ): Promise<unknown> {
    const applicantName = typeof body.applicantName === 'string' ? body.applicantName.trim() : '';
    const applicantEmail = typeof body.applicantEmail === 'string' ? body.applicantEmail.trim() : '';
    const informationSystemId = typeof body.informationSystemId === 'string' ? body.informationSystemId.trim() : '';
    const requestedTenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const modelIds = Array.isArray(body.modelIds) ? [...new Set(body.modelIds.filter((id): id is string => typeof id === 'string' && Boolean(id.trim())))] : [];
    if (!applicantName || !applicantEmail || !informationSystemId || modelIds.length === 0) {
      throw new BadRequestException('신청자명, 이메일, 정보시스템, 신청 Model Alias를 하나 이상 선택해야 합니다.');
    }
    const system = await this.repository.query<{ tenant_id: string }>(
      `SELECT t.id AS tenant_id
       FROM information_systems s
       JOIN information_system_tenants st ON st.information_system_id = s.id
       JOIN tenants t ON t.id = st.tenant_id
       JOIN model_aliases m ON m.provider_id = t.provider_id AND m.status = 'ACTIVE'
       JOIN unnest($3::uuid[]) AS requested_model(id) ON requested_model.id = m.id
       WHERE s.id = $1 AND s.status = 'ACTIVE'
        AND ($2::uuid IS NULL OR t.id = $2::uuid)
       GROUP BY t.id
       HAVING count(DISTINCT m.id) > 0
       LIMIT 1`,
      [informationSystemId, requestedTenantId || null, modelIds],
    );
    const selectedTenants = await this.repository.query<{ tenant_id: string }>(
      `SELECT DISTINCT t.id AS tenant_id
       FROM information_systems s
       JOIN information_system_tenants st ON st.information_system_id = s.id
       JOIN tenants t ON t.id = st.tenant_id
       JOIN model_aliases m ON m.provider_id = t.provider_id AND m.status = 'ACTIVE'
       WHERE s.id = $1 AND m.id = ANY($2::uuid[])`,
      [informationSystemId, modelIds],
    );
    if (selectedTenants.rows.length === 0) throw new BadRequestException('선택한 정보시스템에서 사용할 수 있는 Model Alias가 없습니다.');
    const validModels = await this.repository.query<{ count: string }>(
      `SELECT count(DISTINCT m.id)::int AS count
       FROM information_systems s
       JOIN information_system_tenants st ON st.information_system_id = s.id
       JOIN tenants t ON t.id = st.tenant_id
       JOIN model_aliases m ON m.provider_id = t.provider_id AND m.status = 'ACTIVE'
       WHERE s.id = $1 AND m.id = ANY($2::uuid[])`,
      [informationSystemId, modelIds],
    );
    if (Number(validModels.rows[0].count) !== modelIds.length) throw new BadRequestException('선택한 Model Alias 중 정보시스템에서 사용할 수 없는 항목이 있습니다.');
    const mcpIds = Array.isArray(body.mcpIds) ? body.mcpIds.filter((id): id is string => typeof id === 'string') : [];
    const result = await this.repository.query(
      `INSERT INTO api_key_requests (tenant_id, information_system_id, applicant_name, applicant_email, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, applicant_name, applicant_email, information_system_id, reason, status, created_at`,
      [system.rows[0].tenant_id, informationSystemId, applicantName, applicantEmail, reason || null],
    );
    await this.repository.query(
      `INSERT INTO audit_logs (action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4::jsonb)`,
      ['인증키 신청', 'API_KEY_REQUEST', result.rows[0].id, JSON.stringify({ applicantName, applicantEmail, informationSystemId, tenantId: system.rows[0].tenant_id, modelIds, reason })],
    );
    for (const resourceId of modelIds) {
      await this.repository.query(
        `INSERT INTO api_key_request_resources (request_id, resource_type, resource_id)
         SELECT $1, 'MODEL', m.id FROM model_aliases m
         WHERE m.id = $2 AND m.status = 'ACTIVE'`,
        [result.rows[0].id, resourceId],
      );
    }
    for (const tenant of selectedTenants.rows) {
      await this.repository.query(
        `INSERT INTO api_key_request_tenants (request_id, tenant_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [result.rows[0].id, tenant.tenant_id],
      );
    }
    for (const resourceId of mcpIds) {
      await this.repository.query(
        `INSERT INTO api_key_request_resources (request_id, resource_type, resource_id)
         SELECT $1, 'MCP', id FROM mcp_servers WHERE id = $2 AND status = 'ACTIVE'
         ON CONFLICT DO NOTHING`,
        [result.rows[0].id, resourceId],
      );
    }
    return result.rows[0];
  }

  async models(): Promise<unknown[]> {
    const result = await this.repository.query(
      `SELECT m.id, m.alias, m.provider_id, p.name AS provider, m.provider_model, m.status, m.updated_at,
             (SELECT count(*) FROM tenants t WHERE t.provider_id = m.provider_id AND t.status = 'ACTIVE')::int AS tenant_count
       FROM model_aliases m JOIN providers p ON p.id = m.provider_id
       WHERE m.status = 'ACTIVE'
       ORDER BY m.alias`,
    );
    return result.rows;
  }

  async providers(): Promise<unknown[]> {
    const result = await this.repository.query(
      `SELECT id, code, name FROM providers
       WHERE status = 'ACTIVE' ORDER BY name`,
    );
    return result.rows;
  }

  async tenantProviders(tenantId: string): Promise<unknown[]> {
    const result = await this.repository.query(
      `SELECT p.id, p.code, p.name, t.endpoint, t.api_key_ciphertext, t.status
       FROM tenants t JOIN providers p ON p.id = t.provider_id
       WHERE t.id = $1`,
      [tenantId],
    );
    return result.rows;
  }

  async tenantModels(tenantId: string): Promise<unknown[]> {
    const result = await this.repository.query(
      `SELECT m.id, m.alias, m.provider_id, p.name AS provider, m.provider_model, t.status
       FROM tenants t JOIN model_aliases m ON m.provider_id = t.provider_id
       JOIN providers p ON p.id = m.provider_id
       WHERE t.id = $1 AND m.status = 'ACTIVE'
       ORDER BY m.alias`,
      [tenantId],
    );
    return result.rows;
  }

  async createModel(body: { alias?: string; providerId?: string; providerModel?: string }): Promise<unknown> {
    const alias = typeof body.alias === 'string' ? body.alias.trim() : '';
    const providerModel = typeof body.providerModel === 'string' ? body.providerModel.trim() : '';
    const providerId = typeof body.providerId === 'string' ? body.providerId.trim() : '';
    if (!alias || !providerModel || !providerId) {
      throw new BadRequestException('Alias, Provider, 실제 Model은 필수입니다.');
    }

    const existing = await this.repository.query('SELECT id FROM model_aliases WHERE alias = $1', [alias]);
    if (existing.rows.length > 0) throw new ConflictException(`이미 사용 중인 Model Alias입니다: ${alias}`);

    const provider = await this.repository.query('SELECT id FROM providers WHERE id = $1 AND status = $2', [providerId, 'ACTIVE']);
    if (provider.rows.length === 0) throw new BadRequestException('유효하지 않은 Provider입니다.');

    const result = await this.repository.query(
      `INSERT INTO model_aliases (alias, provider_id, provider_model)
       VALUES ($1, $2, $3)
       RETURNING id, alias, provider_id, provider_model, status, created_at, updated_at`,
      [alias, providerId, providerModel],
    );
    await this.repository.query(
      `INSERT INTO audit_logs (action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4::jsonb)`,
      ['AI Model 등록', 'MODEL_ALIAS', result.rows[0].id, JSON.stringify({ alias, providerModel })],
    );
    return result.rows[0];
  }

  async deleteModel(id: string): Promise<{ id: string; status: string }> {
    const result = await this.repository.query<{ id: string }>(
      `UPDATE model_aliases
       SET status = 'INACTIVE', updated_at = now()
       WHERE id = $1 AND status = 'ACTIVE'
       RETURNING id`,
      [id],
    );
    if (result.rows.length === 0) throw new NotFoundException('삭제할 AI Model을 찾을 수 없습니다.');

    await this.repository.query(
      `INSERT INTO audit_logs (action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4::jsonb)`,
      ['AI Model 삭제', 'MODEL_ALIAS', id, JSON.stringify({ status: 'INACTIVE' })],
    );
    return { id, status: 'INACTIVE' };
  }

  async updateModel(
    id: string,
    body: { alias?: string; providerId?: string; providerModel?: string },
  ): Promise<unknown> {
    const alias = body.alias?.trim();
    const providerModel = body.providerModel?.trim();
    const providerId = body.providerId?.trim();
    if (!alias || !providerModel || !providerId) {
      throw new BadRequestException('Alias, Provider, 실제 Model은 필수입니다.');
    }
    const existing = await this.repository.query(
      'SELECT id FROM model_aliases WHERE alias = $1 AND id <> $2',
      [alias, id],
    );
    if (existing.rows.length > 0) throw new ConflictException(`이미 사용 중인 Model Alias입니다: ${alias}`);
    const provider = await this.repository.query(
      'SELECT id FROM providers WHERE id = $1 AND status = $2',
      [providerId, 'ACTIVE'],
    );
    if (provider.rows.length === 0) throw new BadRequestException('유효하지 않은 Provider입니다.');
    const result = await this.repository.query(
      `UPDATE model_aliases SET alias = $1, provider_id = $2, provider_model = $3, updated_at = now()
       WHERE id = $4 AND status = 'ACTIVE'
       RETURNING id, alias, provider_id, provider_model, status, created_at, updated_at`,
      [alias, providerId, providerModel, id],
    );
    if (result.rows.length === 0) throw new NotFoundException('수정할 AI Model을 찾을 수 없습니다.');
    await this.repository.query(
      `INSERT INTO audit_logs (action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4::jsonb)`,
      ['AI Model 수정', 'MODEL_ALIAS', id, JSON.stringify({ alias, providerId, providerModel })],
    );
    return result.rows[0];
  }

  async mcps(): Promise<unknown[]> {
    const result = await this.repository.query(
      `SELECT m.id, m.code, m.name, m.network_type, m.endpoint, m.status,
              (m.bearer_token IS NOT NULL AND m.bearer_token <> '') AS has_bearer_token,
              count(t.id)::int AS tool_count
       FROM mcp_servers m LEFT JOIN mcp_tools t ON t.mcp_server_id = m.id
       WHERE m.status = 'ACTIVE'
       GROUP BY m.id ORDER BY m.name`,
    );
    return result.rows;
  }

  async createMcp(body: { code?: string; name?: string; endpoint?: string; networkType?: string; bearerToken?: string }): Promise<unknown> {
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
    const networkType = typeof body.networkType === 'string' ? body.networkType.trim().toUpperCase() : null;
    const bearerToken = typeof body.bearerToken === 'string' ? body.bearerToken.trim() : null;
    if (!code || !name || !endpoint) {
      throw new BadRequestException('Code, MCP 이름, Endpoint는 필수입니다.');
    }
    if (networkType !== null && !['INTERNAL', 'EXTERNAL'].includes(networkType)) {
      throw new BadRequestException('연결 유형은 INTERNAL 또는 EXTERNAL이어야 합니다.');
    }
    const existing = await this.repository.query('SELECT id FROM mcp_servers WHERE code = $1', [code]);
    if (existing.rows.length > 0) throw new ConflictException(`이미 사용 중인 MCP Code입니다: ${code}`);
    const result = await this.repository.query(
      `INSERT INTO mcp_servers (code, name, endpoint, network_type, bearer_token)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, code, name, endpoint, network_type, status, created_at, updated_at`,
      [code, name, endpoint, networkType, bearerToken || null],
    );
    await this.repository.query(
      `INSERT INTO audit_logs (action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4::jsonb)`,
      ['MCP 등록', 'MCP_SERVER', result.rows[0].id, JSON.stringify({ code, name, endpoint, networkType })],
    );
    return result.rows[0];
  }

  async updateMcp(
    id: string,
    body: { code?: string; name?: string; endpoint?: string; networkType?: string; bearerToken?: string },
  ): Promise<unknown> {
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
    const networkType = typeof body.networkType === 'string' ? body.networkType.trim().toUpperCase() : null;
    const bearerToken = typeof body.bearerToken === 'string' ? body.bearerToken.trim() : null;
    if (!code || !name || !endpoint) {
      throw new BadRequestException('Code, MCP 이름, Endpoint는 필수입니다.');
    }
    if (networkType !== null && !['INTERNAL', 'EXTERNAL'].includes(networkType)) {
      throw new BadRequestException('연결 유형은 INTERNAL 또는 EXTERNAL이어야 합니다.');
    }
    const existing = await this.repository.query('SELECT id FROM mcp_servers WHERE code = $1 AND id <> $2', [code, id]);
    if (existing.rows.length > 0) throw new ConflictException(`이미 사용 중인 MCP Code입니다: ${code}`);
    const result = await this.repository.query(
      `UPDATE mcp_servers
       SET code = $1, name = $2, endpoint = $3, network_type = $4, bearer_token = $5, updated_at = now()
       WHERE id = $6 AND status = 'ACTIVE'
       RETURNING id, code, name, endpoint, network_type, status, created_at, updated_at`,
      [code, name, endpoint, networkType, bearerToken || null, id],
    );
    if (result.rows.length === 0) throw new NotFoundException('수정할 MCP를 찾을 수 없습니다.');
    await this.repository.query(
      `INSERT INTO audit_logs (action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4::jsonb)`,
      ['MCP 수정', 'MCP_SERVER', id, JSON.stringify({ code, name, endpoint, networkType })],
    );
    return result.rows[0];
  }

  async deleteMcp(id: string): Promise<{ id: string; status: string }> {
    const result = await this.repository.query<{ id: string }>(
      `UPDATE mcp_servers SET status = 'INACTIVE', updated_at = now()
       WHERE id = $1 AND status = 'ACTIVE' RETURNING id`,
      [id],
    );
    if (result.rows.length === 0) throw new NotFoundException('삭제할 MCP를 찾을 수 없습니다.');
    await this.repository.query(
      `INSERT INTO audit_logs (action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4::jsonb)`,
      ['MCP 삭제', 'MCP_SERVER', id, JSON.stringify({ status: 'INACTIVE' })],
    );
    return { id, status: 'INACTIVE' };
  }

  async connectionCheck(id: string): Promise<unknown> {
    const result = await this.repository.query<{ code: string; endpoint: string; bearer_token: string | null }>(
      `SELECT code, endpoint, bearer_token FROM mcp_servers WHERE id = $1 AND status = 'ACTIVE'`,
      [id],
    );
    if (result.rows.length === 0) throw new NotFoundException('연결할 MCP를 찾을 수 없습니다.');
    const mcp = result.rows[0];
    const startedAt = Date.now();
    try {
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(mcp.bearer_token ? { Authorization: `Bearer ${mcp.bearer_token}` } : {}) };
      const initialize = await this.postMcpJsonRpc(mcp.endpoint, headers, { jsonrpc: '2.0', id: `init-${Date.now()}`, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'ai-gateway', version: '1.0.0' } } });
      const protocolVersion = typeof initialize.body?.result === 'object' && initialize.body.result !== null && 'protocolVersion' in initialize.body.result
        ? String((initialize.body.result as { protocolVersion: unknown }).protocolVersion)
        : '2025-06-18';
      const sessionHeaders = { ...headers, 'MCP-Protocol-Version': protocolVersion, ...(initialize.sessionId ? { 'Mcp-Session-Id': initialize.sessionId } : {}) };
      await this.postMcpJsonRpc(mcp.endpoint, sessionHeaders, { jsonrpc: '2.0', method: 'notifications/initialized' }, true);
      const toolsResponse = await this.postMcpJsonRpc(mcp.endpoint, sessionHeaders, { jsonrpc: '2.0', id: `tools-${Date.now()}`, method: 'tools/list', params: {} });
      const payload = toolsResponse.body;
      if (!payload || (!Object.prototype.hasOwnProperty.call(payload, 'result') && !Object.prototype.hasOwnProperty.call(payload, 'error'))) {
        throw new BadRequestException('MCP가 JSON-RPC 2.0 응답을 반환하지 않았습니다.');
      }
      return { code: mcp.code, status: 'CONNECTED', latencyMs: Date.now() - startedAt, response: payload };
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'MCP 연결에 실패했습니다.');
    }
  }

  private async postMcpJsonRpc(endpoint: string, headers: Record<string, string>, body: Record<string, unknown>, allowEmpty = false): Promise<{ body: Record<string, unknown> | null; sessionId?: string }> {
    const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    const text = await response.text();
    if (!response.ok) throw new BadRequestException(`MCP 연결 실패 (${response.status})`);
    if (!text.trim() && allowEmpty) return { body: null, sessionId: response.headers.get('mcp-session-id') ?? undefined };
    const data = text.split(/\r?\n/).find((line) => line.startsWith('data:'))?.slice(5).trim() ?? text.trim();
    return { body: JSON.parse(data) as Record<string, unknown>, sessionId: response.headers.get('mcp-session-id') ?? undefined };
  }

  async usageLogs(from?: string, to?: string): Promise<unknown[]> {
    const result = await this.repository.query(
      `SELECT id, trace_id, tenant_id, agent_id, request_type, resource_name,
              status, error_code, input_tokens, output_tokens, latency_ms, metadata, requested_at
       FROM usage_logs
       WHERE ($1::date IS NULL OR requested_at >= $1::date)
         AND ($2::date IS NULL OR requested_at < ($2::date + INTERVAL '1 day'))
       ORDER BY requested_at DESC LIMIT 100`,
      [from?.trim() || null, to?.trim() || null],
    );
    return result.rows;
  }

  async activities(): Promise<unknown[]> {
    const result = await this.repository.query(
      `SELECT a.action, a.resource_type, a.details, a.created_at, u.name AS actor_name
       FROM audit_logs a LEFT JOIN admin_users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC LIMIT 10`,
    );
    return result.rows;
  }

  async settings(): Promise<Record<string, string>> {
    const result = await this.repository.query<{ key: string; value: string }>(
      'SELECT key, value FROM system_settings ORDER BY key',
    );
    return Object.fromEntries(result.rows.map((setting) => [setting.key, setting.value]));
  }

  async updateSettings(values: Record<string, string>): Promise<Record<string, string>> {
    for (const [key, value] of Object.entries(values)) {
      await this.repository.query(
        `INSERT INTO system_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [key, value],
      );
    }
    return this.settings();
  }
}
