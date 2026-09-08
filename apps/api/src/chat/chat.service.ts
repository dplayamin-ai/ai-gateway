import { Injectable, HttpException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { createHash } from 'node:crypto';
import { ChatRepository } from './chat.repository.js';

type AuthContext = { apiKeyId: string; tenantId: string; informationSystemId: string };

@Injectable()
export class ChatService {
  constructor(private readonly repository: ChatRepository) {}

  async models(authorization?: string): Promise<unknown> {
    const startedAt = Date.now();
    const auth = await this.authenticate(authorization, 'models', startedAt);
    try {
      const result = await this.repository.query<{ id: string; alias: string; created_at: string }>(
        `SELECT DISTINCT ON (m.id) m.id, m.alias, extract(epoch from m.created_at)::bigint AS created_at
         FROM model_aliases m
         JOIN api_key_tenants akt ON akt.api_key_id = $1
         JOIN tenants t ON t.id = akt.tenant_id AND t.provider_id = m.provider_id
         WHERE m.status = 'ACTIVE'
           AND (NOT EXISTS (
                  SELECT 1
                  FROM api_key_resources ar
                  WHERE ar.api_key_id = $1 AND ar.resource_type = 'MODEL'
                )
                OR EXISTS (
                  SELECT 1
                  FROM api_key_resources ar
                  WHERE ar.api_key_id = $1
                    AND ar.resource_type = 'MODEL'
                    AND ar.resource_id = m.id
                ))
         ORDER BY m.id, m.alias`,
        [auth.apiKeyId],
      );
      await this.recordUsage(auth, 'models', 'SUCCESS', undefined, Date.now() - startedAt);
      return { object: 'list', data: result.rows.map((model) => ({ id: model.alias, object: 'model', created: Number(model.created_at), owned_by: 'ai-gateway' })) };
    } catch (error) {
      await this.recordUsage(auth, 'models', 'FAILURE', this.errorCode(error), Date.now() - startedAt, this.errorMessage(error));
      throw error;
    }
  }

  async completions(
    authorization: string | undefined,
    body: { model?: string; messages?: Array<{ role: string; content: string }>; temperature?: number; max_tokens?: number; stream?: boolean },
    res: Response,
  ): Promise<unknown> {
    const startedAt = Date.now();
    const resourceName = body?.model ?? 'completions';
    const auth = await this.authenticate(authorization, resourceName, startedAt);
    try {
      if (!body || !body.model || !Array.isArray(body.messages) || body.messages.length === 0) {
        throw new BadRequestException('model과 messages는 필수입니다.');
      }
    const model = await this.repository.query<{ provider_model: string; endpoint: string; api_key_ciphertext: string }>(
      `SELECT m.provider_model, t.id AS "tenantId", t.endpoint, t.api_key_ciphertext
       FROM model_aliases m
       JOIN providers p ON p.id = m.provider_id
       JOIN api_key_tenants akt ON akt.api_key_id = $2
       JOIN tenants t ON t.id = akt.tenant_id AND t.provider_id = m.provider_id
       WHERE m.alias = $1 AND m.status = 'ACTIVE' AND p.status = 'ACTIVE'
         AND (NOT EXISTS (SELECT 1 FROM api_key_resources ar WHERE ar.api_key_id = $2 AND ar.resource_type = 'MODEL')
              OR EXISTS (SELECT 1 FROM api_key_resources ar WHERE ar.api_key_id = $2 AND ar.resource_type = 'MODEL' AND ar.resource_id = m.id))`,
      [body.model, auth.apiKeyId],
    );
    if (model.rows.length === 0) throw new HttpException('요청한 모델을 찾을 수 없습니다.', 404);
    const provider = model.rows[0];
    if (!provider.endpoint) throw new HttpException('Provider endpoint가 설정되지 않았습니다.', 503);
    const endpoint = provider.endpoint.replace(/\/+$/, '');
    console.log(`${endpoint}/v1/chat/completions`);
    console.log(JSON.stringify({ ...body, model: provider.provider_model }));
    const providerResponse = await fetch(`${endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.api_key_ciphertext}` },
      body: JSON.stringify({ ...body, model: provider.provider_model }),
    });
    if (!providerResponse.ok) throw new HttpException(`Provider 호출 실패 (${providerResponse.status})`, 502);
    if (body.stream) {
      if (!providerResponse.body) throw new HttpException('Provider 스트림 응답이 비어 있습니다.', 502);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const reader = providerResponse.body.getReader();
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          res.write(Buffer.from(chunk.value));
        }
        await this.recordUsage(auth, body.model, 'SUCCESS', undefined, Date.now() - startedAt);
      } finally {
        reader.releaseLock();
        res.end();
      }
      return;
    }
    const result = await providerResponse.json() as Record<string, unknown>;
    await this.recordUsage(auth, body.model, 'SUCCESS', undefined, Date.now() - startedAt);
    return result;
    } catch (error) {
      await this.recordUsage(auth, resourceName, 'FAILURE', this.errorCode(error), Date.now() - startedAt, this.errorMessage(error));
      throw error;
    }
  }

  private async recordUsage(auth: Partial<AuthContext>, resourceName: string, status: 'SUCCESS' | 'FAILURE', errorCode?: string, latencyMs?: number, errorMessage?: string): Promise<void> {
    await this.repository.query(
      `INSERT INTO usage_logs (trace_id, api_key_id, tenant_id, information_system_id, agent_id, request_type, resource_name, status, error_code, latency_ms, metadata, requested_at, completed_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, NULL, 'MODEL', $4, $5, $6, $7, $8::jsonb, now(), now())`,
      [auth.apiKeyId ?? null, auth.tenantId ?? null, auth.informationSystemId ?? null, resourceName, status, errorCode ?? null, latencyMs ?? null, JSON.stringify(errorMessage ? { errorMessage } : {})],
    );
  }

  private async authenticate(authorization: string | undefined, resourceName: string, startedAt: number): Promise<AuthContext> {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) {
      await this.recordUsage({}, resourceName, 'FAILURE', '401', Date.now() - startedAt, 'API 키가 필요합니다.');
      throw new UnauthorizedException('API 키가 필요합니다.');
    }
    const hash = createHash('sha256').update(token).digest('hex');
    const result = await this.repository.query<AuthContext>(
      `SELECT k.id AS "apiKeyId", k.tenant_id AS "tenantId", k.information_system_id AS "informationSystemId"
       FROM api_keys k
       JOIN information_systems s ON s.id = k.information_system_id
       LEFT JOIN information_system_tenants st ON st.information_system_id = s.id AND st.tenant_id = k.tenant_id
       WHERE k.key_hash = $1 AND k.status = 'ACTIVE' AND k.expires_at > now()
         AND st.tenant_id IS NOT NULL`,
      [hash],
    );
    if (result.rows.length === 0) {
      await this.recordUsage({}, resourceName, 'FAILURE', '401', Date.now() - startedAt, '유효하지 않거나 만료된 토큰입니다.');
      throw new UnauthorizedException('유효하지 않거나 만료된 토큰입니다.');
    }
    return result.rows[0];
  }

  private errorCode(error: unknown): string {
    return error instanceof HttpException ? String(error.getStatus()) : '500';
  }

  private errorMessage(error: unknown): string {
    return error instanceof HttpException ? error.message : error instanceof Error ? error.message : 'Internal server error';
  }
}
