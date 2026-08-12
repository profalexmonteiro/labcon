<?php

require_once __DIR__ . '/../app/bootstrap.php';

verify_csrf_if_mutating();
(new App\Controllers\LabController())->handle(new App\Support\Request());
