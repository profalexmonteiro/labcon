# Segurança

## Controles aplicados

- A área administrativa exige sessão ativa do Supabase Auth.
- O perfil de acesso não é mais escolhido no login; ele vem de `app_metadata.role` ou `user_metadata.role`.
- A escrita no Supabase exige sessão autenticada no cliente e policy `authenticated` no banco.
- Cadastros feitos no Supabase Auth são sincronizados para `labcon_state.users` por trigger `security definer`, mantendo o painel administrativo com os mesmos dados do Auth.
- O painel público permanece somente leitura.
- Scripts externos usam versão fixa e SRI.
- As páginas declaram CSP, Referrer Policy, Permissions Policy e `nosniff`.
- O arquivo `_headers` inclui os headers equivalentes para hospedagens estáticas compatíveis.

## Configuração operacional obrigatória

Defina o papel de usuários privilegiados no Supabase, preferencialmente em `app_metadata.role`, usando um ambiente confiável ou o painel administrativo do Supabase. Valores aceitos:

- `administrador`
- `professor`
- `tecnico`
- `aluno`

Usuários sem papel reconhecido entram como `aluno`.

## Administrador inicial

Não mantenha credenciais padrão como `admin/admin` em uma aplicação web publicada. Isso cria uma conta previsível e fácil de explorar.

Para criar o administrador inicial, use o arquivo `database/supabase-admin-bootstrap.sql`:

1. Crie um usuário em Supabase Auth pelo painel.
2. Use uma senha temporária forte.
3. Execute `database/supabase-admin-bootstrap.sql` para marcar esse usuário como `administrador`.
4. Troque a senha antes de publicar o sistema.

## Limitação atual

Os dados operacionais ainda ficam em um único documento JSON (`labcon_state`). Isso reduz a granularidade das policies do Supabase. Para controle de permissão estritamente server-side por entidade e ação, a próxima etapa deve separar o estado em tabelas relacionais (`users`, `labs`, `desks`, `reservations`) e aplicar RLS por tabela.
