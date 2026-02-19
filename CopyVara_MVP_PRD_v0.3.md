# CopyVara(카피바라) — 개발용 PRD (MVP) v0.3 (촘촘 버전)
작성일: 2026-02-14  
문서 오너: Product  
대상: FE(Flutter Web 우선), BE, AI/ML, Design, QA  
범위: **MVP (웹 우선)**

> 참고(방향성): “복사-붙여넣기 기반의 고효율 지식 자산화”, “NLP+RAG+pgvector로 의미 유사도 기반 자동 연결”, “지식 그래프 시각화”, “Freemium + Pro”, “Flutter 기반 크로스플랫폼/웹 우선 MVP”를 전제로 설계.

---

## 0) TL;DR

### 0.1 MVP 목표(한 문장)
사용자가 **Ctrl+V**로 텍스트를 입력하면, 시스템이 **요약**하고 **관련 지식 후보를 추천/연결(candidate)**하며, 사용자는 **그래프/검색/Q&A(RAG)**로 즉시 재사용한다.

### 0.2 Definition of Done (MVP 출시 조건)
신규 사용자가 가입 후 **첫 Paste**에서 60초 내에:
1) 요약(요약문 + 핵심 bullet)이 생성되고  
2) 관련 추천(Top-K) 3~10개가 뜨며(근거/유사도 포함)  
3) 그래프에서 연결이 보이고(확정/추천 스타일 구분)  
4) “내 지식에게 질문하기”에서 **근거 노드 링크를 포함한 답변**이 나온다.

### 0.3 MVP 핵심 원칙
- **마찰 최소화**: 입력은 1번(붙여넣기) / 나머지는 자동
- **근거 기반**: 모든 요약/답변/추천은 원문(문서/청크)로 추적 가능
- **추천→확정 구조**: 링크는 기본 candidate, 사용자가 1클릭 확정/거절
- **가벼운 그래프**: MVP는 Postgres + Edge 테이블(그래프 DB는 v2 검토)

---

## 1) 용어(Glossary) / 개념

- **Workspace**: 사용자 지식 공간(개인 1개 기본)
- **Document**: 붙여넣기/업로드 1회로 생성되는 “원본 단위”
- **Chunk**: Document를 의미 단위로 나눈 최소 단위(탐색/근거/재구성의 핵심)
- **Embedding**: 문서/청크 의미 벡터(pgvector 저장)
- **Link Candidate**: 자동 추천 연결(사용자 확정 전)
- **Edge(Confirmed Link)**: 사용자가 확정한 연결(그래프 기본)
- **Evidence**: 요약/답변/추천이 참조한 근거(문서/청크 id + snippet)
- **RAG Q&A**: 사용자 질문 → 관련 지식 검색 → 근거 기반 답변 생성

---

## 2) 문제/가설/목표

### 2.1 사용자 문제(Problem)
- AI 대화/메모가 폭증하지만 파편적으로 흩어져 재활용되지 못함
- 기존 도구는 태그/링크/분류를 사용자가 해야 해서 “정리 노동”이 누적됨
- 데이터가 쌓일수록 과거-현재 연결이 어려워져 지적 생산성이 하락

### 2.2 제품 가설(Hypothesis)
H1. “복붙 1번”의 낮은 마찰로 기록 빈도가 증가한다.  
H2. **자동 요약 + 유사 연결 추천**만으로도 정리 부담 감소를 체감한다.  
H3. 그래프는 장식이 아니라 “탐색(근거 점프)”이 가능할 때 재방문이 늘어난다.  
H4. RAG 답변에 “근거 링크”를 항상 제공하면 신뢰가 유지된다.

### 2.3 성공 지표(Success Metrics)
**Activation**
- A1 가입 후 10분 내 첫 Paste 성공률 ≥ 60%
- A2 첫 Paste 후 60초 내 요약 생성 성공률 ≥ 95%
- A3 첫 Paste 후 추천 3개 이상 노출률 ≥ 80%

**Engagement/Retention**
- E1 WAU 중 주 3회 이상 Paste 비율 ≥ 25%
- E2 Search/Graph/Q&A 중 1개 이상 사용 비율 ≥ 40%

**AI 품질**
- Q1 링크 후보 확정률 ≥ 30% (초기 목표)
- Q2 링크 후보 거절률 ≤ 50% (점진 개선)
- Q3 Q&A에서 evidence 클릭률 ≥ 15%

