<?php
/**
 * Instalador automático do banco de dados.
 *
 * Cria o banco (se não existir), todas as tabelas do schema, os índices
 * necessários e a conta de administrador padrão — tudo na primeira
 * requisição feita à aplicação, sem exigir passos manuais de instalação.
 * Isso é redundante de propósito com `database/schema.sql`, que existe
 * apenas como referência/alternativa para instalação manual via linha
 * de comando.
 */

require_once __DIR__ . '/config.php';

/**
 * Escapa um identificador (nome de tabela/coluna/índice) com backticks,
 * duplicando backticks internos. Usado sempre que um nome dinâmico
 * precisa ser interpolado em SQL (identificadores não podem ser
 * parametrizados via prepared statement).
 */
function db_identifier($name) {
    return '`' . str_replace('`', '``', $name) . '`';
}

/** DSN de conexão ao servidor MySQL sem banco selecionado (usado para criar o banco). */
function get_server_dsn() {
    return 'mysql:host=' . DB_HOST . ';charset=' . DB_CHARSET;
}

/** DSN de conexão já apontando para o banco de dados da aplicação. */
function get_database_dsn() {
    return 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
}

/**
 * Opções padrão do PDO usadas em todas as conexões da aplicação:
 * exceções em erro de SQL, fetch associativo por padrão e prepares
 * reais (não emulados) no driver do MySQL.
 */
