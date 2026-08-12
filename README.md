# LabCon — Sistema de Gerenciamento de Laboratórios

Sistema web para gerenciamento de laboratórios de pesquisa, mesas, reservas e usuários. Desenvolvido para o contexto universitário do IFSC.

---

## Sumário

1. [Requisitos](#requisitos)
2. [Instalação](#instalação)
   - [Com XAMPP (Windows/Linux/macOS)](#com-xampp)
   - [Com servidor Apache + PHP nativo](#com-apache--php-nativo)
3. [Configuração](#configuração)
   - [Banco de dados](#banco-de-dados)
   - [Chave de aplicação (APP_SECRET)](#chave-de-aplicação-app_secret)
   - [SMTP](#smtp)
4. [Primeiro acesso](#primeiro-acesso)
5. [Papéis de usuário](#papéis-de-usuário)
6. [Arquitetura](#arquitetura)
7. [Segurança](#segurança)
8. [API](#api)
9. [Desenvolvimento](#desenvolvimento)

---

## Requisitos

| Componente | Versão mínima |
|---|---|
| PHP | 8.1 |
| MySQL / MariaDB | 8.0 / 10.6 |
| Extensões PHP | `pdo_mysql`, `openssl`, `mbstring`, `json` |
| Servidor web | Apache 2.4+ ou XAMPP 8.x |

---

## Instalação

### Com XAMPP

1. **Instale o XAMPP** a partir de [apachefriends.org](https://www.apachefriends.org) e inicie os módulos **Apache** e **MySQL**.

2. **Clone ou copie o projeto** para a pasta `htdocs`:

   ```bash
   git clone <url-do-repositorio> C:/xampp/htdocs/labcon2
   ```

3. **Configure o banco de dados** editando `includes/config.php` (veja a seção [Banco de dados](#banco-de-dados)).

4. **Configure a chave de aplicação** `APP_SECRET` (veja a seção [Chave de aplicação](#chave-de-aplicação-app_secret)).

5. **Acesse** `http://localhost/labcon2/` no navegador.  
   O sistema criará o banco de dados e as tabelas automaticamente na primeira requisição.

6. **Obtenha a credencial do administrador** gerada automaticamente (veja a seção [Primeiro acesso](#primeiro-acesso)).

---

### Com Apache + PHP nativo

1. **Clone o repositório** no diretório de sua preferência:

   ```bash
   git clone <url-do-repositorio> /var/www/labcon
   ```

2. **Configure um Virtual Host** no Apache apontando para o diretório raiz do projeto.  
   Exemplo de `/etc/apache2/sites-available/labcon.conf`:

   ```apache
   <VirtualHost *:80>
       ServerName labcon.example.com
       DocumentRoot /var/www/labcon
       DirectoryIndex index.php

       <Directory /var/www/labcon>
           AllowOverride All
           Require all granted
       </Directory>

       ErrorLog ${APACHE_LOG_DIR}/labcon_error.log
       CustomLog ${APACHE_LOG_DIR}/labcon_access.log combined
   </VirtualHost>
   ```

3. **Habilite o site** e reinicie o Apache:

   ```bash
   a2ensite labcon.conf
   systemctl restart apache2
   ```

4. **Ajuste as permissões** da raiz do projeto para o usuário do Apache:

   ```bash
   chown -R www-data:www-data /var/www/labcon
   chmod -R 755 /var/www/labcon
   ```

5. Siga os passos 3 a 6 da seção XAMPP acima.

> **HTTPS em produção:** configure um certificado TLS (ex.: Let's Encrypt com Certbot) e ajuste o VirtualHost para a porta 443. O cookie de sessão é automaticamente marcado como `Secure` quando o sistema detecta HTTPS.

---

## Configuração

### Banco de dados

Edite o arquivo `includes/config.php` com as credenciais do seu ambiente:

```php
define('DB_HOST', 'localhost');   // Host do MySQL
define('DB_NAME', 'labcon');      // Nome do banco (será criado se não existir)
define('DB_USER', 'root');        // Usuário MySQL
define('DB_PASS', '');            // Senha MySQL
define('DB_CHARSET',   'utf8mb4');
define('DB_COLLATION', 'utf8mb4_unicode_ci');
```

O sistema executa a criação do banco e das tabelas automaticamente via `includes/install.php` na primeira requisição. Nenhum comando SQL manual é necessário.

Para instalação manual via linha de comando:

```bash
mysql -u root -p < database/schema.sql
```

---

### Chave de aplicação (APP_SECRET)

`APP_SECRET` é usada para cifrar a senha SMTP armazenada no banco de dados (AES-256-CBC).

**Antes de colocar o sistema em produção, substitua o valor padrão por uma string aleatória de pelo menos 32 caracteres:**

```php
define('APP_SECRET', 'SuaChaveSecretaAqui_MudeEsta_32chars+');
```

Para gerar uma chave segura:

```bash
# Linux / macOS
openssl rand -hex 32

# PHP
php -r "echo bin2hex(random_bytes(32));"
```

> **Atenção:** Se a chave padrão não for alterada, o sistema registrará um aviso no PHP error log a cada requisição. Se a chave for alterada após a configuração SMTP ter sido salva, será necessário reconfigurar o SMTP na interface administrativa.

---

### SMTP

O envio de e-mails (recuperação de senha) é configurado pela interface administrativa em **Configuração → SMTP**, sem necessidade de editar arquivos.

Parâmetros disponíveis:

| Campo | Descrição |
|---|---|
| Servidor SMTP | Endereço do servidor (ex.: `smtp.gmail.com`) |
| Porta | Tipicamente `587` (STARTTLS) ou `465` (SSL) |
| Criptografia | `STARTTLS`, `SSL` ou `Nenhuma` |
| Usuário / Senha | Credenciais da conta de envio |
| E-mail remetente | Endereço que aparece no campo "De" |
| Nome remetente | Nome exibido ao destinatário |

A senha SMTP é armazenada cifrada no banco de dados usando a `APP_SECRET` configurada acima.

---

## Primeiro acesso

Na primeira vez que o sistema é iniciado (banco vazio), o instalador cria automaticamente uma conta de administrador com **senha gerada aleatoriamente**.

A senha é disponibilizada de duas formas:

1. **Arquivo `.labcon_setup`** na raiz do projeto (ex.: `C:/xampp/htdocs/labcon2/.labcon_setup`):
   ```
   LabCon — Credencial gerada automaticamente
   E-mail : admin@labcon.local
   Senha  : a3f7c2b8e1d94f05
   Apague este arquivo após fazer login e trocar a senha.
   ```

2. **PHP error log** — a mesma informação é registrada com a tag `[LabCon]`.

Após o primeiro login, **altere imediatamente a senha** pelo menu **Meu cadastro** e apague o arquivo `.labcon_setup`.

> O e-mail padrão do administrador é `admin@labcon.local`. Ele pode ser alterado na área administrativa.

---

## Papéis de usuário

| Papel | Acesso |
|---|---|
| `aluno` | Painel público, reservas próprias, perfil |
| `professor` | Tudo do aluno + gerenciamento de usuários, laboratórios e mesas; reservas em nome de outros |
| `tecnico` | Mesmo que professor |
| `administrador` | Acesso total, incluindo configuração SMTP, limpeza de dados e gerenciamento de papéis |

O auto-cadastro via página de login permite os papéis `aluno`, `professor` e `técnico`. O papel `administrador` só pode ser atribuído por outro administrador.

---

## Arquitetura

```
labcon2/
├── api/                  # Endpoints HTTP (thin dispatchers)
│   ├── auth.php
│   ├── users.php
│   ├── labs.php
│   ├── desks.php
│   ├── reservations.php
│   ├── state.php
│   └── smtp.php
│
├── app/
│   ├── bootstrap.php     # Autoloader e inicialização
│   ├── Controllers/      # Interpretam HTTP → delegam ao Service
│   ├── Services/         # Regras de negócio e validações
│   ├── Repositories/     # Acesso ao MySQL via PDO
│   └── Support/          # Request, Response (utilitários HTTP)
│
├── includes/
│   ├── config.php        # Constantes de ambiente
│   ├── auth.php          # Sessão, CSRF, helpers de autorização
│   ├── db.php            # Conexão PDO lazy
│   ├── install.php       # Criação automática do schema
│   └── functions.php     # Mapeadores de array (user_to_array, etc.)
│
├── src/                  # JavaScript da interface
│   ├── config.js         # Configurações e permissões client-side
│   ├── app.js            # SPA administrativa
│   ├── login.js          # Tela de login/cadastro
│   └── public.js         # Painel público (index.php)
│
├── assets/               # CSS e imagens
├── database/             # Schema SQL para instalação manual
├── admin.php             # Interface administrativa (requer autenticação)
├── index.php             # Painel público (sem autenticação)
├── login.php             # Tela de login e cadastro
└── reset_password.php    # Redefinição de senha por token
```

**Fluxo de uma requisição:**

```
api/reservations.php
  → verify_csrf_if_mutating()
  → ReservationController::handle()
  → ReservationService::saveMany()
  → ReservationRepository::save()
  → MySQL
```

**Regras de camada:**

- `api/*.php` — sem lógica; apenas carrega `bootstrap.php`, verifica CSRF e delega ao Controller.
- `Controllers` — sem SQL; interpretam HTTP, verificam autenticação/autorização e retornam JSON.
- `Services` — regras de negócio, validações, orquestração entre repositórios.
- `Repositories` — todo SQL fica aqui; expõem somente métodos semânticos (`find`, `save`, `delete`, `all`).

---

## Segurança

### Autenticação e sessão

- Sessões PHP com `HttpOnly`, `SameSite=Lax` e `Secure` (quando HTTPS).
- Regeneração de ID de sessão no login (`session_regenerate_id(true)`).
- Senhas armazenadas com `password_hash(PASSWORD_BCRYPT)`.

### Proteção contra força bruta

- Máximo de **10 tentativas de login** por IP + e-mail em uma janela de **5 minutos**.
- Tentativas registradas na tabela `login_attempts` e limpas automaticamente.

### CSRF

- Token de 64 caracteres hexadecimais gerado por sessão e armazenado em `$_SESSION['csrf_token']`.
- Injetado nas páginas PHP via `window.LabConCsrfToken`.
- Exigido no header `X-CSRF-Token` em todas as requisições `POST`, `PUT`, `PATCH` e `DELETE`.

### Autorização

Toda verificação de permissão ocorre **no servidor**. A lógica JavaScript de permissões (`config.js`) é apenas para UX — nunca é a fonte de verdade de segurança.

Funções disponíveis em `includes/auth.php`:

```php
require_auth()                    // Exige sessão ativa; retorna o usuário
require_role('administrador')     // Exige sessão + papel específico
verify_csrf_if_mutating()         // Valida token CSRF para métodos mutantes
```

### Dados públicos

O endpoint `GET /api/state.php` sem autenticação retorna apenas `{id, name, role}` dos usuários — sem e-mail ou dados pessoais. Usuários autenticados recebem o estado completo.

---

## API

Todos os endpoints retornam JSON e aceitam `Content-Type: application/json`.

Requisições mutantes (`POST`, `PUT`, `DELETE`) exigem:
- Cookie de sessão válido (`labcon_sess`).
- Header `X-CSRF-Token` com o token da sessão.

### Endpoints

| Método | Endpoint | Descrição | Auth |
|---|---|---|---|
| `GET` | `/api/auth.php` | Verifica sessão atual | — |
| `POST` | `/api/auth.php` | `login`, `register`, `logout`, `requestPasswordReset`, `resetPassword` | — |
| `GET` | `/api/state.php` | Estado completo (auth) ou público (sem auth) | Opcional |
| `DELETE` | `/api/state.php` | Limpa todos os dados | Admin |
| `POST` | `/api/state.php` | `action=seed` — popula dados de exemplo | Admin |
| `GET/POST/PUT/DELETE` | `/api/users.php` | CRUD de usuários | Auth |
| `GET/POST/PUT/DELETE` | `/api/labs.php` | CRUD de laboratórios | Auth |
| `GET/POST/PUT/DELETE` | `/api/desks.php` | CRUD de mesas | Auth |
| `GET/POST/PUT/DELETE` | `/api/reservations.php` | CRUD de reservas | Auth |
| `GET/POST` | `/api/smtp.php` | Configurações SMTP | Admin |

### Exemplo de requisição autenticada

```javascript
fetch("api/users.php", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-CSRF-Token": window.LabConCsrfToken
  },
  body: JSON.stringify({ id: "user-abc", name: "João", role: "aluno" })
});
```

---

## Desenvolvimento

### Adicionar um novo endpoint

1. Crie `app/Repositories/MinhaEntidadeRepository.php` estendendo `BaseRepository`.
2. Crie `app/Services/MinhaEntidadeService.php` com as regras de negócio.
3. Crie `app/Controllers/MinhaEntidadeController.php` com o método `handle(Request $request)`.
4. Crie `api/minhaentidade.php`:

   ```php
   <?php
   require_once __DIR__ . '/../app/bootstrap.php';
   verify_csrf_if_mutating();
   (new App\Controllers\MinhaEntidadeController())->handle(new App\Support\Request());
   ```

### Papéis e autorização

Use sempre as helpers de `includes/auth.php` no início do método `handle()`:

```php
// Exige qualquer usuário autenticado
$caller = require_auth();

// Exige papel específico (retorna o usuário ou encerra com 403)
$caller = require_role('administrador');

// Verificação manual de papel
if (!in_array($caller['role'], ['professor', 'administrador'], true)) {
    Response::error('Sem permissão.', 403);
}
```

### Convenções de código

- **Controllers** não fazem SQL e não instanciam PDO.
- **Repositories** usam apenas `prepare()` + `execute()` — sem concatenação de valores em SQL.
- **Nomes de colunas dinâmicos** em `BaseRepository::upsert()` são escapados com backticks automaticamente.
- **Erros esperados** lançam `InvalidArgumentException`; erros de sistema lançam `RuntimeException`.
