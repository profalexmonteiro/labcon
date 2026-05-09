# Seguranca

## Controles aplicados

- A area administrativa exige sessao ativa do Supabase Auth.
- O perfil de acesso nao e mais escolhido no login; ele vem de `app_metadata.role` ou `user_metadata.role`.
- A escrita no Supabase exige sessao autenticada no cliente e policy `authenticated` no banco.
- Cadastros feitos no Supabase Auth sao sincronizados para `labcon_state.users` por trigger `security definer`, mantendo o painel administrativo com os mesmos dados do Auth.
- O painel publico permanece somente leitura.
- Scripts externos usam versao fixa e SRI.
- As paginas declaram CSP, Referrer Policy, Permissions Policy e `nosniff`.
- O arquivo `_headers` inclui os headers equivalentes para hospedagens estaticas compativeis.

## Configuracao operacional obrigatoria

Defina o papel de usuarios privilegiados no Supabase, preferencialmente em `app_metadata.role`, usando um ambiente confiavel ou o painel administrativo do Supabase. Valores aceitos:

- `administrador`
- `professor`
- `tecnico`
- `aluno`

Usuarios sem papel reconhecido entram como `aluno`.

## Administrador inicial

Nao mantenha credenciais padrao como `admin/admin` em uma aplicacao web publicada. Isso cria uma conta previsivel e facil de explorar.

Para criar o administrador inicial, use o arquivo `database/supabase-admin-bootstrap.sql`:

1. Crie um usuario em Supabase Auth pelo painel.
2. Use uma senha temporaria forte.
3. Execute `database/supabase-admin-bootstrap.sql` para marcar esse usuario como `administrador`.
4. Troque a senha antes de publicar o sistema.

## Limitacao atual

Os dados operacionais ainda ficam em um unico documento JSON (`labcon_state`). Isso reduz a granularidade das policies do Supabase. Para controle de permissao estritamente server-side por entidade e acao, a proxima etapa deve separar o estado em tabelas relacionais (`users`, `labs`, `desks`, `reservations`) e aplicar RLS por tabela.
