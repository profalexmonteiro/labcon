<?php
/**
 * Tela de login/cadastro/recuperação de senha. A lógica de autenticação
 * roda inteiramente no cliente (src/login.js) via chamadas a api/auth.php;
 * este script só inicia a sessão e injeta o token CSRF no HTML.
 */
require_once __DIR__ . '/app/bootstrap.php';
start_session();
$_csrf = csrf_token();
?>
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="no-referrer">
    <meta name="csrf-token" content="<?= htmlspecialchars($_csrf, ENT_QUOTES, 'UTF-8') ?>">
    <title>LabCon | Login</title>
    <link rel="icon" href="favicon.ico" sizes="any">
    <link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
    <link rel="stylesheet" href="assets/css/styles.css">
  </head>
  <body>
    <main class="auth-page">
      <section class="auth-panel" aria-labelledby="auth-title">
        <div class="brand auth-brand">
          <img class="brand-logo" src="assets/img/labcontrol-logo.png" alt="LabControl">
          <div>
            <small>Acesso ao sistema</small>
          </div>
        </div>

        <div class="auth-tabs" role="tablist" aria-label="Opções de acesso">
          <button class="auth-tab active" type="button" data-auth-view="login">Entrar</button>
          <button class="auth-tab" type="button" data-auth-view="register">Cadastrar</button>
          <button class="auth-tab" type="button" data-auth-view="recover">Recuperar senha</button>
        </div>

        <form class="auth-form active" id="login-form" data-auth-panel="login">
          <div>
            <p class="eyebrow">Área restrita</p>
            <h1 id="auth-title">Entrar no sistema</h1>
          </div>
          <div class="field">
            <label for="login-email">E-mail</label>
            <input id="login-email" type="email" required autocomplete="email" maxlength="254">
          </div>
          <div class="field">
            <label for="login-password">Senha</label>
            <input id="login-password" type="password" required autocomplete="current-password" minlength="8" maxlength="128">
          </div>
          <button class="button primary" type="submit">Entrar</button>
        </form>

        <form class="auth-form" id="register-form" data-auth-panel="register">
          <div>
            <p class="eyebrow">Novo acesso</p>
            <h1>Criar cadastro</h1>
          </div>
          <div class="field">
            <label for="register-name">Nome completo</label>
            <input id="register-name" type="text" required autocomplete="name" minlength="3" maxlength="120">
          </div>
          <div class="field">
            <label for="register-email">E-mail institucional</label>
            <input id="register-email" type="email" required autocomplete="email" maxlength="254">
          </div>
          <p class="field-hint">O auto-cadastro é destinado a alunos. Contas de professor ou técnico são criadas por um administrador.</p>
          <div class="field">
            <label for="register-level">Nível</label>
            <select id="register-level">
              <option value="graduacao">Graduação</option>
              <option value="pos-graduacao">Pós-graduação</option>
            </select>
          </div>
          <div class="register-student-only" id="register-undergrad-fields">
            <div class="field">
              <label for="register-course">Curso</label>
              <select id="register-course"></select>
            </div>
            <div class="field">
              <label for="register-program">Vínculo</label>
              <select id="register-program">
                <option value="PIBIC">PIBIC</option>
                <option value="PIID">PIID</option>
                <option value="Voluntario">Voluntário</option>
              </select>
            </div>
          </div>
          <div class="register-student-only hidden" id="register-postgrad-fields">
            <div class="field">
              <label for="register-postgrad-type">Tipo</label>
              <select id="register-postgrad-type">
                <option value="Mestrado">Mestrado</option>
                <option value="Doutorado">Doutorado</option>
              </select>
            </div>
          </div>
          <div class="field register-student-only">
            <label for="register-advisor">Orientador</label>
            <select id="register-advisor" required></select>
          </div>
          <div class="field register-student-only">
            <label for="register-research-project">Projeto de Pesquisa</label>
            <input id="register-research-project" type="text" maxlength="160">
          </div>
          <div class="field">
            <label for="register-password">Senha</label>
            <input id="register-password" type="password" required autocomplete="new-password" minlength="8" maxlength="128">
          </div>
          <button class="button primary" type="submit">Solicitar cadastro</button>
        </form>

        <form class="auth-form" id="recover-form" data-auth-panel="recover">
          <div>
            <p class="eyebrow">Recuperação</p>
            <h1>Recuperar senha</h1>
          </div>
          <div class="field">
            <label for="recover-email">E-mail cadastrado</label>
            <input id="recover-email" type="email" required autocomplete="email" maxlength="254">
          </div>
          <button class="button primary" type="submit">Enviar instrução</button>
        </form>

        <div class="auth-footer">
          <a href="index.php">Voltar ao painel público</a>
        </div>
      </section>
    </main>

    <div class="toast" id="toast" role="status" aria-live="polite"></div>
    <script src="src/config.js"></script>
    <script src="src/login.js"></script>
  </body>
</html>
