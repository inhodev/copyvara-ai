-- CopyVara RAG Bootstrap SQL (single-tenant MVP)
-- 실행 순서: Supabase SQL Editor에 전체 붙여넣기 후 Run

begin;

-- 0) extension
create extension if not exists vector;

-- 1) 문서 메타 테이블 (추가)
create table if not exists public.rag_documents (
  id text primary key,
  workspace_id text not null default 'w1',
  owner_user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  source_type text not null default 'manual',
  title text not null,
  raw_text text,
  summary_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rag_documents_workspace_idx on public.rag_documents(workspace_id);
create index if not exists rag_documents_owner_idx on public.rag_documents(owner_user_id);
create index if not exists rag_documents_created_at_idx on public.rag_documents(created_at desc);

-- 2) 청크 테이블 (기존 보강)
create table if not exists public.rag_chunks (
  id text primary key,
  owner_user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  workspace_id text not null default 'w1',
  document_id text not null,
  segment_id text,
  title text not null,
  content text not null,
  embedding vector(1536) not null,
  content_tsv tsvector,
  lexical_weight real not null default 1.0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rag_chunks
  alter column owner_user_id set default '00000000-0000-0000-0000-000000000001';

update public.rag_chunks
set owner_user_id = '00000000-0000-0000-0000-000000000001'
where owner_user_id is null;

alter table public.rag_chunks
  alter column owner_user_id set not null;

create index if not exists rag_chunks_workspace_idx on public.rag_chunks (workspace_id);
create index if not exists rag_chunks_owner_user_idx on public.rag_chunks (owner_user_id);
create index if not exists rag_chunks_document_idx on public.rag_chunks (document_id);
create index if not exists rag_chunks_content_tsv_gin on public.rag_chunks using gin(content_tsv);
create index if not exists rag_chunks_embedding_ivfflat
  on public.rag_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 2-1) RLS 점검/해제 (service_role 경로 안정화)
alter table public.rag_chunks disable row level security;

-- 3) ingest 로그 테이블 (추가)
create table if not exists public.rag_ingest_events (
  id bigserial primary key,
  document_id text,
  chunk_id text,
  stage text not null,
  status text not null,
  message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists rag_ingest_events_document_idx on public.rag_ingest_events(document_id);
create index if not exists rag_ingest_events_created_at_idx on public.rag_ingest_events(created_at desc);

-- 4) tsv trigger
create or replace function public.rag_chunks_tsv_trigger()
returns trigger
language plpgsql
as $$
begin
  new.content_tsv := to_tsvector('simple', coalesce(new.title, '') || ' ' || coalesce(new.content, ''));
  return new;
end;
$$;

drop trigger if exists trg_rag_chunks_tsv on public.rag_chunks;
create trigger trg_rag_chunks_tsv
before insert or update of title, content
on public.rag_chunks
for each row execute function public.rag_chunks_tsv_trigger();

