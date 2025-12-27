create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists workspace (
  id text primary key,
  name text not null,
  graph jsonb not null,
  layers jsonb not null,
  drift jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists plan_version (
  id text primary key,
  workspace_id text not null references workspace(id) on delete cascade,
  name text not null,
  notes text,
  graph jsonb not null,
  layers jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists plan_version_workspace_idx
  on plan_version (workspace_id, created_at desc);
