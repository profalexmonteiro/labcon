<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/install.php';

function get_db() {
    static $pdo = null;
    if ($pdo === null) {
        ensure_database_ready();
        $pdo = new PDO(get_database_dsn(), DB_USER, DB_PASS, get_pdo_options());
    }
    return $pdo;
}