**성능**
- P1 Paste→첫 결과(요약+추천 리스트) p95 ≤ 20초
- P2 Graph 첫 로딩 p95 ≤ 2.5초(기본 범위/캐시 적용)
- P3 Q&A 응답 p95 ≤ 15초(근거 포함)

---

## 3) 범위(Scope) / Non-goals

### 3.1 MVP In-Scope (P0)
- 텍스트 붙여넣기(원문 저장)
- Chunking(최소 규칙 기반) + 요약 생성
- 문서 임베딩 생성 + pgvector 저장
- 유사 검색 Top-K + 링크 후보 생성
- 링크 후보 **확정/거절**(학습 루프 & 신뢰 확보)
- 그래프 뷰(MVP) + 필터(기간/확정여부)
- 검색(키워드 + 의미검색)
- Q&A(RAG): 답변 + evidence 리스트(필수)
- 로그인(이메일 or 소셜 1종) + 개인 워크스페이스
- 무료 플랜 사용량 제한(일일 paste/summary/qa)

### 3.2 MVP Out-of-Scope (Non-goals)
- Notion급 편집기/데이터베이스(테이블) 기능
- 팀 협업(권한/공유/감사로그/공동편집)
- 모든 파일 포맷 완벽 파싱(PDF/Word/웹클립 완성형은 v1+)
- Neo4j/Temporal graph(그래프DB는 v2 검토)
- 정교 관계(refined_into 등) 풀세트 자동 추출(초기는 related_to 중심)
- 온디바이스/로컬 퍼스트(장기 옵션)

---

## 4) 사용자 플로우(User Flow)

### 4.1 핵심 루프(Loop)
1) Paste (Home)  
2) Pipeline 실행: chunk → summarize → embed → link-candidates 생성  
3) Document Detail에서 요약/추천 확인  
4) 후보 링크 확정/거절  
5) Graph에서 연결 탐색  
6) Search/Q&A로 재사용 → 다시 Paste

### 4.2 실패/복구 플로우
- pipeline 일부 단계 실패 시: 상태 표시 + 재시도
- Q&A 근거 부족 시: “관련 데이터 부족” 템플릿 + 추천 액션(더 붙여넣기)

---

## 5) IA (Information Architecture) / 화면 목록

1) **Auth**: Login/Signup  
2) **Home**: Paste + 최근 문서 리스트  
3) **Document Detail**: 요약/청크/추천/확정-거절  
4) **Graph**: 그래프 + 필터 + 상세 패널  
5) **Search**: 키워드/의미검색  
6) **Ask**: Q&A + evidence 링크  
7) **Settings**: 사용량/플랜/데이터 삭제

---

## 6) 화면별 상세 명세(컴포넌트/상태/이벤트)

아래는 “디자인-개발-분석”이 바로 맞물리도록, 화면 상태/빈화면/에러/이벤트까지 포함.

### 6.1 Auth
**컴포넌트**
- 이메일 입력 + 매직링크(또는 OAuth 버튼 1종)
- 약관/개인정보 안내 링크

**상태**
- loading / error_invalid_email / error_rate_limited

**이벤트**
- auth_signed_up, auth_logged_in, auth_login_failed

---

### 6.2 Home (Paste)
**컴포넌트**
- Paste 입력 박스(placeholder: “여기에 붙여넣으세요. Ctrl+V 한 번이면 끝.”)
- Source selector(접힘 기본): manual/chatgpt/gemini/claude/perplexity/other
- 버튼: [저장] [샘플 넣기(옵션)]
- 최근 문서 리스트 카드: title(자동), created_at, status, summary 1줄
- 상태 뱃지: queued/processing/done/failed

**상태**
- Empty: “아직 저장된 지식이 없어요. 첫 Ctrl+V를 해보세요.”
- Processing: “요약 중… / 연결 찾는 중…”
- Failed: “처리에 실패했어요. 재시도 해볼까요?” + [재시도]

**행동/규칙**
- 제출 시 raw_text 길이 제한(예: 20k chars). 초과 시 업로드/분할 안내.
- 중복 제출 방지: Idempotency-Key로 같은 텍스트 재전송 시 동일 문서 반환(옵션)

**이벤트**
- doc_pasted(text_length, source_type)
- doc_pipeline_stage_changed(stage, status)
- doc_opened_from_home

---

