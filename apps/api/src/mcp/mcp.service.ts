import { Injectable, BadRequestException, NotFoundException, UnauthorizedException, HttpException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { McpRepository } from './mcp.repository.js';

type AuthContext = { apiKeyId: string; tenantId: string; informationSystemId: string };
type JsonRpcRequest = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };

@Injectable()
export class McpService {
  constructor(private readonly repository: McpRepository) {}

  async relay(code: string, authorization: string | undefined, body: JsonRpcRequest): Promise<unknown> {
    const startedAt = Date.now();
    let auth: AuthContext | undefined;
    const resourceName = code;

    try {
      auth = await this.authenticate(authorization);

      if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string' || !body.method.trim()) {
        throw new BadRequestException('MCP 요청은 JSON-RPC 2.0 형식이어야 합니다.');
      }

      const result = await this.repository.query<{ endpoint: string; bearer_token: string | null }>(
        `SELECT endpoint, bearer_token FROM mcp_servers WHERE code = $1 AND status = 'ACTIVE'`,
        [code],
      );

      if (result.rows.length === 0) {
        throw new NotFoundException('등록된 MCP를 찾을 수 없습니다.');
      }

      const mcp = result.rows[0];
      const baseHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(mcp.bearer_token ? { Authorization: `Bearer ${mcp.bearer_token}` } : {}),
      };

      let sessionId: string | undefined;
      if (body.method !== 'initialize') {
        const init = await this.forwardMcp(mcp.endpoint, baseHeaders, {
          jsonrpc: '2.0',
          id: `relay-init-${Date.now()}`,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'ai-gateway', version: '1.0.0' },
          },
        });
        sessionId = init.sessionId;

        await this.forwardMcp(
          mcp.endpoint,
          { ...baseHeaders, ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}) },
          { jsonrpc: '2.0', method: 'notifications/initialized' },
          true,
        );
      }

      const response = await this.forwardMcp(
        mcp.endpoint,
        { ...baseHeaders, ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}) },
        body,
      );
      const payload = response.body as Record<string, unknown> | null;

      if (!payload) {
        throw new HttpException('MCP가 빈 응답을 반환했습니다.', 502);
      }
      if (payload.jsonrpc !== '2.0') {
        throw new HttpException('MCP가 JSON-RPC 2.0 응답을 반환하지 않았습니다.', 502);
      }

      await this.recordUsage(auth, resourceName, 'SUCCESS', undefined, Date.now() - startedAt);
      return payload;
    } catch (error) {
      await this.recordUsage(
        auth,
        resourceName,
        'FAILURE',
        this.errorCode(error),
        Date.now() - startedAt,
        this.errorMessage(error),
      );
      throw error;
    }
  }

  private async forwardMcp(
    endpoint: string,
    headers: Record<string, string>,
    body: JsonRpcRequest,
    allowEmpty = false,
  ): Promise<{ body: Record<string, unknown> | null; sessionId?: string }> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new HttpException(`MCP 호출 실패 (${response.status})`, 502);
    }
    if (!text.trim() && allowEmpty) {
      return { body: null, sessionId: response.headers.get('mcp-session-id') ?? undefined };
    }

    const data = text.split(/\r?\n/).find((line) => line.startsWith('data:'))?.slice(5).trim() ?? text.trim();
    const parsed = data ? (JSON.parse(data) as Record<string, unknown>) : null;

    return {
      body: parsed,
      sessionId: response.headers.get('mcp-session-id') ?? undefined,
    };
  }

  private async authenticate(authorization?: string): Promise<AuthContext> {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';
    if (!token) {
      throw new UnauthorizedException('API 키가 필요합니다.');
    }

    const result = await this.repository.query<AuthContext>(
      `SELECT k.id AS "apiKeyId", k.tenant_id AS "tenantId", k.information_system_id AS "informationSystemId"
       FROM api_keys k JOIN information_systems s ON s.id = k.information_system_id
       JOIN information_system_tenants st ON st.information_system_id = s.id AND st.tenant_id = k.tenant_id
       WHERE k.key_hash = $1 AND k.status = 'ACTIVE' AND k.expires_at > now()`,
      [createHash('sha256').update(token).digest('hex')],
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedException('유효하지 않거나 만료된 토큰입니다.');
    }

    return result.rows[0];
  }

  private async recordUsage(
    auth: AuthContext | undefined,
    resourceName: string,
    status: 'SUCCESS' | 'FAILURE',
    errorCode?: string,
    latencyMs?: number,
    errorMessage?: string,
  ): Promise<void> {
    await this.repository.query(
      `INSERT INTO usage_logs (trace_id, api_key_id, tenant_id, information_system_id, request_type, resource_name, status, error_code, latency_ms, metadata, requested_at, completed_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, 'MCP', $4, $5, $6, $7, $8::jsonb, now(), now())`,
      [
        auth?.apiKeyId ?? null,
        auth?.tenantId ?? null,
        auth?.informationSystemId ?? null,
        resourceName,
        status,
        errorCode ?? null,
        latencyMs ?? null,
        JSON.stringify(errorMessage ? { errorMessage } : {}),
      ],
    );
  }

  private errorCode(error: unknown): string {
    return error instanceof HttpException ? String(error.getStatus()) : '500';
  }

  private errorMessage(error: unknown): string {
    return error instanceof HttpException ? error.message : error instanceof Error ? error.message : 'Internal server error';
  }
}
