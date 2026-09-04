# UC-0103. MCP를 통해 공통RAG 및 외부MCP를 사용한다

## 1. Use Case 개요

| 항목 | 내용 |
|---|---|
| Use Case ID | UC-0103 |
| Use Case 명 | MCP를 통해 공통RAG 및 외부MCP를 사용한다 |
| 주요 Actor | 개발자/Agent |
| 주요 시스템 | AI Gateway |
| 목적 | AI플랫폼에 개발되는 Agent가 개별 MCP를 직접 호출하지 않고 표준 MCP를 통해 공통RAG 및 외부MCP를 활용하여 사용한다 |
| Trigger | Agent에서 검색, RAG, 외부 자료 조회 등 MCP Tool 사용이 필요한 경우 |
| 관련 SFR | SFR-005, SFR-009 |

## 2. 사전 조건

- Agent가 사용할 수 있는 MCP 자원이 AI Gateway에 등록되어 있어야 한다.
- Agent에 AI Gateway 인증 키가 발급되어 있어야 한다.

## 3. 기본 시나리오

| 단계 | Actor | 수행 내용 |
|---|---|---|
| 1 | 개발자/Agent | 사용 할 MCP 자원의 Endpoint와 사용 방법을 확인한다. |
| 2 | 개발자/Agent | 인증 키와 함께 MCP 정상 연결 여부를 확인한다. |
| 3 | 개발시스템 | AI Gateway에 MCP tools를 호출하여 정상 여부를 반환한다. |
| 4 | 개발자/Agent | AI 서비스 또는 Agent에 MCP를 인증 키와 함께 등록하여 개발한다. |
| 5 | 개발자/Agent | MCP를 사용하여 개발한 AI 서비스 또는 Agent를 호출한다. |
| 6 | Agent | AI Agent는 등록된 AI Gateway MCP를 호출한다. |
| 7 | AI Gateway | 요청 인증 키에 대해 MCP 사용 권한을 확인한다. |
| 8 | AI Gateway | 요청 된 MCP Tool 및 Parameter를 검증한다. |
| 9 | AI Gateway | Provider별 사전 발급 API Key를 사용하여 실제 AI 서비스를 호출한다. |
| 10 | AI Gateway | Provider별 응답을 MCP로 변환하여 응답을 생성한다. |
| 11 | Agent | MCP 결과를 활용하여 최종 AI 서비스 답변을 생성한다. |
| 12 | AI Gateway | 호출 정보 및 사용량 이력을 기록한다. |

## 4. 예외/대안 시나리오

- MCP 인증 실패 → 호출 거부, 오류 반환(401)
- Tenant/Agent MCP 권한 없음 → 호출 거부, 오류 반환(403)
- 등록되지 않은 MCP Tool 호출 → 호출 거부, 오류 반환(404)
- MCP Server 장애 → 표준 MCP 오류 반환(500)
- 외부망 연계 장애 → 표준 MCP 오류 반환(503)
- MCP Parameter 누락/오류 → 요청 검증 단계 차단(400)

## 5. 사후 조건

- AI플랫폼의 Agent는 공통RAG 또는 외부MCP를 직접 호출하지 않는다.
- Agent는 AI Gateway가 제공하는 MCP Endpoint만 호출한다.
- 공통RAG 구현체가 변경되더라도 Agent 변경을 최소화할 수 있다.
- 외부 자료 연계 시 Tenant/Agent별 호출 추적이 가능하다.
- MCP 호출 이력은 AI Gateway에서 통합 관리된다.

> 인터넷연계망 AI Gateway의 주요 기능은 외부MCP 등록/관리

## 6. 미결/후속 검토 사항

- **망 구조 반영 미흡**: Slide 1(SFR-009)에는 "내부망 AI Gateway → NIRS망 → 인터넷연계망 AI Gateway → 외부MCP(예: 연합뉴스MCP)"의 2단계(2-hop) 호출 구조가 명시되어 있으나, 본 기본 시나리오의 9~10단계는 이를 단일 홉처럼 서술하고 있음. 공통RAG(내부 자원) 호출과 외부MCP(인터넷연계망 경유) 호출은 실제로는 다른 흐름이므로, 두 케이스를 분리하여 서술할지 여부 확정 필요.
- **연합뉴스MCP 파라미터 정의 위치 불명확**: Slide 1에 "연합뉴스MCP 호출 시 테넌트/Agent 구분 등 Parameter 정의가 중요"라고 강조되어 있으나, 이 파라미터를 기본 시나리오의 어느 단계에서 누가(개발자/Agent가 요청 시 전달하는지, AI Gateway가 인증키 기준으로 자동 주입하는지) 채우는지 정의되어 있지 않음.
- **MCP Tool 실행 타임아웃 미정의**: 예외 시나리오에 인증/권한/장애 관련 오류코드(401/403/404/500/503/400)는 상세하나, RAG 검색이나 외부 자료 조회처럼 응답이 지연될 수 있는 케이스에 대한 타임아웃 기준 및 처리 방식이 없음.