function get_pdo_options() {
    return [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
}

/**
 * Garante que o banco de dados e o schema existem antes do primeiro uso.
 *
 * Idempotente por requisição (flag `static $ready`) e por ambiente
 * (usa `CREATE DATABASE IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`),
 * portanto é seguro chamá-la a cada requisição sem custo de recriar nada
 * já existente.
 */
function ensure_database_ready() {
    static $ready = false;
    if ($ready) {
        return;
    }

    $server = new PDO(get_server_dsn(), DB_USER, DB_PASS, get_pdo_options());
    $server->exec(
        'CREATE DATABASE IF NOT EXISTS ' . db_identifier(DB_NAME) .
        ' CHARACTER SET ' . DB_CHARSET .
        ' COLLATE ' . DB_COLLATION
    );

    $db = new PDO(get_database_dsn(), DB_USER, DB_PASS, get_pdo_options());
    create_schema($db);

    $ready = true;
}

/**
 * Cria (se ainda não existirem) todas as tabelas da aplicação, na ordem
 * que respeita as dependências de chave estrangeira, além dos índices
 * auxiliares e da conta de administrador padrão.
 */
function create_schema(PDO $db) {
    $tableOptions = ' ENGINE=InnoDB DEFAULT CHARSET=' . DB_CHARSET . ' COLLATE=' . DB_COLLATION;

    $db->exec("
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(80) PRIMARY KEY,
            email VARCHAR(255) UNIQUE DEFAULT NULL,
            password_hash VARCHAR(255) DEFAULT NULL,
            name VARCHAR(255) NOT NULL,
            role ENUM('aluno','professor','tecnico','administrador') NOT NULL DEFAULT 'aluno',
            level VARCHAR(20) DEFAULT NULL,
            course VARCHAR(255) DEFAULT NULL,
            program VARCHAR(50) DEFAULT NULL,
            postgrad_type VARCHAR(50) DEFAULT NULL,
            advisor_id VARCHAR(80) DEFAULT NULL,
            advisor_name VARCHAR(255) DEFAULT NULL,
            research_project TEXT DEFAULT NULL,
            entry_date DATE DEFAULT NULL,
            qualification_deadline DATE DEFAULT NULL,
            advisor_meeting_url VARCHAR(500) DEFAULT NULL,
            article_url VARCHAR(500) DEFAULT NULL,
            qualification_url VARCHAR(500) DEFAULT NULL,
            thesis_url VARCHAR(500) DEFAULT NULL,
            photo_data_url MEDIUMTEXT DEFAULT NULL,
            source VARCHAR(50) DEFAULT 'manual',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )" . $tableOptions);

    setup_default_admin($db);

    $db->exec("
        CREATE TABLE IF NOT EXISTS labs (
            id VARCHAR(80) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            location VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )" . $tableOptions);

    $db->exec("
        CREATE TABLE IF NOT EXISTS desks (
            id VARCHAR(80) PRIMARY KEY,
            lab_id VARCHAR(80) NOT NULL,
            name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE
        )" . $tableOptions);

    $db->exec("
        CREATE TABLE IF NOT EXISTS reservations (
            id VARCHAR(80) PRIMARY KEY,
            user_id VARCHAR(80) NOT NULL,
            lab_id VARCHAR(80) NOT NULL,
            desk_id VARCHAR(80) NOT NULL,
            day ENUM('Segunda','Terca','Quarta','Quinta','Sexta','Sabado') NOT NULL,
            start_time VARCHAR(5) NOT NULL,
            end_time VARCHAR(5) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE,
            FOREIGN KEY (desk_id) REFERENCES desks(id) ON DELETE CASCADE
        )" . $tableOptions);

    $db->exec("
        CREATE TABLE IF NOT EXISTS app_settings (
            setting_key VARCHAR(120) PRIMARY KEY,
            setting_value MEDIUMTEXT DEFAULT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )" . $tableOptions);

    $db->exec("
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id VARCHAR(80) PRIMARY KEY,
            user_id VARCHAR(80) NOT NULL,
            token_hash VARCHAR(64) NOT NULL,
            expires_at DATETIME NOT NULL,
            used_at DATETIME DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )" . $tableOptions);

    $db->exec("
        CREATE TABLE IF NOT EXISTS login_attempts (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            identifier VARCHAR(255) NOT NULL,
            attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )" . $tableOptions);

    create_index_if_missing($db, 'desks', 'idx_desks_lab_id', 'lab_id');
    create_index_if_missing($db, 'reservations', 'idx_reservations_user_id', 'user_id');
    create_index_if_missing($db, 'reservations', 'idx_reservations_lab_id', 'lab_id');
    create_index_if_missing($db, 'reservations', 'idx_reservations_desk_id', 'desk_id');
    create_index_if_missing($db, 'reservations', 'idx_reservations_day', 'day');
    create_index_if_missing($db, 'password_reset_tokens', 'idx_password_reset_token_hash', 'token_hash');
    create_index_if_missing($db, 'password_reset_tokens', 'idx_password_reset_user_id', 'user_id');
    create_index_if_missing($db, 'login_attempts', 'idx_login_attempts_identifier', 'identifier');
    create_index_if_missing($db, 'login_attempts', 'idx_login_attempts_attempted_at', 'attempted_at');
}

/**
 * Garante a existência de uma conta de administrador com credencial segura.
 *
 * - Se a conta padrão (`admin-0000000000000000`) ainda não existe, cria-a
 *   com uma senha aleatória de 16 caracteres hex e grava a credencial via
 *   `write_setup_credentials()`.
 * - Se a conta já existe mas seu hash de senha é um dos hashes "conhecidos"
 *   de instalações antigas ($knownDefaultHashes — senhas padrão publicadas
 *   em versões anteriores do projeto), a senha é rotacionada automaticamente
 *   para uma nova senha aleatória, fechando uma janela de credencial previsível.
 */
function setup_default_admin(PDO $db) {
    $knownDefaultHashes = [
        '$2y$12$BLAMWlJ.gm0ms0aUp.JwuOyXkw1nOGvxPY9.QD0.BdbLAPmsVYLzq',
        '$2y$12$JBwknBUIerRlrokO9W8HNuSHyOE63s.EvweeL05R/882Emh0i8dcK',
    ];

    $stmt = $db->prepare("SELECT password_hash FROM users WHERE id = 'admin-0000000000000000'");
    $stmt->execute();
    $row = $stmt->fetch();

    if (!$row) {
        $password = bin2hex(random_bytes(8));
        $hash     = password_hash($password, PASSWORD_BCRYPT);
        $stmt     = $db->prepare(
            "INSERT INTO users (id, email, password_hash, name, role, source)
             VALUES ('admin-0000000000000000', 'admin@labcon.local', ?, 'Administrador Padrão', 'administrador', 'manual')"
        );
        $stmt->execute([$hash]);
        write_setup_credentials($password);
        return;
    }

    if (in_array($row['password_hash'], $knownDefaultHashes, true)) {
        $password = bin2hex(random_bytes(8));
        $hash     = password_hash($password, PASSWORD_BCRYPT);
        $stmt     = $db->prepare("UPDATE users SET password_hash = ? WHERE id = 'admin-0000000000000000'");
        $stmt->execute([$hash]);
        write_setup_credentials($password);
    }
}

/**
 * Registra a credencial recém-gerada do administrador em dois lugares:
 * o PHP error log (tag `[LabCon]`) e o arquivo `.labcon_setup` na raiz do
 * projeto — para que a pessoa que instalou o sistema consiga recuperá-la
 * sem acesso direto ao banco de dados. O arquivo deve ser apagado pelo
 * administrador após o primeiro login.
 */
function write_setup_credentials($password) {
    $msg = "[LabCon] Credencial do administrador — e-mail: admin@labcon.local | senha: $password — Altere após o primeiro acesso.";
    error_log($msg);

    $setupFile = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.labcon_setup';
    $content   = "LabCon — Credencial gerada automaticamente\n"
               . "E-mail : admin@labcon.local\n"
               . "Senha  : $password\n"
               . "Apague este arquivo após fazer login e trocar a senha.\n";
    @file_put_contents($setupFile, $content);
}

/**
 * Cria um índice em `$table.$column` apenas se ele ainda não existir,
 * consultando `information_schema.statistics`. Necessário porque o MySQL
 * não possui uma cláusula `CREATE INDEX IF NOT EXISTS`.
 */
function create_index_if_missing(PDO $db, $table, $index, $column) {
    $stmt = $db->prepare(
        'SELECT COUNT(*) FROM information_schema.statistics
         WHERE table_schema = ? AND table_name = ? AND index_name = ?'
    );
    $stmt->execute([DB_NAME, $table, $index]);

    if ((int) $stmt->fetchColumn() === 0) {
        $db->exec(
            'CREATE INDEX ' . db_identifier($index) .
            ' ON ' . db_identifier($table) .
            ' (' . db_identifier($column) . ')'
        );
    }
}