### 6.3 Document Detail
**컴포넌트**
- Header: title(자동), source_type, created_at, status
- Summary panel: summary_text + bullets
- Chunks: chunk list(접힘/펼침), “근거로 사용됨” 하이라이트(가능하면)
- Related 후보: candidate cards(Top-K)
  - to_doc title + snippet + similarity/confidence
  - rationale(짧게): “공통 주제/키워드” 또는 “유사도 기반”
  - 액션: [확정] [거절]
- Confirmed links: 확정된 연결 목록 + [삭제]

**상태**
- Summary loading / error + 재시도
- Candidates empty: “아직 연결할만한 과거 지식이 없어요. 더 붙여넣으면 똑똑해져요.”
- Candidates loading / partial loading

**이벤트**
- doc_viewed
- link_candidate_shown(count, avg_confidence)
- link_candidate_accepted(candidate_id, confidence)
- link_candidate_rejected(candidate_id, confidence)
- edge_deleted(edge_id)

---

### 6.4 Graph
**컴포넌트**
- Filter panel
  - 기간: 7d/30d/all
  - include_candidates: on/off
  - only_confirmed: on/off(기본 on 권장)
  - node type: document (MVP 고정), chunk(v1)
- Graph canvas
  - 노드: title/짧은 라벨, 생성일 tooltip
  - 엣지 스타일: confirmed(실선), candidate(점선)
- Detail panel(오른쪽)
  - 선택 노드 요약/원문 preview
  - 연결 목록(확정/후보) + 액션(확정/거절/삭제)

**성능/과밀 제어**
- 기본 로딩은 limit_nodes=200 + 최근 30일
- 더보기/확장 버튼(옵션)

**상태**
- Loading / Empty / Error
- Empty: “아직 그래프를 만들 지식이 부족해요. 먼저 몇 개 붙여넣어 주세요.”

**이벤트**
- graph_viewed(range, include_candidates, nodes_count, edges_count)
- graph_node_clicked(node_id)
- evidence_clicked(from=graph)

---

### 6.5 Search
**컴포넌트**
- 탭: Keyword / Semantic
- 검색창 + Enter
- 결과 리스트: title + snippet + created_at + (semantic일 때 similarity)
- 결과 클릭 시 Document Detail로 이동

**상태**
- Empty query / Empty result / Error
- Semantic 검색 시 embedding 생성 로딩 표시

**이벤트**
- search_keyword_executed(q, results_count)
- search_semantic_executed(q, results_count, top_similarity)

---

### 6.6 Ask (RAG)
**컴포넌트**
- 질문 입력 + [질문하기]
- 답변 영역(스트리밍 optional)
- Evidence 리스트(필수)
  - title + snippet + [원문 보기] 링크

**정책**
- evidence가 부족하면 템플릿:
  - “저장된 정보가 부족해요. 관련 대화/메모를 더 붙여넣으면 더 정확해져요.”
- 답변에는 절대 “근거 없는 단정” 금지

**이벤트**
- qa_asked(question_length)
- qa_answer_shown(evidence_count)
- evidence_clicked(from=qa)

---

### 6.7 Settings
**컴포넌트**
- Plan/Usage: 오늘 사용량 & 제한
- 데이터 삭제: 문서 단위 삭제(P1), 워크스페이스 전체 삭제(P0 권장)
- 개인정보/약관 링크

**이벤트**
- usage_limit_hit(action=paste|summary|qa)
- workspace_deleted

---

## 7) 기능 요구사항(Functional Requirements) — 티켓화 가능 단위

### 7.1 Ingestion

**FR-ING-001 텍스트 붙여넣기**
- 사용자는 텍스트를 제출하여 Document를 생성할 수 있다.
- 시스템은 원문을 저장하고 pipeline job을 큐잉한다.

**AC (Gherkin)**
- Given 로그인 상태
- When 사용자가 텍스트를 붙여넣고 저장
- Then document.status=queued
- And pipeline job이 생성된다

**Edge Cases**
- 빈 텍스트: 400 EMPTY_TEXT
- 너무 긴 텍스트: 400 TEXT_TOO_LARGE(분할 안내)
- 동일 텍스트 연속 제출: idempotency로 중복 방지(옵션)

---

### 7.2 Pipeline (chunk → summarize → embed → link)

**FR-PIPE-001 Chunking**
- 시스템은 Document를 chunk로 분리한다(규칙 기반 MVP).
- chunk는 order(index)를 가진다.

**AC**
- Then chunks.count >= 1
- And chunk_index가 0..n-1 연속

