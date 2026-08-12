<?php
/** Dispatcher HTTP de /api/reservations.php — ver comentário em api/auth.php. */

require_once __DIR__ . '/../app/bootstrap.php';

verify_csrf_if_mutating();
(new App\Controllers\ReservationController())->handle(new App\Support\Request());
