create table public.stories (
  id uuid not null default gen_random_uuid (),
  title text not null,
  embedding public.vector not null,
  snapshot_count integer not null default 1,
  article_count integer not null default 0,
  source_count integer not null default 0,
  first_seen_at date not null,
  last_seen_at date not null,
  status text not null default 'NEW'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint stories_pkey primary key (id),
  constraint stories_status_check check (
    (
      status = any (
        array['NEW'::text, 'ACTIVE'::text, 'RESOLVED'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists stories_embedding_idx on public.stories using hnsw (embedding vector_cosine_ops) TABLESPACE pg_default;



create table public.story_snapshots (
  id uuid not null default gen_random_uuid (),
  story_id uuid not null,
  snapshot_date date not null,
  cluster_name text not null,
  embedding public.vector not null,
  article_count integer not null,
  source_count integer not null,
  summary text null,
  entities jsonb not null default '[]'::jsonb,
  keywords jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint story_snapshots_pkey primary key (id),
  constraint story_snapshots_story_id_snapshot_date_key unique (story_id, snapshot_date),
  constraint story_snapshots_story_id_fkey foreign KEY (story_id) references stories (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists story_snapshots_story_id_idx on public.story_snapshots using btree (story_id) TABLESPACE pg_default;

create index IF not exists story_snapshots_snapshot_date_idx on public.story_snapshots using btree (snapshot_date) TABLESPACE pg_default;