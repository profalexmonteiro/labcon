<?php
/**
 * Dispatcher HTTP de /api/auth.php — sem lógica própria por convenção da
 * camada: apenas carrega o bootstrap, valida CSRF em métodos mutantes e
 * delega ao Controller (ver README, seção "Regras de camada").
 */

require_once __DIR__ . '/../app/bootstrap.php';

verify_csrf_if_mutating();
(new App\Controllers\AuthController())->handle(new App\Support\Request());
