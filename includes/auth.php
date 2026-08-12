<?php
/**
 * Helpers de sessão, autenticação, autorização e CSRF.
 *
 * Este arquivo concentra toda a lógica de "quem é o usuário atual" e "o que
 * ele pode fazer". Controllers e scripts de página devem sempre validar
 * autenticação/autorização por aqui — nunca reimplementar a checagem
 * localmente, pois a segurança da aplicação depende de um único ponto de
 * verdade para essas regras.
 */
require_once __DIR__ . '/config.php';

/**
 * Inicia a sessão PHP com o nome de cookie customizado (SESSION_NAME),
 * caso ainda não haja uma sessão ativa. Idempotente: pode ser chamada
 * várias vezes por requisição sem efeito colateral.
 */
function start_session() {
    if (session_status() === PHP_SESSION_NONE) {
        session_name(SESSION_NAME);
        session_start();
    }
}

/**
 * Retorna o token CSRF da sessão atual, gerando um novo (32 bytes
 * aleatórios, 64 caracteres hex) na primeira chamada da sessão.
 *
 * @return string Token CSRF em hexadecimal.
 */
function csrf_token() {
    start_session();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Compara o token enviado no header `X-CSRF-Token` com o token da sessão
 * usando `hash_equals()` (comparação em tempo constante, evita timing
 * attack). Em caso de divergência, interrompe a requisição com HTTP 403.
 */
function verify_csrf_token() {
    $header = isset($_SERVER['HTTP_X_CSRF_TOKEN']) ? $_SERVER['HTTP_X_CSRF_TOKEN'] : '';
    $token  = csrf_token();
    if (!$header || !hash_equals($token, $header)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'error' => 'Token CSRF inválido.']);
        exit;
    }
}

/**
 * Aplica a verificação de CSRF apenas em métodos que alteram estado
 * (POST, PUT, PATCH, DELETE). Métodos seguros (GET, HEAD) não exigem token.
 * Deve ser chamada no início de todo endpoint em `api/*.php`.
 */
function verify_csrf_if_mutating() {
    $method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
    if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
        verify_csrf_token();
    }
}

/**
 * Exige sessão autenticada E que o papel (role) do usuário esteja entre os
 * papéis permitidos, informados como argumentos variádicos
 * (ex.: `require_role('administrador', 'professor')`).
 * Encerra a requisição com HTTP 403 caso o papel não seja permitido.
 *
 * @return array Dados do usuário autenticado.
 */
function require_role() {
    $roles = func_get_args();
    $user = require_auth();
    if (!in_array(isset($user['role']) ? $user['role'] : '', $roles, true)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'error' => 'Acesso negado.']);
        exit;
    }
    return $user;
}

/**
 * Exige que exista um usuário autenticado na sessão atual.
 *
 * Quando não autenticado, o comportamento difere por tipo de chamada:
 * - Chamadas de API (XHR, `Accept: application/json` ou rota sob `/api/`)
 *   recebem um JSON com HTTP 401 e a chave `redirect` para o front-end
 *   tratar o redirecionamento via JavaScript.
 * - Navegação de página comum é redirecionada diretamente para `login.php`.
 *
 * @return array Dados do usuário autenticado (vazio se sessão inconsistente).
 */
function require_auth() {
    start_session();
    if (empty($_SESSION['user_id'])) {
        // Retorna JSON 401 para chamadas de API (fetch/XHR)
        $isApiCall = (
            (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') ||
            (isset($_SERVER['HTTP_ACCEPT']) && str_contains($_SERVER['HTTP_ACCEPT'], 'application/json')) ||
            (str_contains(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '', '/api/'))
        );
        if ($isApiCall) {
            http_response_code(401);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['success' => false, 'error' => 'Não autenticado.', 'redirect' => 'login.php']);
            exit;
        }
        header('Location: login.php');
        exit;
    }
    return isset($_SESSION['user']) ? $_SESSION['user'] : [];
}

/**
 * Versão "silenciosa" de require_auth(): retorna o usuário da sessão ou
 * `null`, sem interromper a execução. Útil em páginas com conteúdo público
 * que variam a exibição conforme o visitante estar logado ou não
 * (ex.: index.php).
 *
 * @return array|null
 */
function get_session_user() {
    start_session();
    if (empty($_SESSION['user_id'])) return null;
    return isset($_SESSION['user']) ? $_SESSION['user'] : null;
}

/**
 * Grava o usuário autenticado na sessão após um login bem-sucedido.
 *
 * Chama `session_regenerate_id(true)` antes de gravar os dados para
 * prevenir fixation de sessão (impede que um ID de sessão pré-existente,
 * potencialmente conhecido por um atacante, seja reaproveitado após o login).
 *
 * @param array $user Dados do usuário (deve conter ao menos 'id').
 */
function set_session_user(array $user) {
    start_session();
    session_regenerate_id(true);
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user']    = $user;
}

/**
 * Encerra a sessão atual (logout), removendo todos os dados de sessão
 * e destruindo o registro correspondente no servidor.
 */
function clear_session() {
    start_session();
    session_unset();
    session_destroy();
}
