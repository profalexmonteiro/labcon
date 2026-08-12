<?php
require_once __DIR__ . '/compat56.php';

/**
 * ATENÇÃO (segurança): as credenciais abaixo ficavam fixas neste arquivo,
 * que faz parte do código-fonte versionado do projeto — isso é exposição de
 * segredo (CWE-798): qualquer pessoa com acesso ao repositório (histórico
 * de Git incluído) obtém a senha do banco e a chave usada para cifrar a
 * senha SMTP salva. Gire (troque) a senha do MySQL e o APP_SECRET o quanto
 * antes. Agora é possível sobrescrevê-los por variável de ambiente do
 * servidor (LABCON_DB_PASS, LABCON_APP_SECRET, etc.) em vez de mantê-los em
 * texto puro aqui; os valores abaixo continuam como fallback para não
 * quebrar instalações existentes.
 */
function env_or_default($name, $default) {
    $value = getenv($name);
    return ($value !== false && $value !== '') ? $value : $default;
}

// Configurações do banco de dados - ajuste conforme seu ambiente
define('DB_HOST', env_or_default('LABCON_DB_HOST', ''));
define('DB_NAME', env_or_default('LABCON_DB_NAME', ''));
define('DB_USER', env_or_default('LABCON_DB_USER', ''));
define('DB_PASS', env_or_default('LABCON_DB_PASS', ''));
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATION', 'utf8mb4_unicode_ci');

define('APP_NAME', 'LabCon');
define('SESSION_NAME', 'labcon_sess');
define('APP_SECRET', env_or_default('LABCON_APP_SECRET', 'labcon-change-this-secret-key'));

if (APP_SECRET === 'labcon-change-this-secret-key') {
    error_log('[LabCon SECURITY] APP_SECRET não foi alterado do valor padrão. Defina a variável de ambiente LABCON_APP_SECRET (ou atualize includes/config.php) antes de usar em produção.');
}

// Modo debug: mantenha desligado em produção. Com display_errors ativo, uma
// exceção não tratada (ex.: falha de conexão com o banco) imprime stack
// trace, caminhos do servidor e por vezes trechos de SQL na resposta HTTP
// para qualquer visitante (divulgação de informação / CWE-209).
if (!defined('APP_DEBUG')) {
    define('APP_DEBUG', env_or_default('LABCON_APP_DEBUG', '0') === '1');
}
error_reporting(E_ALL);
ini_set('display_errors', APP_DEBUG ? '1' : '0');
ini_set('log_errors', '1');

// Configurações de segurança de sessão
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_samesite', 'Lax');
ini_set('session.use_strict_mode', 1);

// Ativar cookie seguro apenas quando servido via HTTPS
$_labcon_https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || ((isset($_SERVER['SERVER_PORT']) ? $_SERVER['SERVER_PORT'] : 80) == 443);
ini_set('session.cookie_secure', $_labcon_https ? '1' : '0');
unset($_labcon_https);
