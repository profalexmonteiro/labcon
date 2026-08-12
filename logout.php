<?php
/** Encerra a sessão do usuário atual e redireciona para a tela de login. */

require_once __DIR__ . '/app/bootstrap.php';

(new App\Services\AuthService())->logout();
header('Location: login.php');
exit;
