# AI Gateway 바이브코딩 개발 계획

## 1. 개발 방식

- 한 번에 하나의 수직 기능을 구현합니다.
- 구현 전에 Use Case, 데이터 경계, 성공·실패 응답을 정의합니다.
- 인증·인가와 Tenant 경계를 외부 호출보다 먼저 검증합니다.
- Provider와 MCP 연동은 Mock 또는 공개 테스트 endpoint로 재현합니다.
- 성공뿐 아니라 400/401/403/404/429/500/502/503/timeout을 확인합니다.
- 내부 로그에는 Trace ID를 남기고 관리자 화면에는 노출하지 않습니다.
- 코드 변경 후 API/Web build와 관련 통합 테스트를 실행합니다.

## 2. 완료된 범위

### 기반

- TypeScript/NestJS API
- React/Vite 관리자 콘솔
- PostgreSQL/Redis Docker Compose
- 기본 스키마와 seed 데이터

### 인증키와 권한

- 정보시스템-다중 Tenant 관계
- Tenant-Provider-Model Alias 관계
- 다중 Tenant/Model Alias 인증키 신청
- 관리자 승인·거절·거절 사유
- 해시 저장과 승인 시 원문 1회 반환
- 만료·폐기 키 차단

### Model API

- `GET /chat/v1/models`
- `POST /chat/v1/completions`
- 토큰별 Alias 권한 필터링
- Provider별 Tenant 자동 라우팅
- 표준 오류 및 스트리밍 기반

### 관리자와 로그

- 대시보드 필터와 Tenant별 중복 집계
- AI Model Alias CRUD
- API 사용이력 기간 검색 및 CSV
- 성공·실패·401 로그
- 오류 코드, 상세 메시지, latency
- 실패 행 빨간색 표시와 상세 모달
- 개발자 API 사용가이드

### MCP

- MCP 등록·수정·비활성화
- 선택적 Bearer Token 설정
- `initialize`와 세션 ID를 사용하는 연결 확인
- `notifications/initialized` 후 `tools/list` 호출
- SSE/JSON 응답 처리
- Tool 목록 모달
- `POST /mcp/{mcp_code}` 발급 토큰 중계
- MCP 성공·실패·latency 사용량 로그
- 공개 테스트 MCP 등록

## 3. 현재 검증된 공개 MCP

| Code | Endpoint | 목적 |
|---|---|---|
| `MS_LEARN` | `https://learn.microsoft.com/api/mcp` | Microsoft 문서 검색 Tool 테스트 |
| `AWS_KNOWLEDGE` | `https://knowledge-mcp.global.api.aws` | AWS 문서 검색 Tool 테스트 |

공개 서버는 외부 정책에 따라 변경될 수 있으므로 자동 테스트의 유일한 의존성으로 사용하지 않습니다. 반복 테스트에는 로컬 Mock MCP 서버를 추가합니다.

## 4. 다음 개발 우선순위

### P0: 안정성

1. MCP 중계에서 Streamable HTTP session ID와 `MCP-Protocol-Version`을 전달하고 세션 수명 정책을 확정합니다.
2. JSON 응답과 SSE 응답을 중계 API에서 일관되게 반환합니다.
3. MCP 연결 실패 시 원격 상태 코드와 Gateway 오류 코드를 구분합니다.
4. 공개 endpoint 대신 로컬 Mock MCP로 `initialize`, `tools/list`, Tool 호출, timeout을 자동 재현합니다.
5. Provider/MCP timeout과 요청 크기 제한을 설정합니다.

### P1: 보안과 권한

1. 관리자 API 인증과 관리자 역할별 권한을 추가합니다.
2. MCP별 Tenant/Model/Tool 권한을 인증키에 연결합니다.
3. Bearer Token 암호화 저장 또는 외부 Secret 관리 방식을 확정합니다.
4. 민감 정보가 audit log, 오류 메시지, CSV에 남지 않는지 점검합니다.

### P2: 운영

1. retry, circuit breaker, rate limit을 Provider/MCP별로 적용합니다.
2. 로그 보존·아카이빙·비동기 저장과 유실 방지 정책을 구현합니다.
3. health check, MCP Tool 스펙 변경 감지, 비활성화 정책을 추가합니다.
4. 메트릭과 분산 추적을 추가합니다.
5. 부하 테스트와 장애 주입 테스트를 수행합니다.

## 5. 기능별 완료 기준

### Model

- 허용되지 않은 Alias는 `/models`에 나타나지 않습니다.
- 허용되지 않은 Alias 호출은 차단됩니다.
- Provider 오류와 timeout이 표준 오류로 반환됩니다.
- 성공과 실패가 모두 사용량 로그에 남습니다.

### MCP

- 등록되지 않은 code는 404입니다.
- 유효하지 않은 토큰은 401입니다.
- 연결 확인에서 실제 `tools/list` 결과를 확인할 수 있습니다.
- 원격 404/500은 Gateway가 원격 실패로 구분해 반환합니다.
- 성공·실패·latency가 사용량 로그와 일치합니다.

### 관리자 UI

- 등록·수정·삭제 결과가 DB와 일치합니다.
- Bearer Token 원문은 목록과 로그에 표시되지 않습니다.
- 실패 이력에서 오류 상세를 확인할 수 있습니다.
- 기간 검색 결과와 CSV 결과가 일치합니다.

## 6. 작업 프롬프트 템플릿

```text
대상 기능:
관련 Use Case:
이번 작업 범위:
데이터 변경:
API/UI 계약:
정상 기준:
실패 기준:
보안/권한 기준:
제외 범위:
검증 명령:
문서 반영 위치:
```

## 7. DB 초기화 주의

- 개발 DB를 완전히 새로 만들 때만 Docker volume 초기화 방식을 사용합니다.
- 발급 인증키를 보존해야 하면 `api_keys`, `api_key_tenants`, `api_key_resources`, 연결된 신청 데이터를 삭제하지 않습니다.
- 사용량과 감사 이력만 비우려면 `usage_logs`, `audit_logs`만 초기화합니다.
- 기존 DB에 스키마 변경을 적용할 때는 migration SQL을 명시적으로 실행합니다.
