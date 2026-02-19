# OpenAI 전환 1단계 API 스펙

## 1. 목적
- 기존 [`services/geminiService.ts`](../services/geminiService.ts)의 클라이언트 직접 호출 패턴을 서버 프록시 호출로 전환
- 1단계 범위는 분석/질의 2개 API만 제공
- 모델 티어링 정책
  - 1차: `gpt-5-nano`
  - 재시도: `gpt-5-mini`

## 2. 아키텍처

```mermaid
flowchart TD
A[React App] --> B[/api/analyze]
A --> C[/api/qa]
B --> D[Supabase Edge Function analyze]
C --> E[Supabase Edge Function qa]
D --> F[gpt-5-nano]
E --> F
D --> G[gpt-5-mini fallback]
E --> G
```

## 3. 공통 정책

### 3.1 요청 헤더
- `Content-Type: application/json`
- `X-Client-Version: <semver>` optional

### 3.2 응답 공통 메타
```ts
interface ApiMeta {
  requestId: string;
  modelUsed: 'gpt-5-nano' | 'gpt-5-mini';
  fallbackUsed: boolean;
  confidence: number;
  ambiguity: boolean;
  retryReason?: 'schema_invalid' | 'missing_required' | 'low_confidence' | 'safety_refusal' | 'timeout' | 'rate_limited' | 'server_error';
}
```

### 3.3 재시도 트리거
`gpt-5-mini`로 1회 재시도
- JSON 파싱 실패
- 필수 필드 누락
- confidence < 0.80
- ambiguity true
- 모델 안전 거절
- 429, 5xx, timeout

### 3.4 임계값 정책
- 정책 타입: 보수적
- 1차 모델 `gpt-5-nano` 응답이 아래 중 하나면 즉시 fallback
  - `confidence < 0.80`
  - `ambiguity === true`
- fallback은 최대 1회
- fallback 이후에도 기준 미달이면 에러 표준 응답 또는 낮은 신뢰도 메타를 포함해 반환

### 3.4 에러 표준
```ts
interface ApiError {
  error: {
    code: 'BAD_REQUEST' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'UPSTREAM_FAILED' | 'TIMEOUT' | 'INTERNAL';
    message: string;
    requestId: string;
  };
}
```

## 4. POST /api/analyze

### 4.1 목적
- 입력 텍스트 또는 공유 링크를 구조화 문서 형태로 변환
- 기존 [`analyzeInput()`](../services/geminiService.ts) 대체

### 4.2 Request
```json
{
  "input": "string",
  "sourceType": "manual | chatgpt | gemini | claude",
  "options": {
    "language": "ko",
    "strictSchema": true
  }
}
```

### 4.3 Response
```json
{
  "data": {
    "title": "string",
    "summaryText": "string",
    "docType": "text | conversation",
    "knowledgeScore": 0,
    "topicTags": ["string"],
    "summaryBullets": ["string"],
    "conversationData": [
      { "role": "user | assistant", "content": "string", "timestamp": "optional" }
    ],
    "segments": [
      {
        "id": "string",
        "category": "string",
        "topic": "string",
        "content": "string",
        "originalRange": [1, 2],
        "relevance": 0
      }
    ],
    "actionPlan": {
      "goal": "string",
      "steps": [
        { "id": "string", "step": "string", "description": "string", "priority": "High | Medium | Low" }
      ],
      "applications": [
        { "context": "string", "suggestion": "string" }
      ]
    }
  },
  "meta": {
    "requestId": "string",
    "modelUsed": "gpt-5-nano",
    "fallbackUsed": false,
    "confidence": 0.92,
    "ambiguity": false
  }
}
```

### 4.4 Validation
- `input` 최소 1자
- `sourceType` enum 검증
- `knowledgeScore`는 0..100
- `summaryBullets` 최대 8개
- `topicTags` 최대 12개

## 5. POST /api/qa

### 5.1 목적
- 사용자 질문 + 현재 문서 컨텍스트 기반 RAG 응답 생성
- 기존 [`generateRAGAnswer()`](../services/geminiService.ts) 대체

### 5.2 Request
```json
{
  "question": "string",
  "contextDocs": [
    {
      "id": "string",
      "title": "string",
      "summaryText": "string",
      "rawText": "string",
      "topicTags": ["string"],
      "createdAt": "ISO"
    }
  ],
  "options": {
    "maxEvidence": 5,
    "language": "ko"
  }
}
```

### 5.3 Response
```json
{
  "data": {
    "answer": "string",
    "evidence": [
      {
        "id": "string",
        "title": "string",
        "snippet": "string",
        "segmentId": "optional"
      }
    ]
  },
  "meta": {
    "requestId": "string",
    "modelUsed": "gpt-5-mini",
    "fallbackUsed": true,
    "confidence": 0.74,
    "ambiguity": true,
    "retryReason": "low_confidence"
  }
}
```

