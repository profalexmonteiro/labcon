create table if not exists public.labcon_state (
  id text primary key default 'default',
  data jsonb not null default '{"users":[],"labs":[],"desks":[],"reservations":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.labcon_state enable row level security;

grant select on public.labcon_state to anon, authenticated;
grant insert, update on public.labcon_state to authenticated;

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

create or replace function public.labcon_sync_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_state jsonb;
  synced_users jsonb;
  user_role text;
  user_record jsonb;
begin
  user_role := coalesce(new.raw_app_meta_data ->> 'role', new.raw_user_meta_data ->> 'role', 'aluno');

  if user_role not in ('aluno', 'professor', 'tecnico', 'administrador') then
    user_role := 'aluno';
  end if;

  user_record := jsonb_strip_nulls(jsonb_build_object(
    'id', 'auth-' || new.id::text,
    'authUserId', new.id::text,
    'email', new.email,
    'name', coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'Usuario'),
    'role', user_role,
    'advisorId', case when user_role = 'aluno' then new.raw_user_meta_data ->> 'advisorId' else null end,
    'advisorName', case when user_role = 'aluno' then new.raw_user_meta_data ->> 'advisorName' else null end,
    'source', 'auth'
  ));

  insert into public.labcon_state (id, data)
  values ('default', '{"users":[],"labs":[],"desks":[],"reservations":[]}'::jsonb)
  on conflict (id) do nothing;

  select data
  into current_state
  from public.labcon_state
  where id = 'default'
  for update;

  select coalesce(jsonb_agg(user_item), '[]'::jsonb)
  into synced_users
  from jsonb_array_elements(coalesce(current_state -> 'users', '[]'::jsonb)) as users(user_item)
  where coalesce(user_item ->> 'authUserId', '') <> new.id::text
    and lower(coalesce(user_item ->> 'email', '')) <> lower(coalesce(new.email, ''));

  update public.labcon_state
  set
    data = jsonb_set(current_state, '{users}', synced_users || jsonb_build_array(user_record), true),
    updated_at = now()
  where id = 'default';

  return new;
end;
$$;

drop trigger if exists labcon_sync_auth_user_trigger on auth.users;
create trigger labcon_sync_auth_user_trigger
after insert or update of email, raw_app_meta_data, raw_user_meta_data
on auth.users
for each row
execute function public.labcon_sync_auth_user();
