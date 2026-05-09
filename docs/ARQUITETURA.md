# Arquitetura do LabCon

## Contexto

O projeto ainda é uma aplicação web estática, sem etapa de build. A persistência foi movida para o Supabase, preservando a simplicidade de abrir o `index.html` diretamente no navegador e mantendo o `localStorage` apenas como cache/fallback quando a sincronização remota não estiver disponível.

A entrada pública do sistema fica em `index.html`, exibindo somente o painel de ocupação dos laboratórios. O botão no canto superior leva para `login.html`, que concentra acesso, cadastro e recuperação de senha. A área de gerenciamento fica em `admin.html`.

## Organização de diretórios

```text
.
|-- index.html
|-- login.html
|-- admin.html
|-- assets/
|   `-- css/
|       `-- styles.css
|-- src/
|   |-- app.js
|   |-- login.js
|   |-- public.js
|   `-- supabase.js
|-- database/
|   |-- supabase-admin-bootstrap.sql
|   `-- supabase-schema.sql
`-- docs/
    |-- ARQUITETURA.md
    `-- SECURITY.md
```

Os HTMLs permanecem na raiz porque o projeto é estático e sem etapa de build. Os assets, scripts, scripts de banco e documentação ficam separados por responsabilidade.

## Arquitetura escolhida

Foi aplicada uma arquitetura em camadas no `src/app.js`, inspirada em MVC com serviços de domínio:

- `Config`: constantes do sistema, como dias da semana, cursos, chave de armazenamento e estado vazio.
- `Utils`: funções utilitárias puras, como geração de ids, escape de HTML, clone e ordenação.
- `src/supabase.js`: configuração do cliente Supabase, leitura/escrita do estado compartilhado na tabela `labcon_state` e sincronização de cadastros feitos pelo Auth quando houver sessão ativa.
- `Repository`: acesso e persistência de dados no Supabase, com cache local no `localStorage`, incluindo operações de cascata ao excluir usuários, laboratórios, mesas e reservas.
- `Domain`: regras de negócio e consultas do domínio, como validação de aluno com orientador, validação de reserva por matriz semanal de horários e detecção de conflito de horário por mesa.
- `Templates`: geração de HTML isolada da regra de negócio.
- `View`: leitura e atualização do DOM, renderização das telas e feedback visual.
- `Controller`: eventos da interface e orquestração entre `View`, `Domain` e `Repository`.
- `src/public.js`: script enxuto somente para leitura e renderização do painel público.
- `src/login.js`: script da tela de autenticação estática, responsável por alternar entre login, cadastro e recuperação de senha.

## Controle de acesso no protótipo

O login usa Supabase Auth para entrada, cadastro e recuperação de senha. A área administrativa exige sessão ativa e o perfil de acesso vem dos metadados do usuário no Supabase, preferencialmente `app_metadata.role`. Usuários sem perfil reconhecido entram como `aluno`. Cadastros feitos pela tela de login também são sincronizados para `labcon_state.users`, via frontend quando há sessão imediata e via trigger SQL quando a confirmação por e-mail impede login automático. O perfil `aluno` tem acesso somente ao painel público e ao módulo de reservas dentro da área administrativa. Cadastros de usuários, laboratórios, mesas e ações administrativas como popular exemplo e limpar dados ficam ocultos e bloqueados para esse perfil.

## Justificativa

Essa abordagem é adequada ao momento do projeto porque:

- Usa uma dependência externa única, o Supabase, sem exigir servidor próprio ou etapa de build.
- Evita complexidade prematura de framework ou backend.
- Isola regras importantes, como conflito de reserva, da renderização da tela.
- Permite que uma mesa tenha vários usuários em horários diferentes, bloqueando apenas sobreposições no mesmo dia. No cadastro administrativo, a reserva usa uma matriz de segunda a sábado, com blocos de 1 hora entre 08:00 e 22:00.
- Melhora a gestão da informação ao separar dados operacionais de dados públicos: o painel mostra filtros ativos, mesas livres, mesas ocupadas e status por mesa; a área administrativa mostra legenda e resumo antes de salvar uma reserva.
- Facilita evoluir depois para tabelas relacionais dedicadas, trocando principalmente a camada `Repository`.
- Facilita substituir a interface por React, Vue ou outro framework no futuro, mantendo a camada `Domain` como referência.

## Configuração do Supabase

Execute o arquivo `database/supabase-schema.sql` no SQL Editor do Supabase antes de usar o app. Ele cria a tabela `labcon_state`, habilita RLS, adiciona políticas de leitura/escrita para a chave anônima usada pelo app estático e instala o trigger que sincroniza novos usuários do Supabase Auth para o estado compartilhado.

Depois, configure os papéis dos usuários no Supabase Auth. Para administradores, professores e técnicos, defina `app_metadata.role` como `administrador`, `professor` ou `tecnico`. Cadastros feitos pelo próprio app recebem o perfil selecionado na tela de cadastro.

Para o administrador inicial, crie um usuário no Supabase Auth e execute `database/supabase-admin-bootstrap.sql`. Credenciais fixas como `admin/admin` não devem ser embutidas no frontend.

O arquivo `_headers` declara os headers recomendados para hospedagens estáticas compatíveis. As páginas também incluem metatags de segurança como fallback, mas headers HTTP reais devem ser preferidos em produção.

## Próxima evolução recomendada

Quando o sistema sair do protótipo local, a próxima arquitetura recomendada é:

- Permissões reais por usuário usando claims/metadados do Supabase Auth.
- Tabelas relacionais dedicadas para `users`, `labs`, `desks`, `reservations` e `roles`.
- Camada de domínio no servidor para impedir conflitos de reserva mesmo com vários usuários usando o sistema ao mesmo tempo.
- Painel público como rota somente leitura.
- Auditoria de alterações feitas por administradores e técnicos.
