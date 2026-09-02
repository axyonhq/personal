create table if not exists public.date_discovery_state (
  id text primary key check (id = 'singleton'),
  decisions jsonb not null default '{}'::jsonb,
  unlocked_hint_ids text[] not null default '{}'::text[],
  last_unlock_day text,
  last_unlock_days jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.date_discovery_state enable row level security;

insert into public.date_discovery_state (id)
values ('singleton')
on conflict (id) do nothing;

update public.date_discovery_state
set
  decisions = '{}'::jsonb,
  unlocked_hint_ids = '{}'::text[],
  last_unlock_day = null,
  last_unlock_days = '{"epoch":"v3-one-daily-credit","global":""}'::jsonb,
  updated_at = now()
where id = 'singleton';

revoke all on table public.date_discovery_state from public, anon, authenticated;
grant all on table public.date_discovery_state to service_role;
