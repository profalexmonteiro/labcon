<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="no-referrer">
    <title>LabCon | Painel Público</title>
    <link rel="icon" href="favicon.ico" sizes="any">
    <link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
    <link rel="stylesheet" href="assets/css/styles.css">
  </head>
  <body>
    <main class="public-page">
      <header class="public-topbar">
        <div class="brand public-brand">
          <img class="brand-logo" src="assets/img/labcontrol-logo.png" alt="LabControl">
          <div>
            <small>Painel público de laboratórios</small>
          </div>
        </div>
        <a class="button primary login-button" href="login.php">Entrar no sistema</a>
      </header>

      <section class="public-hero" aria-labelledby="view-title">
        <div>
          <p class="eyebrow">Gerenciamento de laboratórios de pesquisa</p>
          <h1 id="view-title">Painel Público</h1>
        </div>
      </section>

      <section class="info-strip" id="public-insight" aria-live="polite"></section>

      <section class="metrics-grid" aria-label="Resumo dos laboratórios">
        <article class="metric">
          <span>Laboratórios</span>
          <strong id="metric-labs">0</strong>
        </article>
        <article class="metric">
          <span>Mesas</span>
          <strong id="metric-desks">0</strong>
        </article>
        <article class="metric">
          <span>Pesquisadores</span>
          <strong id="metric-users">0</strong>
        </article>
        <article class="metric">
          <span>Reservas ativas</span>
          <strong id="metric-reservations">0</strong>
        </article>
      </section>

      <section aria-labelledby="occupancy-title">
        <div class="section-heading">
          <h2 id="occupancy-title">Ocupação por laboratório</h2>
        </div>
        <div id="public-board" class="board-grid"></div>
      </section>
    </main>

    <script src="src/config.js"></script>
    <script src="src/public.js"></script>
  </body>
</html>