-- 5) upsert 함수 (analyze edge function에서 사용)
create or replace function public.upsert_rag_chunk(
  p_id text,
  p_owner_user_id uuid,
  p_workspace_id text,
  p_document_id text,
  p_segment_id text,
  p_title text,
  p_content text,
  p_embedding float8[],
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.rag_chunks (
    id, owner_user_id, workspace_id, document_id, segment_id, title, content, embedding, metadata, updated_at
  )
  values (
    p_id,
    coalesce(p_owner_user_id, '00000000-0000-0000-0000-000000000001'::uuid),
    coalesce(p_workspace_id, 'w1'),
    p_document_id,
    p_segment_id,
    p_title,
    p_content,
    (p_embedding::text)::vector,
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  on conflict (id)
  do update set
    owner_user_id = excluded.owner_user_id,
    workspace_id = excluded.workspace_id,
    document_id = excluded.document_id,
    segment_id = excluded.segment_id,
    title = excluded.title,
    content = excluded.content,
    embedding = excluded.embedding,
    metadata = excluded.metadata,
    updated_at = now();
end;
$$;

-- 6) hybrid retrieval RPC (single-tenant: owner 필터 제거)
create or replace function public.match_rag_chunks_hybrid(
  p_query_embedding text,
  p_query_text text,
  p_candidate_count int default 28,
  p_vector_weight real default 0.74,
  p_lexical_weight real default 0.26
)
returns table (
  id text,
  document_id text,
  segment_id text,
  title text,
  content text,
  vector_score float,
  lexical_score float,
  final_score float
)
language sql
stable
as $$
with vec_candidates as (
  select
    rc.id,
    rc.document_id,
    rc.segment_id,
    rc.title,
    rc.content,
    (1 - (rc.embedding <=> (p_query_embedding::vector)))::float as vector_score,
    case
      when coalesce(btrim(p_query_text), '') = '' then 0::float
      else ts_rank_cd(rc.content_tsv, websearch_to_tsquery('simple', p_query_text))::float
    end as lexical_score
  from public.rag_chunks rc
  order by rc.embedding <=> (p_query_embedding::vector)
  limit greatest(coalesce(p_candidate_count, 28), 8)
), lex_candidates as (
  select
    rc.id,
    rc.document_id,
    rc.segment_id,
    rc.title,
    rc.content,
    (1 - (rc.embedding <=> (p_query_embedding::vector)))::float as vector_score,
    ts_rank_cd(rc.content_tsv, websearch_to_tsquery('simple', p_query_text))::float as lexical_score
  from public.rag_chunks rc
  where coalesce(btrim(p_query_text), '') <> ''
  order by ts_rank_cd(rc.content_tsv, websearch_to_tsquery('simple', p_query_text)) desc,
           rc.embedding <=> (p_query_embedding::vector)
  limit greatest((coalesce(p_candidate_count, 28) * 8) / 10, 6)
), candidate_union as (
  select * from vec_candidates
  union all
  select * from lex_candidates
), dedup as (
  select distinct on (id)
    id,
    document_id,
    segment_id,
    title,
    content,
    vector_score,
    lexical_score
  from candidate_union
  order by id, (vector_score + lexical_score) desc
), norm as (
  select
    *,
    case when max(vector_score) over () > 0
      then vector_score / nullif(max(vector_score) over (), 0)
      else 0 end as v_norm,
    case when max(lexical_score) over () > 0
      then lexical_score / nullif(max(lexical_score) over (), 0)
      else 0 end as l_norm
  from dedup
)
select
  id,
  document_id,
  segment_id,
  title,
  content,
  vector_score,
  lexical_score,
  (coalesce(p_vector_weight, 0.74) * v_norm + coalesce(p_lexical_weight, 0.26) * l_norm) as final_score
from norm
order by final_score desc
limit greatest(coalesce(p_candidate_count, 28), 1);
$$;

-- 7) 문서 upsert 함수 (옵션: 디버깅/운영용)
create or replace function public.upsert_rag_document(
  p_id text,
  p_workspace_id text,
  p_owner_user_id uuid,
  p_source_type text,
  p_title text,
  p_raw_text text,
  p_summary_text text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.rag_documents (
    id, workspace_id, owner_user_id, source_type, title, raw_text, summary_text, metadata, updated_at
  )
  values (
    p_id,
    coalesce(p_workspace_id, 'w1'),
    coalesce(p_owner_user_id, '00000000-0000-0000-0000-000000000001'::uuid),
    coalesce(p_source_type, 'manual'),
    p_title,
    p_raw_text,
    p_summary_text,
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  on conflict (id)
  do update set
    workspace_id = excluded.workspace_id,
    owner_user_id = excluded.owner_user_id,
    source_type = excluded.source_type,
    title = excluded.title,
    raw_text = excluded.raw_text,
    summary_text = excluded.summary_text,
    metadata = excluded.metadata,
    updated_at = now();
end;
$$;

-- 8) 최신성 갱신
update public.rag_chunks
set content_tsv = to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
where content_tsv is null;

analyze public.rag_chunks;
analyze public.rag_documents;

commit;

-- ===============================
-- VERIFY
-- ===============================

-- A) 핵심 함수 존재 확인
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('upsert_rag_chunk', 'match_rag_chunks_hybrid', 'upsert_rag_document');

-- B) 테이블 row count
select
  (select count(*) from public.rag_documents) as rag_documents_count,
  (select count(*) from public.rag_chunks) as rag_chunks_count,
  (select count(*) from public.rag_ingest_events) as rag_ingest_events_count;

-- C) 최근 chunk 확인
select id, document_id, title, left(content, 120) as snippet, created_at
from public.rag_chunks
order by created_at desc
limit 10;
