TRUNCATE TABLE audit_logs, usage_logs, api_key_tenants, api_key_resources, api_keys,
  api_key_request_tenants, api_key_request_resources, api_key_requests,
  mcp_tools, mcp_servers, model_aliases, admin_users,
  information_system_tenants, tenants, information_systems, providers
RESTART IDENTITY CASCADE;

INSERT INTO providers (code, name, status)
VALUES
  ('SAMSUNG_SDS', '삼성 SDS', 'ACTIVE'),
  ('NAVER_CLOUD', '네이버 클라우드', 'ACTIVE');

INSERT INTO information_systems (code, name, status)
VALUES
  ('IS_GOV_00', '인공지는 공통기반', 'ACTIVE'),
  ('IS_GOV_01', '국가정책플랫폼', 'ACTIVE'),
  ('IS_GOV_02', '재난안전정보센터', 'ACTIVE'),
  ('IS_GOV_03', '국가공공데이터허브', 'ACTIVE'),
  ('IS_GOV_04', '업무지원포털', 'ACTIVE'),
  ('IS_GOV_05', '지방자치단체 통합운영', 'ACTIVE'),
  ('IS_GOV_06', '기획예산관리 시스템', 'ACTIVE'),
  ('IS_GOV_07', '인사행정 통합관리', 'ACTIVE'),
  ('IS_GOV_08', '복지서비스 연계센터', 'ACTIVE'),
  ('IS_GOV_09', '교육데이터 통합관리', 'ACTIVE'),
  ('IS_GOV_10', '보건의료 데이터허브', 'ACTIVE');
  
  

INSERT INTO tenants (code, name, endpoint, api_key_ciphertext, provider_id, status)
SELECT v.code, v.name, v.endpoint, 'cipher:' || v.code, p.id, 'ACTIVE'
FROM (
  VALUES
    ('TENANT_001', '서울청사 AI센터', 'https://tenant-001.api.local', 'SAMSUNG_SDS'),
    ('TENANT_002', '대전혁신 AI연구소', 'https://tenant-002.api.local', 'SAMSUNG_SDS'),
    ('TENANT_003', '부산디지털 지원단', 'https://tenant-003.api.local', 'SAMSUNG_SDS'),
    ('TENANT_004', '광주AI서비스센터', 'https://tenant-004.api.local', 'SAMSUNG_SDS'),
    ('TENANT_005', '대구데이터거버넌스', 'https://tenant-005.api.local', 'NAVER_CLOUD'),
    ('TENANT_006', '인천지능형행정본부', 'https://tenant-006.api.local', 'NAVER_CLOUD'),
    ('TENANT_007', '울산시 공공데이터센터', 'https://tenant-007.api.local', 'NAVER_CLOUD'),
    ('TENANT_008', '세종특별자치시 AI센터', 'https://tenant-008.api.local', 'NAVER_CLOUD'),
    ('TENANT_009', '경기디지털플랫폼', 'https://tenant-009.api.local', 'SAMSUNG_SDS'),
    ('TENANT_010', '강원행정정보센터', 'https://tenant-010.api.local', 'SAMSUNG_SDS'),
    ('TENANT_011', '충북민원서비스허브', 'https://tenant-011.api.local', 'SAMSUNG_SDS'),
    ('TENANT_012', '충남업무통합', 'https://tenant-012.api.local', 'NAVER_CLOUD'),
    ('TENANT_013', '전북정책리서치센터', 'https://tenant-013.api.local', 'NAVER_CLOUD'),
    ('TENANT_014', '전남디지털포용센터', 'https://tenant-014.api.local', 'NAVER_CLOUD'),
    ('TENANT_015', '경북데이터사이언스', 'https://tenant-015.api.local', 'NAVER_CLOUD'),
    ('TENANT_016', '경남시스템통합센터', 'https://tenant-016.api.local', 'NAVER_CLOUD'),
    ('TENANT_017', '제주특별자치도 AI허브', 'https://tenant-017.api.local', 'SAMSUNG_SDS'),
    ('TENANT_018', '중앙행정기관연계센터', 'https://tenant-018.api.local', 'SAMSUNG_SDS'),
    ('TENANT_019', '국정성과관리본부', 'https://tenant-019.api.local', 'NAVER_CLOUD'),
    ('TENANT_020', '국민안전예방센터', 'https://tenant-020.api.local', 'NAVER_CLOUD'),
    ('TENANT_021', '사회복지통합관리망', 'https://tenant-021.api.local', 'SAMSUNG_SDS'),
    ('TENANT_022', '교육혁신 디지털센터', 'https://tenant-022.api.local', 'SAMSUNG_SDS'),
    ('TENANT_023', '보건의료 연계플랫폼', 'https://tenant-023.api.local', 'SAMSUNG_SDS')
) AS v(code, name, endpoint, provider_code)
JOIN providers p ON p.code = v.provider_code;

