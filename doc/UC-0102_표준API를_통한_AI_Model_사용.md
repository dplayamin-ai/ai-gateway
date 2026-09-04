# UC-0102. 표준API를 통해 AI Model을 사용한다

## 1. Use Case 개요

| 항목 | 내용 |
|---|---|
| Use Case ID | UC-0102 |
| Use Case 명 | 표준API를 통해 AI Model을 사용한다 |
| 주요 Actor | 개발자/Agent |
| 주요 시스템 | AI Gateway |
| 목적 | 개발자가 발급받은 인증키와 OpenAI API를 이용하여 권한이 부여된 AI Model을 호출하여 사용한다 |
| Trigger | Agent 또는 AI 서비스에서 LLM 이 필요한 경우 |
| 관련 SFR | SFR-010 |

## 2. 사전 조건

- 개발자에게 유효한 AI Gateway 인증 키가 발급되어 있어야 한다.
- 테넌트에 해당 AI Model 사용 권한이 부여되어 있어야 한다.
- AI Gateway에는 Provider별 사전 발급 API Key가 등록되어 있어야 한다.
- Model Alias는 하나의 실제 Model/Provider와 1:1로 고정 매핑되어 있어야 하며, 대체(Fallback) Provider는 존재하지 않는다.

## 3. 기본 시나리오

| 단계 | Actor | 수행 내용 |
|---|---|---|
| 1 | 개발자/Agent | AI Gateway의 표준API를 호출한다. |
| 2 | 개발자/Agent | 인증키, 요청 Model Alias, Prompt 및 요청 Parameter(스트리밍 여부 포함)를 전달한다. |
| 3 | AI Gateway | 인증 키에 대한 유효성을 검증한다. |
| 4 | AI Gateway | 인증 키를 기반으로 Tenant 및 호출 시스템 식별한다. |
| 5 | AI Gateway | 요청 Model Alias에 대한 사용 권한 확인한다. |
| 6 | AI Gateway | Model Alias를 1:1로 고정 매핑된 실제 Model/Provider 정보로 매핑한다. |
| 7 | AI Gateway | Provider별 사전 발급 API Key를 사용하여 실제 AI Model을 스트리밍 방식으로 호출한다. |
| 8 | AI 플랫폼 | AI 응답을 청크(chunk) 단위로 순차 생성한다. |
| 9 | AI Gateway | Provider별 응답 청크를 수신할 때마다 표준 응답 형식으로 변환하여 개발자/Agent에게 순차 반환한다. (8~9단계는 응답이 완료될 때까지 반복) |
| 10 | AI Gateway | 스트림 종료 시 종료 신호를 반환하고, 호출 정보 및 사용량 이력을 기록한다. |

## 4. 예외/대안 시나리오

| 구분 | 내용 |
|---|---|
| ① 인증 실패 | 인증키가 유효하지 않거나 폐기된 경우 → API 호출 거부 및 인증 오류 반환 |
| ② Model 권한 부족 | Tenant에 해당 Model 사용 권한이 없는 경우 → 호출 거부 및 권한 오류 반환 |
| ③ Provider 호출 실패 | 실제 AI Provider에서 오류가 발생한 경우 → Gateway에서 오류 표준화 후 반환 |
| ④ 유량 초과 | AI 플랫폼(Provider)에서 유량제어(Rate Limit) 오류가 발생한 경우 → Gateway에서 표준 오류로 변환하여 반환 |
| ⑤ 스트리밍 중단 | 응답 스트리밍 도중 Provider와의 연결이 끊기거나 오류가 발생한 경우 → 이미 전달된 청크는 유지하고, Gateway가 표준 오류로 스트림을 종료 |

## 5. 사후 조건

- Agent는 실제 AI Provider를 직접 호출하지 않는다.
- AI Provider의 종류와 API Key가 Agent에 노출되지 않는다.
- Agent는 AI Gateway가 제공하는 단일 표준 API만 사용한다.
- Model Alias는 실제 Model/Provider와 1:1 고정 관계이며, Gateway는 Provider 장애 시에도 다른 Provider로 자동 전환(Fallback)하지 않는다. Model 변경이 필요한 경우 관리자가 UC-0302를 통해 매핑을 수동으로 변경해야 한다.
- AI Model 변경 시 Agent 수정 없이 Gateway의 Model Alias 변경으로 대응할 수 있다.
- 모든 API 호출 이력이 인증 키 단위로 관리된다.
- AI 플랫폼(Provider) 자체의 API 유량 통제 결과를 Gateway가 표준 오류 형식으로 일관되게 전달하며, Gateway는 별도의 유량 제어 로직을 중복 구현하지 않는다.

## 6. 핵심 처리 구조

Agent → AI Gateway → 인증/권한검증 → Model Alias(1:1 고정) → 실제 Model/Provider → AI Gateway(스트리밍 변환, 청크 반복) → 표준 응답 스트림 → Agent

## 7. 미결/후속 검토 사항

- 스트리밍 중단 시 이미 전달된 부분 응답(partial response)을 Agent가 유효한 응답으로 처리할지, 전체 실패로 간주하고 재시도할지 정책 확정 필요.
- Timeout 기준(몇 초/분 이상 무응답 시 중단으로 간주할지) 별도 정의 필요.
