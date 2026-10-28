# 개발용 검수 기준 및 테스트 시나리오

> 이 문서는 **개발·검수용 참고 자료**입니다. 웹앱 화면(사용자 인터페이스)에는 표시되지 않습니다.
> 이전에 앱 하단의 "팀 내부 검토" 패널에 있던 검수 항목을 그대로 옮겨 보존했습니다(항목 문구·식별자 동일).

## 목차

1. [검수 기준](#1-검수-기준)
2. [테스트 시나리오](#2-테스트-시나리오)
3. [자동 테스트와의 대응](#3-자동-테스트와의-대응)

---

## 1. 검수 기준

상태 값은 `미검토` · `검토 중` · `완료` · `이슈 있음` 중 하나로 기록합니다. 실제로 검토하지 않은 항목을 완료로 처리하지 않습니다.

총 42개 항목: 공통 검토 (6개 카테고리 · 19개 항목) 19개 · 김예원 — 최종 검수 기준 12개 (통합 검수 초안) 12개 · 구은서 — Phase별·시나리오별 검수 (통합 검수 초안) 11개

### 1.1 공통 검토 (6개 카테고리 · 19개 항목)

#### UI/UX (3)

| ID | 검수 항목 | English | 상태 | 메모 |
|---|---|---|---|---|
| `ux-layout` | 탭별 정보 배치와 읽기 흐름 | Information layout and reading flow per tab | 미검토 | |
| `ux-responsive` | 모바일·태블릿 반응형 레이아웃 | Mobile / tablet responsive layout | 미검토 | |
| `ux-a11y` | 키보드 조작·색 대비·다크 모드 | Keyboard use, contrast, dark mode | 미검토 | |

#### 기능 동작 (4)

| ID | 검수 항목 | English | 상태 | 메모 |
|---|---|---|---|---|
| `func-qa` | AI 질의응답 추천 질문·대체 안내 | Q&A presets and fallback notice | 미검토 | |
| `func-checklist` | 체크리스트 검토/수령 상태 분리 | Checklist review vs. receipt separation | 미검토 | |
| `func-email` | 이메일 초안 생성·편집·복사 | Email draft generate / edit / copy | 미검토 | |
| `func-validation` | 세정 전후 비교·실측 입력 | Pre/post comparison and measured input | 미검토 | |

#### 계산 로직 (3)

| ID | 검수 항목 | English | 상태 | 메모 |
|---|---|---|---|---|
| `calc-default` | 기본값 결과 (70 / 1.05 / 105,840,000) | Default results (70 / 1.05 / 105,840,000) | 미검토 | |
| `calc-breakeven` | 손익분기점 예시 (24일) | Break-even example (24 days) | 미검토 | |
| `calc-consistency` | 탭 간 수치 일관성 | Cross-tab number consistency | 미검토 | |

#### 공학적 기준 (3)

| ID | 검수 항목 | English | 상태 | 메모 |
|---|---|---|---|---|
| `eng-coeff` | 발전 손실 계수 0.015의 근거 | Basis for the 0.015 loss coefficient | 미검토 | |
| `eng-threshold` | 배압 임계값 270/300의 근거 | Basis for 270/300 thresholds | 미검토 | |
| `eng-pinch` | Pinch/Approach 계산 기준 | Pinch/approach calculation basis | 미검토 | |

#### 데이터 연동 준비 (2)

| ID | 검수 항목 | English | 상태 | 메모 |
|---|---|---|---|---|
| `data-format` | 요청 데이터 형식·단위 정의 | Requested data formats and units | 미검토 | |
| `data-replace` | 가상값 → 실측값 교체 경로 | Mock → measured replacement path | 미검토 | |

#### 보안 및 표현 (4)

| ID | 검수 항목 | English | 상태 | 메모 |
|---|---|---|---|---|
| `sec-name` | 기업명 표기 (클라우드라) | Partner name wording (클라우드라) | 미검토 | |
| `sec-citation` | 미제공 문서 인용 없음 | No citation of unprovided documents | 미검토 | |
| `sec-ai` | AI/RAG 미연동 고지 | AI/RAG not-connected notice | 미검토 | |
| `sec-mock` | 가상/실측 데이터 구분 표시 | Mock vs. measured distinction | 미검토 | |

### 1.2 김예원 — 최종 검수 기준 12개 (통합 검수 초안)

> **통합 검수 초안** — 원본 검수 기준 미제공 — 아래 문항은 이번 통합 작업에서 정리한 통합 검수 초안이며 원본이 아닙니다. 원본을 받으면 교체해야 합니다.

#### 최종 검수 초안 (12)

| ID | 검수 항목 | English | 상태 | 메모 |
|---|---|---|---|---|
| `kim-01` | 대시보드 기본 진입 · 사이드바 이동 | Dashboard default entry · sidebar navigation | 미검토 | |
| `kim-02` | 케이스 생성·복제·삭제·전환 및 데이터 격리 | Case create/duplicate/delete/switch and data isolation | 미검토 | |
| `kim-03` | 기본 예시 계산값 105,840,000원 일치 | Default example result 105,840,000 KRW | 미검토 | |
| `kim-04` | MW→kW 단위 변환과 경제성 항목 분리 | MW→kW conversion and separated economics items | 미검토 | |
| `kim-05` | 비정상 입력 시 결과 무효화 (— · 산출 불가) | Invalid input invalidates results (— · not computable) | 미검토 | |
| `kim-06` | DEMO / 사용자 입력 모드 구분 | DEMO vs user-input mode | 미검토 | |
| `kim-07` | 세정 전후 검증 기능의 계산기 이전 | Pre/post validation moved into calculator | 미검토 | |
| `kim-08` | 체크리스트 수령·검토 상태 분리와 진행률 | Checklist receipt vs review and progress | 미검토 | |
| `kim-09` | 이메일 초안 생성·복사 (발송 없음) | Email draft generate/copy (no sending) | 미검토 | |
| `kim-10` | 계산기→AI 결과 전달 · AI→체크리스트 이동 | Calculator→AI result hand-off · AI→checklist jump | 미검토 | |
| `kim-11` | 새로고침 후 상태 복원 (localStorage) | State restored after reload (localStorage) | 미검토 | |
| `kim-12` | 가상/실측 표시 및 미연동 기능 고지 | Mock vs measured labelling and not-connected notices | 미검토 | |

### 1.3 구은서 — Phase별·시나리오별 검수 (통합 검수 초안)

> **통합 검수 초안** — 원본 검수 기준 미제공 — 아래 문항은 이번 통합 작업에서 정리한 통합 검수 초안이며 원본이 아닙니다. 원본을 받으면 교체해야 합니다.

#### Phase별 (6)

| ID | 검수 항목 | English | 상태 | 메모 |
|---|---|---|---|---|
| `koo-p1` | Phase 1 · 공통 데이터 구조·로컬 저장 | Phase 1 · Shared data model & local storage | 미검토 | |
| `koo-p2` | Phase 2 · 사이드바·대시보드·반응형 | Phase 2 · Sidebar, dashboard, responsive | 미검토 | |
| `koo-p3` | Phase 3 · 계산기 (입력·모드·시나리오·경제성) | Phase 3 · Calculator (inputs, modes, scenarios, economics) | 미검토 | |
| `koo-p4` | Phase 4 · 체크리스트 (검색·필터·이메일) | Phase 4 · Checklist (search, filters, email) | 미검토 | |
| `koo-p5` | Phase 5 · AI 질의응답 (구조화 답변·스냅샷) | Phase 5 · AI Q&A (structured answers, snapshots) | 미검토 | |
| `koo-p6` | Phase 6 · 차트·개념도·언어·테마 | Phase 6 · Charts, diagram, language, theme | 미검토 | |

#### 시나리오별 (5)

| ID | 검수 항목 | English | 상태 | 메모 |
|---|---|---|---|---|
| `koo-s1` | 정상 시나리오 프리셋 | Normal scenario preset | 미검토 | |
| `koo-s2` | 경보 시나리오 프리셋 (기본값) | Alarm scenario preset (default) | 미검토 | |
| `koo-s3` | 트립 시나리오 프리셋 | Trip scenario preset | 미검토 | |
| `koo-s4` | 수동 입력 → 사용자 지정 전환 | Manual input → switches to custom | 미검토 | |
| `koo-s5` | 잘못된 입력 → 산출 불가 | Invalid input → not computable | 미검토 | |

---

## 2. 테스트 시나리오

통합 사양 구현 때 브라우저에서 실제로 실행한 검증 시나리오입니다. 기대 결과는 기본 DEMO 입력값 기준입니다.

| ID | 시나리오 | 조작 | 기대 결과 |
|---|---|---|---|
| T01 | 대시보드 기본 진입 | 앱 첫 실행 (#/ 또는 해시 없음) | 대시보드가 열리고 최상단에 AI 질의응답이 보이며, 사이드바는 대시보드 / 계산기 / 데이터 요청 체크리스트 / 세정 전후 순서 |
| T02 | 사이드바 이동 | 사이드바에서 계산기 선택 | URL이 #/calculator로 바뀌고 계산기 화면이 열린다 |
| T03 | 모바일 메뉴 | 폭 390px에서 햄버거 메뉴 → 메뉴 선택 | 드로어가 열렸다 닫히고 해당 화면으로 이동, 가로 넘침 없음 |
| T04 | 케이스 생성·복제·삭제·전환 | 케이스 관리에서 새 케이스·복제·삭제(확인)·선택 | 목록 수가 기대대로 변하고 마지막 케이스는 삭제 불가 |
| T05 | 케이스별 데이터 격리 | 케이스 B에서 배압 300 입력 후 케이스 A로 전환 | 케이스 A는 320 유지, 체크리스트도 독립 |
| T06 | 입력값 변경 시 계산 갱신 | 현재 배압 280 입력 | 월간 손실 45,360,000원, 시나리오 "사용자 지정" |
| T07 | 기본 예시 계산값 | 기본값 (320 / 250 / 720 h / 140 원/kWh) | KPI 320 · 70 · 1.05 · 105,840,000원 |
| T08 | MW→kW 단위 변환 | 기본값에서 계산 결과 카드 확인 | 추가 발전 매출 110,880,000원 (1.1 × 1000 × 720 × 140) |
| T09 | 비정상 입력 무효화 | SMP에 "abc", 세정 비용에 "-5" 입력 | 의존 결과 "—" + 산출 불가, 음수 오류 문구, NaN/Infinity 없음 |
| T10 | DEMO/사용자 입력 모드 | 평가 모드를 사용자 입력으로 전환 | 배압 기반 손실은 "모델 미연동", 경제성 산술값은 유지 |
| T11 | 시나리오 프리셋 | 정상 / 경보 / 트립 선택 | 배압·차압이 255/22, 320/28.6, 360/34로 반영 |
| T12 | 배압 자동 상태 판별 | 정상·트립 프리셋 적용 | 자동 판별 정상 / 위험 — 선택 시나리오와 별도 표시 |
| T13 | 핀치/어프로치 미산출 | 계산기 Pinch/Approach 패널 확인 | "분석 대기 — 설계 데이터 및 물성 기준 필요" |
| T14 | 세정 전후 시계열 | 사이드바 "세정 전후" 선택 | 세정 전 30일·후 60일 시계열과 세정 시점 표시 (계산기에는 이 섹션 없음) |
| T15 | 실측 스냅샷 마커 | 경과일 −5, 배압 318 입력 | 다이아몬드 마커 1개가 가상 시계열과 구분되어 표시 |
| T16 | 체크리스트 검색·필터 | "Drum" 검색, 수령 완료/미수신 필터 | 검색 1건, 필터별 건수 일치 |
| T17 | 수령률과 검토율 분리 | 상태 변경 / 검토 체크·전체 선택 | 수령률과 검토율이 서로 바뀌지 않음 |
| T18 | 이메일 초안 및 복사 | "요청 필요" 지정 → 고객사명 입력 → 초안 생성 → 복사 | 항목·고객사 포함, 실제 주소 없음, "발송되지 않았습니다" 안내 |
| T19 | 계산기 → AI 결과 전달 | "이 결과 질문하기" → 전송 | 대시보드 최상단 AI 영역으로 이동, 스냅샷 첨부, 답변이 105,840,000원 인용 |
| T20 | AI → 체크리스트 이동 | 답변의 "체크리스트에서 보기" | 체크리스트 해당 행으로 스크롤·강조 |
| T21 | 미등록 질문 처리 | "오늘 점심 메뉴 추천해줘" 전송 | "확인 가능한 공학 데이터 범위를 벗어났습니다…" 안내 |
| T22 | 새로고침 후 상태 복원 | 작업 후 새로고침 | 케이스·체크리스트·분석 이력·AI 대화 복원 |
| T23 | 언어 전환 | EN 선택 후 4개 화면 확인 | 화면 문구 번역 (사용자 입력 데이터 제외) |
| T24 | 테마 전환 | 다크 선택 | data-theme="dark" 적용 |
| T25 | 기존 기능 회귀 | HRSG 개념도 hover, 게이지, #/validation 주소, 예전 #/qa 주소 | 설명 표시, 게이지 320, 세정 전후 화면 열림, #/qa는 대시보드 AI 영역으로 이동 |
| T26 | 프로덕션 빌드 | npm run build | 오류·경고 없이 성공 |
| T27 | 질문 기록 저장 | 추천 질문 1개, 직접 질문 1개 전송 | 질문 기록에 2건, 최신순, 각 기록에 질문·답변 제목·일시(초 단위)·케이스 |
| T28 | 질문 기록 조회 | 기록 하나 클릭 | 질문 전체와 답변 ①~⑥ 전체, DEMO 배지, 질문·답변 일시 표시 |
| T29 | 질문 기록 삭제 | 개별 "삭제" / "전체 삭제" → 확인 | 해당 기록만 삭제 / 확인 단계 후 모두 삭제, 대화는 그대로 |
| T30 | 질문 기록 유지 | 새로고침 | 기록 유지, 기능 도입 전 대화는 소급 기록되지 않음 |
| T31 | 바로가기 카드 제거 | 대시보드 하단 확인 | "바로가기" 카드 없음, 다른 대시보드 카드는 모두 유지 |

### 시나리오별 운전 조건 (DEMO 프리셋)

| 시나리오 | 현재 배압 | 차압 ΔP | 배압 자동 판별 | 활성 경보(DEMO 규칙) |
|---|---:|---:|---|---:|
| 정상 | 255 mmH₂O | 22.0 mbar | 정상 | 0 |
| 경보 (기본값) | 320 mmH₂O | 28.6 mbar | 위험 | 1 |
| 트립 | 360 mmH₂O | 34.0 mbar | 위험 | 2 |
| 사용자 지정 | 입력값 | 입력값 | 입력값 기준 | 규칙 기준 |

---

## 3. 자동 테스트와의 대응

`npm test`(Node 내장 `node:test`)로 계산·데이터 규칙을 자동 검증합니다.

| 파일 | 대응 시나리오 |
|---|---|
| `tests/calc.test.ts` | T07, T08, T09, T12, T14 (계산식·단위·경계·파싱) |
| `tests/data.test.ts` | T16~T18, T21 (체크리스트 22개, 질문 매칭, 이메일 초안) |
| `tests/integration.test.ts` | T04, T05, T09, T10, T17, T19, T22 (경제성 표준식, 모드 게이팅, 케이스 격리·저장, AI 수치 인용 규칙) |
| `tests/qaHistory.test.ts` | T27~T30 (질문 기록 저장·최신순·중복 방지·삭제·재로딩 복원·손상 데이터) |

화면 조작이 필요한 시나리오(T01~T03, T11, T13, T15, T20, T23~T25, T28, T31)는 위 표의 절차대로 브라우저에서 확인합니다.