INSERT INTO information_system_tenants (information_system_id, tenant_id, is_default)
SELECT s.id, t.id, (ROW_NUMBER() OVER (PARTITION BY s.id ORDER BY t.code) = 1)
FROM (
  VALUES
    ('IS_GOV_01', 'TENANT_001'), ('IS_GOV_01', 'TENANT_002'),
    ('IS_GOV_02', 'TENANT_003'), ('IS_GOV_02', 'TENANT_004'),
    ('IS_GOV_03', 'TENANT_005'), ('IS_GOV_03', 'TENANT_006'),
    ('IS_GOV_04', 'TENANT_007'), ('IS_GOV_04', 'TENANT_008'),
    ('IS_GOV_05', 'TENANT_009'), ('IS_GOV_05', 'TENANT_010'),
    ('IS_GOV_06', 'TENANT_011'), ('IS_GOV_06', 'TENANT_012'),
    ('IS_GOV_07', 'TENANT_013'), ('IS_GOV_07', 'TENANT_014'),
    ('IS_GOV_08', 'TENANT_015'), ('IS_GOV_08', 'TENANT_016'),
    ('IS_GOV_09', 'TENANT_017'), ('IS_GOV_09', 'TENANT_018'),
    ('IS_GOV_10', 'TENANT_019'), ('IS_GOV_10', 'TENANT_020'),
    ('IS_GOV_00', 'TENANT_021'), ('IS_GOV_00', 'TENANT_022')    
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
    ('sds-gpt-4o', 'SAMSUNG_SDS', 'gpt-4o'),
    ('sds-claude', 'SAMSUNG_SDS', 'claude-3-5-sonnet'),
    ('sds-gemini', 'SAMSUNG_SDS', 'gemini-2.5-pro'),
    ('sds-llama', 'SAMSUNG_SDS', 'llama-3.1-70b'),
    ('naver-hcx-005', 'NAVER_CLOUD', 'HCX-005'),
    ('naver-hyperclova-x', 'NAVER_CLOUD', 'HCX-003'),
    ('naver-gemma', 'NAVER_CLOUD', 'gemma-2-27b'),
    ('naver-exaone', 'NAVER_CLOUD', 'EXAONE-3.5')
) AS v(alias, provider_code, provider_model)
JOIN providers p ON p.code = v.provider_code;

INSERT INTO mcp_servers (code, name, endpoint, bearer_token, status)
VALUES
  ('COMMON_RAG', '공통 RAG MCP', 'http://common-rag:8080/mcp', '', 'ACTIVE'),
  ('YONHAP_NEWS', '연합뉴스 MCP', 'http://news-mcp:8081/mcp', '', 'ACTIVE'),
  ('LAW_INFO', '법령정보 MCP', 'http://law-mcp:8082/mcp', 'asasasas', 'ACTIVE'),
  ('DOC_SEARCH', '문서 검색 MCP', 'http://doc-search:8083/mcp', 'asasasas', 'ACTIVE');

INSERT INTO mcp_tools (mcp_server_id, name, description, input_schema)
SELECT m.id, v.name, v.description, v.input_schema::jsonb
FROM (
  VALUES
    ('COMMON_RAG', 'search', '문서 검색', '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}'),
    ('COMMON_RAG', 'summarize', '요약 생성', '{"type":"object","properties":{"text":{"type":"string"}},"required":["text"]}'),
    ('YONHAP_NEWS', 'search_news', '뉴스 검색', '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}'),
    ('YONHAP_NEWS', 'fetch_headlines', '헤드라인 조회', '{"type":"object","properties":{"category":{"type":"string"}},"required":["category"]}'),
    ('LAW_INFO', 'search_law', '법령 검색', '{"type":"object","properties":{"keyword":{"type":"string"}},"required":["keyword"]}'),
    ('LAW_INFO', 'get_article', '법령 조문 조회', '{"type":"object","properties":{"article_id":{"type":"string"}},"required":["article_id"]}'),
    ('DOC_SEARCH', 'index_lookup', '인덱스 조회', '{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}'),
    ('DOC_SEARCH', 'document_preview', '문서 미리보기', '{"type":"object","properties":{"doc_id":{"type":"string"}},"required":["doc_id"]}')
) AS v(code, name, description, input_schema)
JOIN mcp_servers m ON m.code = v.code;

INSERT INTO system_settings (key, value, description)
VALUES
  ('gateway_name', 'AI Gateway', 'Gateway 이름'),
  ('default_timeout_seconds', '30', '기본 외부 호출 Timeout'),
  ('log_retention_days', '365', '사용 로그 보존 기간'),
  ('max_requests_per_minute', '180', '분당 최대 요청 수'),
  ('allow_public_mcp', 'true', '공개 MCP 허용 여부'),
  ('default_provider', 'SAMSUNG_SDS', '기본 Provider');
