<?php
/**
 * Bootstrap da aplicação: carrega os includes de base (compatibilidade,
 * configuração, banco, sessão/CSRF, utilitários), registra o tratamento
 * global de erros/exceções não capturados e o autoloader PSR-4-like do
 * namespace `App\`.
 *
 * Todo endpoint em api/*.php e toda página que usa Controllers/Services
 * deve dar `require_once` neste arquivo como primeira linha.
 */

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

/**
 * Erros fatais (ex.: exaustão de memória, erro de parse em um require
 * dinâmico) não passam pelo exception handler acima — o PHP simplesmente
 * interrompe a execução. Este shutdown function captura esse caso via
 * `error_get_last()` e garante a mesma resposta JSON genérica em vez de
 * uma página de erro do PHP (ou uma resposta vazia) chegando ao cliente.
 */
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

/**
 * Autoloader para o namespace `App\`: mapeia `App\Controllers\FooController`
 * para `app/Controllers/FooController.php`, relativo a este diretório
 * (convenção PSR-4 simplificada, sem depender do Composer).
 */
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
