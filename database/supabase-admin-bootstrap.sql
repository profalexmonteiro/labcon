-- Crie primeiro um usuario no Supabase Auth pelo painel:
-- Authentication > Users > Add user
--
-- Sugestao para ambiente de desenvolvimento:
-- E-mail: admin@labcon.local
-- Senha temporaria: defina uma senha forte e troque antes de publicar.
--
-- Depois execute este SQL no SQL Editor do Supabase para dar perfil
-- de administrador ao usuario. Troque o e-mail abaixo se necessario.

create temp table if not exists labcon_bootstrap_config (
  admin_email text primary key
);

truncate table labcon_bootstrap_config;

insert into labcon_bootstrap_config (admin_email)
values ('admin@labcon.local')
on conflict (admin_email) do update
set admin_email = excluded.admin_email;

do $$
declare
  admin_email text;
begin
  select labcon_bootstrap_config.admin_email
  into admin_email
  from labcon_bootstrap_config
  limit 1;

  if not exists (
    select 1
    from auth.users
    where email = admin_email
  ) then
    raise exception 'Usuario % nao encontrado em Authentication > Users.', admin_email;
  end if;

  update auth.users
  set raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb),
    '{role}',
    '"administrador"'::jsonb,
    true
  )
  where email = admin_email;
end $$;

-- Conferencia:
select
  id,
  email,
  raw_app_meta_data ->> 'role' as role
from auth.users
where email = (select admin_email from labcon_bootstrap_config limit 1);

drop table if exists labcon_bootstrap_config;