**FR-PIPE-002 Summarize**
- 시스템은 Document에 대해 summary_text(1문단) + bullets(3~7)를 생성한다.
- 결과는 JSON 파싱 가능해야 한다(LLM 출력 강제).

**FR-PIPE-003 Embedding**
- 시스템은 Document embedding을 생성하여 embeddings 테이블에 저장한다.

**FR-PIPE-004 Candidate Links**
- 시스템은 신규 Document embedding으로 workspace 범위에서 Top-K 유사 문서를 검색하여 후보를 생성한다.
- 후보는 기본 status=candidate, relation=related_to

**FR-PIPE-005 Candidate 노출 정책**
- self-link 금지
- 이미 rejected 된 pair는 재생성 금지
- 이미 confirmed된 pair는 후보로 생성하지 않음

---

### 7.3 Link Management

**FR-LINK-001 후보 확정(accept)**
- 사용자는 후보 링크를 확정하여 confirmed edge를 만들 수 있다.

**FR-LINK-002 후보 거절(reject)**
- 사용자는 후보 링크를 거절할 수 있으며, 동일 pair는 재노출되지 않는다.

**FR-LINK-003 확정 링크 삭제**
- 사용자는 confirmed edge를 삭제할 수 있다.

**AC**
- accept 후 그래프/상세에 즉시 반영
- reject 후 후보 카드 제거 + 재노출 방지

---

### 7.4 Graph / Search / Ask

**FR-GR-001 그래프 데이터 조회**
- range/limit/include_candidates 기반으로 nodes/edges 반환

**FR-SR-001 키워드 검색**
- title/summary/raw_text_preview 대상으로 검색

**FR-SR-002 의미 검색**
- query 임베딩 생성 후 pgvector Top-K 검색

**FR-QA-001 Q&A(RAG)**
- 질문 임베딩 → Top-K 문서 검색 → context 구성 → 답변 생성
- 답변은 evidence 리스트를 반드시 포함

---

### 7.5 Usage / Rate limit

**FR-USG-001 사용량 집계**
- workspace별 일자별 paste/summary/qa count 집계

**FR-USG-002 제한**
- 제한 초과 시 429 RATE_LIMITED + 업셀 안내

---

## 8) 비기능 요구사항(Non-Functional)

### 8.1 보안
- 모든 API는 workspace 스코프를 강제(다른 workspace 데이터 접근 금지)
- HTTPS, JWT 만료/재발급
- 원문/요약/임베딩 접근은 인증 필수

### 8.2 개인정보/데이터
- 워크스페이스 전체 삭제(P0): soft delete → 배치로 hard delete(정책 결정)
- 로그/이벤트는 개인정보 최소화(원문 텍스트 이벤트로 보내지 않기)

### 8.3 성능
- pipeline async + 상태 폴링/SSE
- 그래프 limit + 기간 필터 기본

---

## 9) 시스템 아키텍처(권장)

- FE: Flutter Web(우선)  
- BE API: REST + JWT  
- DB: PostgreSQL + pgvector  
- Object Storage: raw_text를 분리 저장(옵션: 초기엔 DB text로 시작 가능)  
- Worker/Queue: pipeline 비동기 처리(예: Redis queue, SQS, etc)  
- Observability: stage별 latency/에러/비용 대시보드

### 9.1 Pipeline Job 상태 머신
- queued → running(stage=chunk) → running(stage=summarize) → running(stage=embed) → running(stage=link) → done  
- stage 실패 시 failed(stage=...) + retry 가능  
- retry는 **idempotent** 해야 함(동일 결과 재생성 가능)

---

## 10) 데이터 모델(ERD 수준) + 인덱스/제약 + SQL DDL

### 10.1 ENUM
- document_status: queued | processing | done | failed
- link_status: candidate | accepted | rejected
- entity_type: document | chunk

### 10.2 테이블(필드 요약)

#### users
- id uuid pk
- email text unique
- created_at timestamptz

#### workspaces
- id uuid pk
- owner_user_id uuid fk(users.id)
- name text
- plan_type text default 'free'
- created_at timestamptz

#### documents
- id uuid pk
- workspace_id uuid fk(workspaces.id)
- source_type text
- title text null
- raw_text text (초기) / raw_text_key text (스토리지로 분리 시)
- raw_text_hash text (중복/캐시)
- status document_status
- summary_text text null
- summary_bullets jsonb null
- created_at timestamptz
- updated_at timestamptz

