TRUNCATE TABLE audit_logs, usage_logs, api_key_tenants, api_key_resources, api_keys,
  api_key_request_tenants, api_key_request_resources, api_key_requests,
  mcp_tools, mcp_servers, model_aliases, admin_users,
  information_system_tenants, tenants, information_systems, providers
RESTART IDENTITY CASCADE;

INSERT INTO providers (code, name, status)
VALUES
  ('SAMSUNG_SDS', '삼성SDS', 'ACTIVE'),
  ('NAVER_CLOUD', '네이버 클라우드', 'ACTIVE');

INSERT INTO information_systems (code, name, status)
VALUES
  ('IS_GOV_01', '인공지는 공통기반', 'ACTIVE'),
  ('IS_GOV_02', '기획예산관리 시스템', 'ACTIVE');
  
INSERT INTO tenants (code, name, endpoint, api_key_ciphertext, provider_id, status)
SELECT v.code, v.name, v.endpoint, 'cipher:' || v.code, p.id, 'ACTIVE'
FROM (
  VALUES
    ('TENANT_001', '공통기반 FabriX', 'http://10.10.10.194:8000', 'SAMSUNG_SDS'),
    ('TENANT_002', '공통기반 ClovaX', 'http://10.10.10.194:8000', 'NAVER_CLOUD'),    
    ('TENANT_003', 'D-Brain FabriX', 'http://10.10.10.194:8000', 'SAMSUNG_SDS')
) AS v(code, name, endpoint, provider_code)
JOIN providers p ON p.code = v.provider_code;

INSERT INTO information_system_tenants (information_system_id, tenant_id, is_default)
SELECT s.id, t.id, (ROW_NUMBER() OVER (PARTITION BY s.id ORDER BY t.code) = 1)
FROM (
  VALUES
    ('IS_GOV_01', 'TENANT_001'), ('IS_GOV_01', 'TENANT_002'), ('IS_GOV_02', 'TENANT_003')    
) AS mapping(system_code, tenant_code)
JOIN information_systems s ON s.code = mapping.system_code
JOIN tenants t ON t.code = mapping.tenant_code;

INSERT INTO admin_users (email, name, role, status)
VALUES
  ('admin@ai-gateway.local', '관리자', 'ADMIN', 'ACTIVE');

INSERT INTO model_aliases (alias, provider_id, provider_model, status)
SELECT v.alias, p.id, v.provider_model, 'ACTIVE'
FROM (
  VALUES
    ('sds-qwen', 'SAMSUNG_SDS', 'Qwen/Qwen2.5-3B-Instruct-AWQ'),
    ('sds-solar', 'SAMSUNG_SDS', 'solar-open2'),    
    ('sds-llama', 'SAMSUNG_SDS', 'llama-3.1-70b'),
    ('naver-hcx', 'NAVER_CLOUD', 'HCX-005'),    
    ('naver-qwen', 'NAVER_CLOUD', 'Qwen/Qwen2.5-3B-Instruct-AWQ'),
    ('naver-exaone', 'NAVER_CLOUD', 'EXAONE-3.5')
) AS v(alias, provider_code, provider_model)
JOIN providers p ON p.code = v.provider_code;

INSERT INTO mcp_servers (code, name, endpoint, bearer_token, status)
VALUES
  ('MS_LEARN', 'MS LEARN', 'https://learn.microsoft.com/api/mcp', '', 'ACTIVE');

INSERT INTO mcp_tools (mcp_server_id, name, description, input_schema)
SELECT m.id, v.name, v.description, v.input_schema::jsonb
FROM (
  VALUES
    ('MS_LEARN', 'document_preview', '문서 미리보기', '{"type":"object","properties":{"doc_id":{"type":"string"}},"required":["doc_id"]}')
) AS v(code, name, description, input_schema)
JOIN mcp_servers m ON m.code = v.code;

INSERT INTO system_settings (key, value, description)
VALUES
  ('log_retention_days', '60', '사용 로그 보존 기간'),
  ('max_requests_per_minute', '180', '분당 최대 요청 수'),
  ('allow_public_mcp', 'true', '공개 MCP 허용 여부'),
  ('default_provider', 'SAMSUNG_SDS', '기본 Provider');
