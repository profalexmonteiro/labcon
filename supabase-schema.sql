create table if not exists public.labcon_state (
  id text primary key default 'default',
  data jsonb not null default '{"users":[],"labs":[],"desks":[],"reservations":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.labcon_state enable row level security;

drop policy if exists "LabCon public read" on public.labcon_state;
create policy "LabCon public read"
  on public.labcon_state
  for select
  to anon, authenticated
  using (id = 'default');

drop policy if exists "LabCon public insert" on public.labcon_state;
drop policy if exists "LabCon authenticated insert" on public.labcon_state;
create policy "LabCon authenticated insert"
  on public.labcon_state
  for insert
  to authenticated
  with check (id = 'default');

drop policy if exists "LabCon public update" on public.labcon_state;
drop policy if exists "LabCon authenticated update" on public.labcon_state;
create policy "LabCon authenticated update"
  on public.labcon_state
  for update
  to authenticated
  using (id = 'default')
  with check (id = 'default');

insert into public.labcon_state (id, data)
values ('default', '{"users":[],"labs":[],"desks":[],"reservations":[]}'::jsonb)
on conflict (id) do nothing;