Index:
- (workspace_id, created_at desc)
- (workspace_id, status)

(옵션) FTS:
- tsv tsvector generated from title+summary_text+raw_text_preview
- GIN(tsv)

#### chunks
- id uuid pk
- workspace_id uuid
- document_id uuid fk(documents.id)
- chunk_index int
- text text
- created_at timestamptz

Constraint: unique(document_id, chunk_index)  
Index: (document_id, chunk_index)

#### embeddings
- id uuid pk
- workspace_id uuid
- entity_type entity_type
- entity_id uuid
- embedding vector(EMBED_DIM)
- model_version text
- created_at timestamptz

Constraint: unique(workspace_id, entity_type, entity_id, model_version)  
Index: (workspace_id, entity_type)  
Vector index: HNSW/IVFFLAT(선택)

#### edge_candidates
- id uuid pk
- workspace_id uuid
- from_type entity_type
- from_id uuid
- to_type entity_type
- to_id uuid
- relation text default 'related_to'
- confidence float
- status link_status default 'candidate'
- rationale text null
- created_at timestamptz
- updated_at timestamptz

Constraint: unique(workspace_id, from_type, from_id, to_type, to_id, relation)  
Index: (workspace_id, status)

#### edges
- id uuid pk
- workspace_id uuid
- from_type entity_type
- from_id uuid
- to_type entity_type
- to_id uuid
- relation text
- confidence float
- created_at timestamptz

Constraint: unique(workspace_id, from_type, from_id, to_type, to_id, relation)  
Index: (workspace_id, from_id)  
Index: (workspace_id, to_id)

#### qa_sessions
- id uuid pk
- workspace_id uuid
- question_text text
- answer_text text
- evidence jsonb  // [{entity_type, entity_id, snippet}]
- created_at timestamptz

Index: (workspace_id, created_at desc)

#### usage_daily
- id uuid pk
- workspace_id uuid
- date date
- paste_count int default 0
- summary_count int default 0
- qa_count int default 0

Constraint: unique(workspace_id, date)

#### jobs
- id uuid pk
- workspace_id uuid
- document_id uuid
- job_type text  // chunk|summarize|embed|link
- status text    // queued|running|done|failed
- attempts int default 0
- last_error text null
- created_at timestamptz
- updated_at timestamptz

Index: (status, created_at)

---

### 10.3 SQL DDL (초안)
> 실제 EMBED_DIM/인덱스는 임베딩 모델 결정 후 확정

```sql
-- pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- enums
DO $$ BEGIN
  CREATE TYPE document_status AS ENUM ('queued','processing','done','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE link_status AS ENUM ('candidate','accepted','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE entity_type AS ENUM ('document','chunk');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  plan_type text NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  source_type text NOT NULL DEFAULT 'manual',
  title text,
  raw_text text NOT NULL,
  raw_text_hash text NOT NULL,
  status document_status NOT NULL DEFAULT 'queued',
  summary_text text,
  summary_bullets jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_ws_created ON documents(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_ws_status  ON documents(workspace_id, status);

CREATE TABLE IF NOT EXISTS chunks (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_doc_idx ON chunks(document_id, chunk_index);

-- NOTE: embedding vector(EMBED_DIM) 예: vector(1536)
CREATE TABLE IF NOT EXISTS embeddings (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  entity_type entity_type NOT NULL,
  entity_id uuid NOT NULL,
  embedding vector(1536) NOT NULL,
  model_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, entity_type, entity_id, model_version)
);

CREATE INDEX IF NOT EXISTS idx_embeddings_ws_type ON embeddings(workspace_id, entity_type);

-- candidate links
CREATE TABLE IF NOT EXISTS edge_candidates (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  from_type entity_type NOT NULL,
  from_id uuid NOT NULL,
  to_type entity_type NOT NULL,
  to_id uuid NOT NULL,
  relation text NOT NULL DEFAULT 'related_to',
  confidence float NOT NULL,
  status link_status NOT NULL DEFAULT 'candidate',
  rationale text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, from_type, from_id, to_type, to_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_edgecand_ws_status ON edge_candidates(workspace_id, status);

-- confirmed edges
CREATE TABLE IF NOT EXISTS edges (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  from_type entity_type NOT NULL,
  from_id uuid NOT NULL,
  to_type entity_type NOT NULL,
  to_id uuid NOT NULL,
  relation text NOT NULL,
  confidence float NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, from_type, from_id, to_type, to_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_edges_ws_from ON edges(workspace_id, from_id);
CREATE INDEX IF NOT EXISTS idx_edges_ws_to   ON edges(workspace_id, to_id);
```

