<?php

require_once __DIR__ . '/app/bootstrap.php';

(new App\Services\AuthService())->logout();
header('Location: login.php');
exit;
