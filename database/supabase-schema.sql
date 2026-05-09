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
    'level', case when user_role = 'aluno' then coalesce(new.raw_user_meta_data ->> 'level', 'graduacao') else null end,
    'course', case when user_role = 'aluno' and coalesce(new.raw_user_meta_data ->> 'level', 'graduacao') = 'graduacao' then new.raw_user_meta_data ->> 'course' else null end,
    'program', case when user_role = 'aluno' and coalesce(new.raw_user_meta_data ->> 'level', 'graduacao') = 'graduacao' then new.raw_user_meta_data ->> 'program' else null end,
    'postgradType', case when user_role = 'aluno' and new.raw_user_meta_data ->> 'level' = 'pos-graduacao' then new.raw_user_meta_data ->> 'postgradType' else null end,
    'advisorId', case when user_role = 'aluno' then new.raw_user_meta_data ->> 'advisorId' else null end,
    'advisorName', case when user_role = 'aluno' then new.raw_user_meta_data ->> 'advisorName' else null end,
    'researchProject', case when user_role = 'aluno' then new.raw_user_meta_data ->> 'researchProject' else null end,
    'entryDate', case when user_role = 'aluno' then new.raw_user_meta_data ->> 'entryDate' else null end,
    'qualificationDeadline', case when user_role = 'aluno' then new.raw_user_meta_data ->> 'qualificationDeadline' else null end,
    'advisorMeetingUrl', case when user_role = 'aluno' then new.raw_user_meta_data ->> 'advisorMeetingUrl' else null end,
    'articleUrl', case when user_role = 'aluno' then new.raw_user_meta_data ->> 'articleUrl' else null end,
    'qualificationUrl', case when user_role = 'aluno' then new.raw_user_meta_data ->> 'qualificationUrl' else null end,
    'thesisUrl', case when user_role = 'aluno' then new.raw_user_meta_data ->> 'thesisUrl' else null end,
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

-- ============================================================
-- Atomic upsert: previne race conditions em reservas
-- Usa FOR UPDATE para serializar escritas concorrentes e
-- optimistic concurrency control via updated_at.
-- ============================================================
create or replace function public.labcon_atomic_upsert(
  p_new_state jsonb,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_updated_at timestamptz;
  new_updated_at timestamptz;
begin
  select updated_at into current_updated_at
  from public.labcon_state
  where id = 'default'
  for update;

  if current_updated_at is null then
    insert into public.labcon_state (id, data, updated_at)
    values ('default', p_new_state, now())
    on conflict (id) do update
      set data = excluded.data, updated_at = excluded.updated_at
    returning updated_at into new_updated_at;
    return jsonb_build_object('ok', true, 'updated_at', new_updated_at);
  end if;

  if p_expected_updated_at is not null and current_updated_at > p_expected_updated_at then
    return jsonb_build_object('ok', false, 'reason', 'concurrent_modification');
  end if;

  update public.labcon_state
  set data = p_new_state, updated_at = now()
  where id = 'default'
  returning updated_at into new_updated_at;

  return jsonb_build_object('ok', true, 'updated_at', new_updated_at);
end;
$$;

grant execute on function public.labcon_atomic_upsert(jsonb, timestamptz) to authenticated;