---

### 10.4 pgvector 유사 검색 쿼리 예시
```sql
-- cosine distance: (embedding <=> query_embedding) 가 작을수록 유사
-- similarity = 1 - cosine_distance
SELECT
  e.entity_id AS document_id,
  (1 - (e.embedding <=> $1)) AS similarity
FROM embeddings e
WHERE e.workspace_id = $2
  AND e.entity_type = 'document'
ORDER BY e.embedding <=> $1
LIMIT $3;
```

**후보 생성 시 제외 룰**
- self 제외: entity_id != new_doc_id
- rejected pair 제외: (from_id=new_doc_id AND to_id IN rejected) OR 대칭 고려(옵션)
- already confirmed 제외: edges에 존재하면 제외

---

## 11) API 스펙 (요청/응답/에러/멱등)

### 11.1 공통
- Auth: `Authorization: Bearer <jwt>`
- Idempotency: POST 계열은 `Idempotency-Key` 헤더 지원(권장)
- Pagination: cursor 기반 `{ items: [], next_cursor }`
- 표준 에러 포맷:
```json
{ "error": { "code": "SOME_CODE", "message": "human readable", "details": {} } }
```

### 11.2 에러 코드 표준(초안)
- 400: EMPTY_TEXT, TEXT_TOO_LARGE, INVALID_PARAM, INVALID_CURSOR
- 401: UNAUTHORIZED
- 403: FORBIDDEN
- 404: NOT_FOUND
- 409: CONFLICT (중복/제약)
- 422: UNPROCESSABLE (LLM JSON 파싱 실패 등)
- 429: RATE_LIMITED
- 500: INTERNAL
- 503: UPSTREAM_TIMEOUT (LLM/embedding provider)

---

### 11.3 Documents

#### POST /v1/documents
Headers: Idempotency-Key(optional)

Request
```json
{ "raw_text": "....", "source_type": "manual" }
```
Response
```json
{ "document_id": "uuid", "status": "queued" }
```

#### GET /v1/documents?cursor=&limit=
Response
```json
{ "items": [ {"id":"uuid","title":"...","status":"done","created_at":"...","summary_text":"..."} ], "next_cursor": "..." }
```

#### GET /v1/documents/{id}
Response
```json
{
  "id":"uuid",
  "source_type":"chatgpt",
  "status":"done",
  "title":"...",
  "raw_text_preview":"...",
  "summary_text":"...",
  "summary_bullets":["..."],
  "created_at":"..."
}
```

#### POST /v1/documents/{id}/retry
- failed 상태일 때만 허용(또는 특정 stage 실패만 재시도)

---

### 11.4 Chunks
#### GET /v1/documents/{id}/chunks
```json
{ "items": [ {"id":"uuid","chunk_index":0,"text":"..."} ] }
```

---

### 11.5 Link Candidates / Edges
#### GET /v1/documents/{id}/link-candidates
```json
{
  "items": [
    {
      "candidate_id":"uuid",
      "to":{"type":"document","id":"uuid","title":"..."},
      "confidence":0.82,
      "rationale":"공통 키워드: ...",
      "status":"candidate"
    }
  ]
}
```

#### POST /v1/link-candidates/{candidate_id}/accept
```json
{ "edge_id":"uuid", "status":"accepted" }
```

#### POST /v1/link-candidates/{candidate_id}/reject
```json
{ "status":"rejected" }
```

#### DELETE /v1/edges/{edge_id}
```json
{ "deleted": true }
```

---

### 11.6 Graph
#### GET /v1/graph?range=30d&limit_nodes=200&include_candidates=false
```json
{
  "nodes": [ {"type":"document","id":"uuid","title":"...","created_at":"..."} ],
  "edges": [ {"id":"uuid","from":"uuid","to":"uuid","relation":"related_to","status":"confirmed"} ]
}
```

---

### 11.7 Search
#### GET /v1/search/keyword?q=...
```json
{ "items": [ {"type":"document","id":"uuid","title":"...","snippet":"..."} ] }
```

#### POST /v1/search/semantic
```json
{ "query": "예전에 했던 AI 창업 아이디어", "limit": 20 }
```
```json
{ "items": [ {"type":"document","id":"uuid","title":"...","similarity":0.84,"snippet":"..."} ] }
```

