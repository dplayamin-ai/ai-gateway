# UC-0302. AI Model을 관리한다

> ⚠️ 본 문서는 원본 PPTX(Slide 2)의 Use Case 목록에는 존재하나 상세 시나리오가 작성되지 않았던 항목입니다. 아래 내용은 UC-0102에서 확정된 사항(Model Alias-Provider 1:1 고정, Fallback 없음)을 관리자 관점에서 반영한 초안이며, 세부 절차는 별도 확정이 필요합니다.

## 1. Use Case 개요

| 항목 | 내용 |
|---|---|
| Use Case ID | UC-0302 |
| Use Case 명 | AI Model을 관리한다 |
| 주요 Actor | 관리자 |
| 주요 시스템 | AI Gateway |
| 목적 | 관리자는 AI 플랫폼 별 사용 가능한 모델Alias와 매핑 정보를 등록한다 |
| Trigger | 신규 AI Model을 Model Alias로 제공해야 하는 경우, 또는 기존 Alias의 매핑 Provider를 변경해야 하는 경우 |
| 관련 SFR | SFR-010 |

## 2. 사전 조건 (초안)

- 관리자는 AI Model 등록 권한을 보유하고 있어야 한다.
- 등록 대상 AI Model을 제공하는 AI 플랫폼(Provider)에 대한 API Key가 AI Gateway에 사전 발급·등록되어 있어야 한다.
- **(UC-0102 확정사항 반영)** 하나의 Model Alias는 하나의 실제 Model/Provider에만 매핑 가능하며, 동일 Alias에 복수 Provider를 매핑(Fallback 구조)할 수 없다.

## 3. 기본 시나리오 (초안 — 세부 단계 미확정)

| 단계 | Actor | 수행 내용 |
|---|---|---|
| 1 | 관리자 | AI Gateway 관리 화면에서 Model Alias 등록/변경을 요청한다. |
| 2 | 관리자 | Model Alias 명(예: clova, gemma4)과 매핑할 실제 Model/Provider 정보를 1:1로 입력한다. |
| 3 | AI Gateway | 입력된 Alias가 기존에 다른 Provider와 매핑되어 있지 않은지 확인한다. *(중복 매핑 방지 검증)* |
| 4 | AI Gateway | Model Alias-Provider 매핑 정보를 등록/갱신한다. |
| 5 | 관리자 | 등록된 Model Alias의 Tenant별 사용 가능 여부(권한)를 설정한다. |

## 4. 예외/대안 시나리오 (초안)

- 이미 사용 중인 Model Alias를 다른 Provider로 변경하는 경우 → **(미결)** 기존 호출에 영향이 없도록 처리하는 방식(즉시 반영/예약 반영 등) 확정 필요.
- Provider API Key가 유효하지 않은 경우 → 등록 거부

## 5. 사후 조건 (초안)

- 등록된 Model Alias는 UC-0101(인증키 신청) 시 개발자가 선택 가능한 자원 목록에 노출된다.
- 등록된 Model Alias는 UC-0102를 통해 개발자/Agent가 표준API로 호출할 수 있다.
- Model Alias 변경 시 Agent 측 코드 수정 없이 Gateway 설정 변경만으로 실제 Model 전환이 가능하다. (UC-0102 사후조건과 연결)

## 6. 미결/후속 검토 사항 (전면 재검토 필요)

- **매핑 변경 시 영향 범위**: 이미 발급된 인증키가 특정 Model Alias 사용 권한을 가진 상태에서 관리자가 해당 Alias의 실제 Provider를 교체하면, 개발자 입장에서는 예고 없이 모델이 바뀌는 효과가 발생함. 사전 공지, 변경 이력 관리, 변경 시점(즉시/예약) 등 절차 확정 필요.
- **신규 Alias 생성 vs 기존 Alias 매핑 변경 구분**: 이 UC가 두 가지 케이스를 모두 다루는지, 별도 절차로 나눌지 확정 필요.
- **Alias 명명 규칙**: Alias 이름 중복 방지, 명명 규칙(예: 소문자/버전 표기 등) 정의 필요.
- **Provider API Key 갱신/만료 관리**: Model 자체가 아니라 Gateway가 보유한 Provider API Key의 수명주기 관리가 이 UC 범위인지, 별도 UC인지 확정 필요.
