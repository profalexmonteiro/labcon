<?php

require_once __DIR__ . '/../includes/compat56.php';
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/functions.php';

/**
 * Sem um handler global, uma exceção não tratada (ex.: PDOException de uma
 * falha no banco) cai no handler padrão do PHP, que — se display_errors
 * estiver ligado no php.ini do servidor, comum em hospedagens padrão —
 * imprime stack trace, caminhos absolutos e trechos de SQL na resposta
 * HTTP para qualquer visitante (divulgação de informação). Aqui sempre
 * registramos o erro no log do servidor e devolvemos uma mensagem genérica.
 */
set_exception_handler(function ($e) {
    error_log('[LabCon] Uncaught ' . get_class($e) . ': ' . $e->getMessage()
        . ' in ' . $e->getFile() . ':' . $e->getLine() . "\n" . $e->getTraceAsString());

    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['success' => false, 'error' => 'Erro interno. Tente novamente mais tarde.']);
    exit;
});

register_shutdown_function(function () {
    $error = error_get_last();
    if (!$error || !in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }

    error_log('[LabCon] Fatal error: ' . $error['message'] . ' in ' . $error['file'] . ':' . $error['line']);

    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'error' => 'Erro interno. Tente novamente mais tarde.']);
    }
});

spl_autoload_register(function ($class) {
    $prefix = 'App\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }

    $relative = substr($class, strlen($prefix));
    $path = __DIR__ . '/' . str_replace('\\', '/', $relative) . '.php';

    if (is_file($path)) {
        require_once $path;
    }
});
