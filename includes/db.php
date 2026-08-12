<?php
/**
 * Ponto único de acesso à conexão PDO com o MySQL/MariaDB.
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/install.php';

/**
 * Retorna a conexão PDO compartilhada da requisição atual.
 *
 * A conexão é criada de forma "lazy" (só na primeira chamada) e reaproveitada
 * nas chamadas seguintes via variável `static`, evitando abrir mais de uma
 * conexão por requisição. Antes de conectar ao banco de destino, garante que
 * o schema já existe chamando `ensure_database_ready()` (ver includes/install.php).
 *
 * @return PDO Conexão ativa, configurada em modo de exceção (ERRMODE_EXCEPTION).
 */
function get_db() {
    static $pdo = null;
    if ($pdo === null) {
        ensure_database_ready();
        $pdo = new PDO(get_database_dsn(), DB_USER, DB_PASS, get_pdo_options());
    }
    return $pdo;
}
