-- Crie primeiro um usuario no Supabase Auth pelo painel:
-- Authentication > Users > Add user
--
-- Sugestao para ambiente de desenvolvimento:
-- E-mail: admin@labcon.local
-- Senha temporaria: defina uma senha forte e troque antes de publicar.
--
-- Depois execute este SQL para dar perfil de administrador ao usuario.

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"administrador"}'::jsonb
where email = 'admin@labcon.local';

-- Conferencia:
select
  id,
  email,
  raw_app_meta_data ->> 'role' as role
from auth.users
where email = 'admin@labcon.local';