### 5.4 Validation
- `question` 최소 2자
- `contextDocs` 최대 20개
- `maxEvidence` 기본 3, 최대 8

## 6. 보안 요구사항
- OpenAI API 키는 Supabase Secret로만 저장
- 브라우저 번들에 키 주입 금지
  - 변경 대상 [`vite.config.ts`](../vite.config.ts)
- CORS 허용 origin 화이트리스트
- 요청당 requestId 생성 및 로깅

## 7. 클라이언트 변경 계약
- 기존 import 경로 [`services/geminiService.ts`](../services/geminiService.ts)
- 내부 구현을 `fetch` 기반 API 호출로 교체하되 함수 시그니처는 유지
  - `detectSourceType()` 유지
  - `analyzeInput()` 유지
  - `generateRAGAnswer()` 유지

## 8. 수용 기준
- Home 흐름에서 문서 분석 성공
- Ask 흐름에서 QA 응답 성공
- fallbackUsed 메타가 UI 디버그 로그에서 확인 가능
- 클라이언트 코드에 OpenAI 키 문자열이 존재하지 않음

## 9. 후속 2단계 예고
- Postgres 영속화 documents, edges, qaSessions
- 재시도 이력 및 프롬프트 버전 테이블 추가

## 10. PRD 계승 맥락 및 현재 코드 발전사항 반영
이 스펙은 [`CopyVara_MVP_PRD_v0.3.md`](../CopyVara_MVP_PRD_v0.3.md)을 기반으로 발전된 현재 코드라인을 계승합니다.

### 10.1 이미 제품에 반영된 발전사항
- 시각화 화면에서 노드 클릭 시 페이지 전환 대신 우측 사이드 패널로 상세 탐색
  - 구현 중심: [`pages/GraphPage.tsx`](../pages/GraphPage.tsx:129)
- 홈 화면 망각 곡선 기반 오늘의 복습 큐레이션
  - 구현 중심: [`pages/Home.tsx`](../pages/Home.tsx:14)

### 10.2 본 API 스펙과의 연동 의미
- analyze API는 문서 구조화와 action plan 생성을 안정적으로 반환해야 하며
- qa API는 evidence 기반 응답을 보장해 사이드 패널 탐색 흐름과 충돌 없이 연결돼야 함
- meta 필드 fallbackUsed, confidence, ambiguity는 향후 UI에서 신뢰도 힌트로 노출 가능

### 10.3 Phase 2 고도화 방향과 API 확장 예약
- 멀티모달 입력 pdf image ocr vision
- 제로 마찰 캡처 cmdk quick capture extension webhook
- 지식 충돌 보완 감지 conflict complement signal
- 벡터 기반 자동 연결 제안 auto edge suggestion
- 출처 앵커링 citation anchoring paragraph highlight

위 항목들은 1단계 범위에는 포함하지 않으며, 본 문서의 API 계약을 유지한 채 별도 엔드포인트 또는 optional 필드로 확장합니다.

## 11. Phase 2 인터페이스 선반영 계약 (UI 미노출)

2번 전략(모델/인터페이스 선반영)에 따라, analyze 응답에 아래 optional 필드를 먼저 허용합니다.

### 11.1 Analyze Response optional 필드
```ts
interface KnowledgeRelationSignal {
  id: string;
  type: 'conflict' | 'complement';
  topic: string;
  summary: string;
  confidence: number; // 0..1
  relatedDocumentIds: string[];
  evidenceSegmentIds?: string[];
}

interface AutoLinkSuggestion {
  id: string;
  fromId: string;
  toId: string;
  relation: 'supports' | 'contradicts' | 'extends' | 'duplicates' | 'related_to';
  confidence: number; // 0..1
  rationale: string;
  status: 'suggested' | 'accepted' | 'rejected';
  generatedAt: string; // ISO
}
```

```json
{
  "data": {
    "relationSignals": [
      {
        "id": "rs-1",
        "type": "conflict",
        "topic": "RAG Chunking",
        "summary": "문서 A는 fixed chunk, 문서 B는 semantic chunk 권장",
        "confidence": 0.84,
        "relatedDocumentIds": ["d1", "d2"],
        "evidenceSegmentIds": ["s1", "s7"]
      }
    ],
    "autoLinkSuggestions": [
      {
        "id": "als-1",
        "fromId": "d-new",
        "toId": "d2",
        "relation": "contradicts",
        "confidence": 0.81,
        "rationale": "동일 토픽에서 상반된 운영전략 제시",
        "status": "suggested",
        "generatedAt": "2026-02-19T07:00:00.000Z"
      }
    ]
  }
}
```

### 11.2 클라이언트 처리 원칙
- 해당 필드는 optional이므로 누락 시 기존 로직 유지
- `autoLinkSuggestions`가 있으면 candidate 생성에 우선 사용
- UI 노출은 다음 라운드에서 진행
