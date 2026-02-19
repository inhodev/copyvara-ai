-- CopyVara RAG pgvector schema
-- Run in Supabase SQL editor before deploying updated edge functions.

create extension if not exists vector;

create table if not exists public.rag_chunks (
  id text primary key,
  owner_user_id uuid,
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
  add column if not exists owner_user_id uuid,
  add column if not exists content_tsv tsvector,
  add column if not exists lexical_weight real not null default 1.0;

create index if not exists rag_chunks_workspace_idx on public.rag_chunks (workspace_id);
create index if not exists rag_chunks_owner_user_idx on public.rag_chunks (owner_user_id);
create index if not exists rag_chunks_document_idx on public.rag_chunks (document_id);
create index if not exists rag_chunks_content_tsv_gin on public.rag_chunks using gin(content_tsv);

create index if not exists rag_chunks_embedding_ivfflat
  on public.rag_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

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
  if p_owner_user_id is null then
    raise exception 'owner_user_id is required';
  end if;

  insert into public.rag_chunks (
    id, owner_user_id, workspace_id, document_id, segment_id, title, content, embedding, metadata, updated_at
  )
  values (
    p_id,
    p_owner_user_id,
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

create or replace function public.match_rag_chunks(
  p_owner_user_id uuid,
  p_query_embedding float8[],
  p_match_count int default 6
)
returns table (
  id text,
  document_id text,
  segment_id text,
  title text,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    rc.id,
    rc.document_id,
    rc.segment_id,
    rc.title,
    rc.content,
    1 - (rc.embedding <=> ((p_query_embedding::text)::vector)) as similarity
  from public.rag_chunks rc
  where rc.owner_user_id = p_owner_user_id
  order by rc.embedding <=> ((p_query_embedding::text)::vector)
  limit greatest(coalesce(p_match_count, 6), 1);
$$;

create or replace function public.match_rag_chunks_hybrid(
  p_owner_user_id uuid,
  p_query_embedding text,
  p_query_text text,
  p_candidate_count int default 24,
  p_vector_weight real default 0.82,
  p_lexical_weight real default 0.18
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
    where rc.owner_user_id = p_owner_user_id
    order by rc.embedding <=> (p_query_embedding::vector)
    limit greatest(coalesce(p_candidate_count, 24), 8)
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
    where rc.owner_user_id = p_owner_user_id
      and coalesce(btrim(p_query_text), '') <> ''
    order by ts_rank_cd(rc.content_tsv, websearch_to_tsquery('simple', p_query_text)) desc,
             rc.embedding <=> (p_query_embedding::vector)
    limit greatest((coalesce(p_candidate_count, 24) * 8) / 10, 6)
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
    (coalesce(p_vector_weight, 0.82) * v_norm + coalesce(p_lexical_weight, 0.18) * l_norm) as final_score
  from norm
  order by final_score desc
  limit greatest(coalesce(p_candidate_count, 24), 1);
$$;

update public.rag_chunks
set content_tsv = to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
where content_tsv is null;

analyze public.rag_chunks;

alter table public.rag_chunks enable row level security;

drop policy if exists rag_chunks_select_own on public.rag_chunks;
create policy rag_chunks_select_own
on public.rag_chunks
for select
to authenticated
using (owner_user_id = auth.uid());

drop policy if exists rag_chunks_insert_own on public.rag_chunks;
create policy rag_chunks_insert_own
on public.rag_chunks
for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists rag_chunks_update_own on public.rag_chunks;
create policy rag_chunks_update_own
on public.rag_chunks
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists rag_chunks_delete_own on public.rag_chunks;
create policy rag_chunks_delete_own
on public.rag_chunks
for delete
to authenticated
using (owner_user_id = auth.uid());
