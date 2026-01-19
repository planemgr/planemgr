create table if not exists user_ssh_keys (
  username text primary key,
  public_key text not null,
  private_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_ssh_keys_updated_at_idx on user_ssh_keys (updated_at);
