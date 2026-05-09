# Arquitetura do LabCon

## Contexto

O projeto ainda e uma aplicacao web estatica, sem etapa de build. A persistencia foi movida para o Supabase, preservando a simplicidade de abrir o `index.html` diretamente no navegador e mantendo o `localStorage` apenas como cache/fallback quando a sincronizacao remota nao estiver disponivel.

A entrada publica do sistema fica em `index.html`, exibindo somente o painel de ocupacao dos laboratorios. O botao no canto superior leva para `login.html`, que concentra acesso, cadastro e recuperacao de senha. A area de gerenciamento fica em `admin.html`.

## Organizacao de diretorios

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

Os HTMLs permanecem na raiz porque o projeto e estatico e sem etapa de build. Os assets, scripts, scripts de banco e documentacao ficam separados por responsabilidade.

## Arquitetura escolhida

Foi aplicada uma arquitetura em camadas no `src/app.js`, inspirada em MVC com servicos de dominio:

- `Config`: constantes do sistema, como dias da semana, cursos, chave de armazenamento e estado vazio.
- `Utils`: funcoes utilitarias puras, como geracao de ids, escape de HTML, clone e ordenacao.
- `src/supabase.js`: configuracao do cliente Supabase, leitura/escrita do estado compartilhado na tabela `labcon_state` e sincronizacao de cadastros feitos pelo Auth quando houver sessao ativa.
- `Repository`: acesso e persistencia de dados no Supabase, com cache local no `localStorage`, incluindo operacoes de cascata ao excluir usuarios, laboratorios, mesas e reservas.
- `Domain`: regras de negocio e consultas do dominio, como validacao de aluno com orientador, validacao de reserva por matriz semanal de horarios e deteccao de conflito de horario por mesa.
- `Templates`: geracao de HTML isolada da regra de negocio.
- `View`: leitura e atualizacao do DOM, renderizacao das telas e feedback visual.
- `Controller`: eventos da interface e orquestracao entre `View`, `Domain` e `Repository`.
- `src/public.js`: script enxuto somente para leitura e renderizacao do painel publico.
- `src/login.js`: script da tela de autenticacao estatica, responsavel por alternar entre login, cadastro e recuperacao de senha.

## Controle de acesso no prototipo

O login usa Supabase Auth para entrada, cadastro e recuperacao de senha. A area administrativa exige sessao ativa e o perfil de acesso vem dos metadados do usuario no Supabase, preferencialmente `app_metadata.role`. Usuarios sem perfil reconhecido entram como `aluno`. Cadastros feitos pela tela de login tambem sao sincronizados para `labcon_state.users`, via frontend quando ha sessao imediata e via trigger SQL quando a confirmacao por e-mail impede login automatico. O perfil `aluno` tem acesso somente ao painel publico e ao modulo de reservas dentro da area administrativa. Cadastros de usuarios, laboratorios, mesas e acoes administrativas como popular exemplo e limpar dados ficam ocultos e bloqueados para esse perfil.

## Justificativa

Essa abordagem e adequada ao momento do projeto porque:

- Usa uma dependencia externa unica, o Supabase, sem exigir servidor proprio ou etapa de build.
- Evita complexidade prematura de framework ou backend.
- Isola regras importantes, como conflito de reserva, da renderizacao da tela.
- Permite que uma mesa tenha varios usuarios em horarios diferentes, bloqueando apenas sobreposicoes no mesmo dia. No cadastro administrativo, a reserva usa uma matriz de segunda a sabado, com blocos de 1 hora entre 08:00 e 22:00.
- Melhora a gestao da informacao ao separar dados operacionais de dados publicos: o painel mostra filtros ativos, mesas livres, mesas ocupadas e status por mesa; a area administrativa mostra legenda e resumo antes de salvar uma reserva.
- Facilita evoluir depois para tabelas relacionais dedicadas, trocando principalmente a camada `Repository`.
- Facilita substituir a interface por React, Vue ou outro framework no futuro, mantendo a camada `Domain` como referencia.

## Configuracao do Supabase

Execute o arquivo `database/supabase-schema.sql` no SQL Editor do Supabase antes de usar o app. Ele cria a tabela `labcon_state`, habilita RLS, adiciona politicas de leitura/escrita para a chave anonima usada pelo app estatico e instala o trigger que sincroniza novos usuarios do Supabase Auth para o estado compartilhado.

Depois, configure os papeis dos usuarios no Supabase Auth. Para administradores, professores e tecnicos, defina `app_metadata.role` como `administrador`, `professor` ou `tecnico`. Cadastros feitos pelo proprio app recebem o perfil selecionado na tela de cadastro.

Para o administrador inicial, crie um usuario no Supabase Auth e execute `database/supabase-admin-bootstrap.sql`. Credenciais fixas como `admin/admin` nao devem ser embutidas no frontend.

O arquivo `_headers` declara os headers recomendados para hospedagens estaticas compativeis. As paginas tambem incluem metatags de seguranca como fallback, mas headers HTTP reais devem ser preferidos em producao.

## Proxima evolucao recomendada

Quando o sistema sair do prototipo local, a proxima arquitetura recomendada e:

- Permissoes reais por usuario usando claims/metadados do Supabase Auth.
- Tabelas relacionais dedicadas para `users`, `labs`, `desks`, `reservations` e `roles`.
- Camada de dominio no servidor para impedir conflitos de reserva mesmo com varios usuarios usando o sistema ao mesmo tempo.
- Painel publico como rota somente leitura.
- Auditoria de alteracoes feitas por administradores e tecnicos.
