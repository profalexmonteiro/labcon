<?php
/**
 * Tela de redefinição de senha. O token vem por query string (link
 * enviado por e-mail em AuthService::requestPasswordReset()) e é apenas
 * embutido no formulário — a validação de fato ocorre no servidor via
 * POST para api/auth.php (action=resetPassword), nunca aqui.
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
    <title>LabCon | Redefinir senha</title>
    <link rel="icon" href="favicon.ico" sizes="any">
    <link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
    <link rel="stylesheet" href="assets/css/styles.css">
  </head>
  <body>
    <main class="auth-page">
      <section class="auth-panel" aria-labelledby="reset-title">
        <div class="brand auth-brand">
          <img class="brand-logo" src="assets/img/labcontrol-logo.png" alt="LabControl">
          <div>
            <small>Recuperacao de acesso</small>
          </div>
        </div>

        <form class="auth-form active" id="reset-form">
          <div>
            <p class="eyebrow">Nova senha</p>
            <h1 id="reset-title">Redefinir senha</h1>
          </div>
          <input id="reset-token" type="hidden" value="<?= htmlspecialchars(isset($_GET['token']) ? $_GET['token'] : '', ENT_QUOTES, 'UTF-8') ?>">
          <div class="field">
            <label for="reset-password">Nova senha</label>
            <input id="reset-password" type="password" required autocomplete="new-password" minlength="8" maxlength="128">
          </div>
          <div class="field">
            <label for="reset-password-confirm">Confirmar senha</label>
            <input id="reset-password-confirm" type="password" required autocomplete="new-password" minlength="8" maxlength="128">
          </div>
          <button class="button primary" type="submit">Salvar nova senha</button>
        </form>

        <div class="auth-footer">
          <a href="login.php">Voltar ao login</a>
        </div>
      </section>
    </main>

    <div class="toast" id="toast" role="status" aria-live="polite"></div>
    <script src="src/config.js"></script>
    <script src="src/reset_password.js"></script>
  </body>
</html>
