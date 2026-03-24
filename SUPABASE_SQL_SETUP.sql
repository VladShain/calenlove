create table if not exists public.app_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "Allow read app_state" on public.app_state;
drop policy if exists "Allow write app_state" on public.app_state;

create policy "Allow read app_state"
on public.app_state
for select
to anon, authenticated
using (true);

create policy "Allow write app_state"
on public.app_state
for insert
to anon, authenticated
with check (true);

create policy "Allow update app_state"
on public.app_state
for update
to anon, authenticated
using (true)
with check (true);

-- Bucket надо создать руками:
-- name: calendar-media
-- public: true

-- После создания bucket дай ему доступы в Storage policies,
-- если хочешь совсем простой режим "для себя".