---

### 11.8 Ask (RAG)
#### POST /v1/qa
```json
{ "question": "내가 이전에 고민했던 AI 창업 아이디어만 정리해줘", "limit": 8 }
```
```json
{
  "answer": "....",
  "evidence": [
    {"type":"document","id":"uuid","title":"...","snippet":"..."}
  ]
}
```

---

### 11.9 Usage
#### GET /v1/usage/today
```json
{ "plan":"free", "limits": {"paste":10,"summary":10,"qa":5}, "used": {"paste":2,"summary":2,"qa":1} }
```

---

## 12) AI 명세(프롬프트/정책/캐시/가드레일)

### 12.1 Chunking(규칙 기반) — MVP 알고리즘
1) 대화형 패턴 감지(예: `User:`/`Assistant:`/`Q:`/`A:`) → turn 단위 split  
2) 빈 줄(문단) split  
3) chunk 길이 제한 초과 시 문장 split(간단 regex)  
4) 각 chunk에 index 부여

**권장 파라미터**
- max_chars_per_chunk: 800~1200
- min_chars_per_chunk: 40(너무 짧으면 인접 chunk 병합)

### 12.2 Summarize — JSON 강제 템플릿
**목표 출력**
- title(optional)
- summary_text(1문단)
- bullets(3~7)
- key_topics(0~5) (candidate rationale에 사용)

**System**
- “원문에 없는 사실 추가 금지”
- “반드시 JSON만 출력”
- “한국어 유지(원문 언어 따라가되, 기본 한국어)”

```text
SYSTEM:
You are a careful summarizer. Do not add facts not present in TEXT.
Return ONLY valid JSON. No markdown, no extra keys.

USER:
TEXT:
{{raw_text}}

Return JSON with:
{
  "title": string | null,
  "summary_text": string,
  "bullets": string[],
  "key_topics": string[]
}
Constraints:
- bullets length 3..7
- key_topics length 0..5
- If you are unsure, keep it vague rather than inventing.
```

**파싱 실패 대응**
- 1차 파싱 실패 → “JSON repair” 프롬프트 1회 재시도
- 2차 실패 → status failed(summarize) + 사용자 재시도 버튼

### 12.3 Embedding 정책
- MVP: document embedding만 필수
- chunk embedding은 v1 또는 비용 여유 시(정확도 향상 vs 비용)

**캐시**
- raw_text_hash 기반으로 embedding 재사용

### 12.4 Candidate Link 생성 로직(LLM 최소화)
1) 새 문서 embedding 생성
2) pgvector Top-K 검색
3) 후보 필터:
   - self 제외
   - 기존 confirmed 제외
   - 기존 rejected 제외
4) rationale 생성:
   - key_topics 교집합이 있으면 “공통 주제: A,B”
   - 없으면 “유사도 기반 추천”
5) edge_candidates 저장(status=candidate)

**추천 임계치(초안)**
- similarity >= 0.75 또는 Top-K 중 상위 5는 무조건 노출(실험)

### 12.5 RAG Q&A
**Retrieval**
- 질문 임베딩 → Top-K 문서 검색
- context 구성:
  - 각 문서: title + summary_text + 핵심 bullet + raw_text_preview(짧게)
  - 너무 길면 summary 중심으로 압축

**Answer 정책**
- 근거 없는 추측 금지
- evidence 리스트(문서 id/제목/짧은 snippet) 필수 반환
- 근거 부족하면 “부족” 템플릿

**Answer 프롬프트(예시)**
```text
SYSTEM:
You answer questions using ONLY the provided CONTEXT.
If CONTEXT is insufficient, say you don't have enough info.
Return JSON only.

USER:
QUESTION: {{question}}

CONTEXT:
{{context_blocks}}

Return JSON:
{
  "answer": string,
  "evidence": [
    {"entity_type":"document","entity_id":"...","title":"...","snippet":"..."}
  ]
}
Rules:
- evidence must reference items from CONTEXT
- do not invent ids/titles
```

### 12.6 비용/레이트 가드레일
- doc length 상한(예: 20k chars)
- Q&A: 하루 5회(Free)
- Summarize/Embed는 동일 hash면 재사용
- 후보 생성은 LLM 없이도 가능하도록 설계(임베딩 기반)

---

## 13) 이벤트/로그/분석(Instrumentation)

