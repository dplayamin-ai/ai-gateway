# AI Gateway

멀티테넌트 환경에서 여러 AI Provider와 MCP 서버를 하나의 인증·권한·사용량 관리 체계로 통합하는 Gateway 프로젝트입니다.

## 1. 기술 스택

- Backend: TypeScript, NestJS
- Admin Web: React, Vite, TypeScript
- Database: PostgreSQL
- Cache: Redis
- Local infrastructure: Docker Compose
- Package manager: pnpm

## 2. 디렉터리

```text
apps/
  api/                  # Gateway API
    src/admin/          # 관리자 CRUD, 대시보드, 사용이력
    src/chat/           # OpenAI 호환 Model API
    src/mcp/            # MCP 중계 API
  web/                  # 관리자 콘솔
packages/contracts/     # 공통 계약 타입
infra/
  docker-compose.yml
  init/
    001_schema.sql      # 기본 스키마
    002_seed.sql        # 개발용 기본 데이터
    003_mcp_support.sql # 기존 DB용 MCP Bearer 마이그레이션
doc/                    # Use Case 원문
```

## 3. 로컬 실행

```bash
docker compose -f infra/docker-compose.yml up -d
pnpm install
pnpm --filter @ai-gateway/api dev --host
pnpm --filter @ai-gateway/web dev --host
```

검증 명령:

```bash
pnpm --filter @ai-gateway/api build
pnpm --filter @ai-gateway/web build
```

Windows에서는 `pnpm.cmd`를 사용합니다.

PostgreSQL 초기화 SQL은 새 Docker volume을 만들 때만 자동 실행됩니다. 기존 DB에는 `003_mcp_support.sql` 같은 마이그레이션을 별도로 적용해야 합니다.

## 4. 데이터 및 권한 모델

핵심 관계는 다음과 같습니다.

```text
Information System
  -> information_system_tenants
  -> Tenant
  -> Provider
  -> Model Alias
```

- Tenant는 하나의 Provider, Provider endpoint, Provider 인증 정보를 가집니다.
- Model Alias는 하나의 실제 Provider Model에 고정됩니다.
- 하나의 인증키는 여러 Tenant와 여러 Model/MCP 자원 권한을 가질 수 있습니다.
- 인증키 원문은 저장하지 않고 SHA-256 hash와 prefix만 저장합니다.
- 승인 시 원문 토큰은 한 번만 반환하며 관리자 화면에서 복사할 수 있습니다.
- 인증키의 권한은 발급 후 임의로 변경하지 않고, 권한 변경은 신규 신청으로 처리합니다.

## 5. 현재 구현 기능

### 관리자 콘솔

- 대시보드: 정보시스템/테넌트 필터, 활성 인증키·모델·호출 집계
- 인증키 신청: 다중 Tenant/Model Alias 선택, 승인·거절·삭제
- AI Model 관리: Alias, Provider, 실제 Model 등록·수정
- MCP 관리: MCP endpoint 등록·수정·비활성화
- API 사용이력: 기간 검색, 성공/실패 표시, 오류 상세 모달, CSV 다운로드
- 개발자 API 사용가이드: 인증키 신청과 Model/MCP 호출 예시

### Model API

- `GET /chat/v1/models`
- `POST /chat/v1/completions`

두 API 모두 Bearer 인증키와 Model Alias 권한을 검증합니다. `/models`는 토큰이 사용할 수 있는 Alias만 중복 없이 반환하며, `/completions`는 Alias Provider에 맞는 인증키 Tenant를 자동 선택합니다.

### MCP API

등록 대상은 MCP 서버입니다. 외부 서버에 Bearer 인증이 필요한 경우 관리자 등록 폼에서 선택적으로 설정합니다.

- 관리자 연결 확인: `initialize` -> `notifications/initialized` -> `tools/list`
- 공개 Streamable HTTP MCP의 SSE 응답 및 세션 ID 처리
- 중계 endpoint: `POST /mcp/{mcp_code}`
- 발급 API 토큰으로 Gateway 인증
- MCP 성공·실패·응답시간을 `usage_logs`에 기록

중계 예시:

```bash
curl http://localhost:3000/mcp/MS_LEARN \
  -H "Authorization: Bearer <발급받은 토큰>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

개발 테스트용 공개 MCP:

| Code | Endpoint | 설명 |
|---|---|---|
| `MS_LEARN` | `https://learn.microsoft.com/api/mcp` | Microsoft Learn 문서 검색 |
| `AWS_KNOWLEDGE` | `https://knowledge-mcp.global.api.aws` | AWS Knowledge 검색 |

공개 endpoint는 정책·가용성·응답 형식이 변경될 수 있으므로 연결 확인으로 항상 실제 `tools/list` 결과를 확인합니다.

## 6. 사용량 로그 정책

Model과 MCP 요청은 성공·실패를 모두 기록합니다.

- `request_type`: `MODEL` 또는 `MCP`
- `status`: `SUCCESS` 또는 `FAILURE`
- `error_code`: HTTP 오류 코드
- `metadata.errorMessage`: 상세 오류 메시지
- `latency_ms`: 요청 시작부터 완료 또는 실패까지의 시간
- 인증 실패는 Tenant를 확인할 수 없으므로 nullable Tenant로 기록할 수 있음
- 내부 `trace_id`는 유지하지만 관리자 사용이력 화면에는 표시하지 않음

## 7. 관련 문서

- [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md): 제품 정책, 아키텍처, 처리 흐름
- [VIBE_CODING_PLAN.md](./VIBE_CODING_PLAN.md): 개발 원칙, 완료 범위, 다음 단계
