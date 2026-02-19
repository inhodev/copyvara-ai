-- [STEP 1] rag_chunks에 lexical 검색 컬럼 추가 (존재 시 무시)
alter table public.rag_chunks
  add column if not exists content_tsv tsvector;

-- [STEP 2] lexical 검색용 GIN 인덱스 생성 (존재 시 무시)
create index if not exists rag_chunks_content_tsv_gin
  on public.rag_chunks using gin(content_tsv);

-- [STEP 3] tsvector 갱신 trigger 함수 생성/교체
create or replace function public.rag_chunks_tsv_trigger()
returns trigger
language plpgsql
as $$
begin
  new.content_tsv := to_tsvector('simple', coalesce(new.title, '') || ' ' || coalesce(new.content, ''));
  return new;
end;
$$;

-- [STEP 4] trigger 재연결 (충돌 방지: 기존 제거 후 재생성)
drop trigger if exists trg_rag_chunks_tsv on public.rag_chunks;
create trigger trg_rag_chunks_tsv
before insert or update of title, content
on public.rag_chunks
for each row execute function public.rag_chunks_tsv_trigger();

-- [STEP 5] 기존 데이터 backfill
update public.rag_chunks
set content_tsv = to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
where content_tsv is null;

-- [STEP 6] hybrid 검색 RPC 정의/교체 (single-tenant: owner 필터 제거)
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

-- [STEP 7] 통계 갱신
analyze public.rag_chunks;

-- ==============================
-- 검증 쿼리 (실행 후 상태 확인)
-- ==============================

-- [VERIFY-1] content_tsv 컬럼 존재 확인
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'rag_chunks'
  and column_name = 'content_tsv';

-- [VERIFY-2] GIN 인덱스 존재 확인
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'rag_chunks'
  and indexname = 'rag_chunks_content_tsv_gin';

-- [VERIFY-3] trigger 함수 존재 확인
select p.proname, n.nspname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'rag_chunks_tsv_trigger';

-- [VERIFY-4] trigger 연결 확인
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.rag_chunks'::regclass
  and tgname = 'trg_rag_chunks_tsv'
  and not tgisinternal;

-- [VERIFY-5] hybrid RPC 존재/시그니처 확인
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid) as returns
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'match_rag_chunks_hybrid';

-- [VERIFY-6] hybrid RPC 단독 실행 예시
-- 아래 쿼리는 샘플 실행문이며, 실제 임베딩 값으로 교체하세요.
-- select * from public.match_rag_chunks_hybrid(
--   '[0.01,0.02,0.03]'::text,
--   'RAG 도입 우선순위',
--   10,
--   0.74,
--   0.26
-- );
