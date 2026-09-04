# AI Gateway 프로젝트 개요

## 1. 목표

개발자와 Agent가 Provider별 API 키나 외부 MCP endpoint를 직접 관리하지 않고, 하나의 표준 Gateway API를 사용하도록 합니다. Gateway는 인증키, Tenant, Model Alias, MCP, 사용량 로그를 통합 관리합니다.

## 2. 사용자와 책임

| 주체 | 책임 |
|---|---|
| 개발자 | 인증키를 신청하고 허용된 Model/MCP를 호출 |
| Agent | 발급된 Bearer 토큰으로 표준 API 호출 |
| 관리자 | Provider, Model Alias, MCP, 인증키 신청과 사용이력 관리 |
| Gateway | 인증·인가, 라우팅, 응답 표준화, 로그 기록 |
| Provider/MCP | 실제 AI Model 또는 Tool 제공 |

## 3. 확정 정책

### 인증키

- 승인된 활성 키만 호출할 수 있습니다.
- 만료·폐기 키는 401을 반환합니다.
- 원문 토큰은 DB에 저장하지 않습니다.
- 키는 정보시스템과 하나 이상의 Tenant에 연결될 수 있습니다.
- 발급 당시 선택한 자원 권한은 신규 키 신청 없이 변경하지 않습니다.

### Tenant와 Model

- 정보시스템과 Tenant는 `information_system_tenants`로 연결됩니다.
- Tenant는 `tenants.provider_id`로 하나의 Provider에 연결됩니다.
- Tenant는 Provider endpoint와 Provider 인증 정보를 가집니다.
- Model Alias는 하나의 Provider 실제 Model에 1:1로 연결됩니다.
- `/chat/v1/models`는 인증키의 Tenant Provider 범위와 Model 자원 권한을 모두 적용합니다.
- 동일 Alias가 여러 Tenant에 있어도 응답은 중복 제거합니다.
- Provider fallback은 현재 사용하지 않습니다.

### MCP

- 등록 대상은 MCP 서버입니다.
- 외부 MCP Bearer 인증은 선택적으로 설정합니다.
- 관리자 연결 확인은 Streamable HTTP MCP의 초기화 절차와 `tools/list`를 사용합니다.
- 개발자 중계 경로는 `POST /mcp/{mcp_code}`입니다.
- 현재 등록된 MCP는 발급 토큰을 가진 호출자가 사용할 수 있으며, MCP별 세밀한 권한 제한은 후속 정책입니다.
- 외부 MCP의 Bearer 토큰은 관리자 화면의 목록이나 사용이력에 노출하지 않습니다.

### 로그

- 400, 401, 403, 404, 429, 500, 502, 503 및 timeout을 포함해 결과와 무관하게 기록합니다.
- `usage_logs`에는 요청 유형, 자원, 결과, 오류 코드, 오류 메시지, 응답시간, 토큰 사용량을 저장합니다.
- 내부 추적용 Trace ID는 유지하되 관리자 UI에서는 숨깁니다.

## 4. 주요 처리 흐름

### Model

```text
Client
 -> Bearer 인증
 -> API Key 상태/만료 검증
 -> Tenant와 Model Alias 권한 검증
 -> Provider endpoint 라우팅
 -> OpenAI 호환 응답
 -> usage_logs 기록
```

### MCP

```text
Client
 -> Bearer 인증
 -> MCP code 조회
 -> JSON-RPC 2.0 요청 검증
 -> 등록 MCP endpoint 호출
 -> JSON-RPC 응답 반환
 -> usage_logs 기록
```

관리자 연결 확인은 다음 순서입니다.

```text
initialize
 -> Mcp-Session-Id/Protocol-Version 확인
 -> notifications/initialized
 -> tools/list
 -> Tool 목록 모달 표시
```

## 5. 데이터 모델

주요 테이블:

- `information_systems`
- `information_system_tenants`
- `tenants`
- `providers`
- `model_aliases`
- `mcp_servers`
- `mcp_tools`
- `api_key_requests`
- `api_key_request_tenants`
- `api_key_request_resources`
- `api_keys`
- `api_key_tenants`
- `api_key_resources`
- `usage_logs`
- `audit_logs`

MCP 서버의 `bearer_token`은 기존 DB에 자동 추가되지 않으므로 `infra/init/003_mcp_support.sql`을 적용해야 합니다.

## 6. 현재 구현 범위

- NestJS API와 React/Vite 관리자 콘솔
- PostgreSQL/Redis Docker Compose
- 인증키 신청·승인·거절·삭제 및 1회 토큰 표시
- 다중 Tenant/Provider Model Alias 권한
- OpenAI 호환 Models/Completions API
- Provider별 Tenant 자동 라우팅
- 성공·실패·인증 실패 사용량 로그
- 대시보드 집계, 기간 검색, CSV 다운로드, 오류 상세 모달
- MCP 등록·수정·연결 확인
- 공개 Microsoft Learn/AWS Knowledge MCP 등록 및 테스트
- 발급 토큰 기반 MCP 중계

## 7. 운영 전 확정할 정책

1. 관리자 API 자체의 인증과 역할별 접근 제어
2. MCP별 세밀한 Tenant/Model/Tool 권한
3. MCP initialize/session 상태를 중계 API에서 유지할지 여부
4. Provider/MCP timeout, retry, circuit breaker
5. 로그 보존기간, 비동기 저장, 유실 방지와 아카이빙
6. 인증키 만료 알림과 폐기 정책
7. Model Alias와 MCP Tool 변경 이력 및 감사 범위
8. 공개 MCP endpoint의 가용성 감시와 대체 endpoint 정책