### 13.1 이벤트 규칙
- snake_case
- PII 금지(raw_text 등 원문을 이벤트로 보내지 않음)
- 모든 이벤트에 공통 props:
  - user_id, workspace_id, client(platform=web), timestamp, app_version

### 13.2 필수 이벤트 목록 + props
- auth_signed_up
- auth_logged_in
- doc_pasted {source_type, text_length}
- doc_pipeline_stage_changed {document_id, stage, status, latency_ms, attempts}
- doc_viewed {document_id}
- link_candidate_shown {document_id, count, avg_confidence}
- link_candidate_accepted {candidate_id, confidence}
- link_candidate_rejected {candidate_id, confidence}
- graph_viewed {range, include_candidates, nodes_count, edges_count}
- search_keyword_executed {q_len, results_count}
- search_semantic_executed {q_len, results_count, top_similarity}
- qa_asked {question_len}
- qa_answer_shown {evidence_count, latency_ms}
- evidence_clicked {from_screen, entity_type, entity_id}
- usage_limit_hit {action}

---

## 14) QA 테스트 케이스(샘플 세트)

> MVP QA는 “기능+비동기+권한+회복+성능” 5축으로 본다.

### 14.1 기능 테스트(대표 케이스)
**TC-ING-001** Paste 성공 → 문서 생성/상태 변화  
- Steps: 로그인→텍스트 붙여넣기→저장→상태 queued→processing→done  
- Expected: Document Detail에서 summary + candidates 표시

**TC-PIPE-002** Summarize JSON 파싱 실패 대응  
- Steps: LLM 응답을 고의로 깨뜨린 mock → repair 재시도 → 실패 처리  
- Expected: status failed + retry 버튼

**TC-LINK-001** candidate accept → edge 생성  
- Steps: 후보 카드 accept  
- Expected: edges에 기록, 그래프 실선 표시

**TC-LINK-002** candidate reject → 재노출 방지  
- Steps: 후보 reject 후 같은 문서 재처리  
- Expected: 동일 pair 후보 재생성 X

**TC-QA-001** Q&A 근거 포함  
- Steps: 질문하기  
- Expected: evidence 리스트가 비어있지 않음 + 클릭 시 문서로 이동

**TC-USG-001** 사용량 제한  
- Steps: Free 제한 초과하도록 반복 호출  
- Expected: 429 + UI 업셀

### 14.2 권한/보안 테스트
- 다른 workspace 문서 id로 접근 시 404 또는 403
- 삭제된 문서 접근 차단

### 14.3 성능 테스트(간단 기준)
- Graph 200 nodes 로딩 p95 ≤ 2.5s
- Pipeline p95 ≤ 20s
- Q&A p95 ≤ 15s

---

## 15) 론칭/릴리즈 플랜(Feature Flag)

- Alpha: 팀 내부 10명 (요약/추천/검색까지만)
- Beta: 클로즈 100명 (그래프/accept-reject/QA 포함)
- GA: 결제/리포트는 v1에서(또는 GA 직후)

Feature flags:
- enable_graph
- enable_qa
- enable_candidates
- enable_semantic_search

---

## 16) 개발 백로그(에픽/티켓)

### Epic 1 Auth/Workspace
- T1 로그인(이메일/소셜 1종)
- T2 workspace 생성

### Epic 2 Documents + Jobs
- T3 POST /documents + DB 저장 + idempotency
- T4 jobs 큐/워커 + 상태 변경

### Epic 3 Pipeline
- T5 chunker 구현 + chunks 저장
- T6 summarize 호출 + JSON 파싱 + 저장
- T7 embedding 생성 + pgvector 저장 + Top-K 검색
- T8 후보 생성/필터/저장

### Epic 4 Document UI
- T9 Home
- T10 Detail(요약/청크/후보)
- T11 후보 accept/reject + edge delete

### Epic 5 Graph/Search/Ask
- T12 Graph API + FE 렌더링 + 필터
- T13 keyword search + semantic search
- T14 RAG Q&A + evidence

### Epic 6 Usage/Analytics
- T15 usage_daily 집계 + 제한 + 업셀
- T16 이벤트 로깅 + 대시보드 기초

---

## 17) 오픈 이슈(결정 필요)
1) embedding 모델/차원(EMBED_DIM) 확정
2) 후보 추천 threshold/Top-K 기본값
3) raw_text를 DB에 둘지 object storage로 분리할지
4) soft delete vs hard delete 정책
5) chunk 임베딩을 MVP에 포함할지(v1로 미룰지)
