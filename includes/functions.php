<?php
/**
 * Funções utilitárias de baixo nível: resposta HTTP em JSON, leitura do
 * corpo da requisição e mapeamento de linhas do banco (snake_case) para
 * arrays no formato usado pelo front-end (camelCase).
 */

/**
 * Envia uma resposta JSON e finaliza a execução do script.
 *
 * @param array $data   Corpo da resposta, serializado com json_encode().
 * @param int   $status Código de status HTTP (padrão 200).
 */
function json_response(array $data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Atalho para responder um erro padronizado `{success:false, error:...}`.
 *
 * @param string $message Mensagem de erro amigável, em português.
 * @param int    $status  Código de status HTTP (padrão 400).
 */
function json_error($message, $status = 400) {
    json_response(['success' => false, 'error' => $message], $status);
}

/**
 * Lê e decodifica o corpo JSON da requisição atual (php://input).
 *
 * @return array Corpo decodificado, ou array vazio se ausente/inválido.
 */
function get_json_body() {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/**
 * Converte uma linha da tabela `users` (colunas snake_case) para o formato
 * de array camelCase consumido pelo front-end. Campos opcionais só são
 * incluídos quando possuem valor (evita poluir o payload com `null`/vazios).
 *
 * @param array $row Linha retornada pelo PDO (FETCH_ASSOC).
 * @return array Usuário no formato da API.
 */
function user_to_array(array $row) {
    $user = [
        'id'     => $row['id'],
        'name'   => $row['name'],
        'role'   => $row['role'],
        'source' => isset($row['source']) ? $row['source'] : 'manual',
    ];
    if (!empty($row['email']))                  $user['email']                 = $row['email'];
    if (!empty($row['level']))                  $user['level']                 = $row['level'];
    if (!empty($row['course']))                 $user['course']                = $row['course'];
    if (!empty($row['program']))                $user['program']               = $row['program'];
    if (!empty($row['postgrad_type']))          $user['postgradType']          = $row['postgrad_type'];
    if (!empty($row['advisor_id']))             $user['advisorId']             = $row['advisor_id'];
    if (!empty($row['advisor_name']))           $user['advisorName']           = $row['advisor_name'];
    if (!empty($row['research_project']))       $user['researchProject']       = $row['research_project'];
    if (!empty($row['entry_date']))             $user['entryDate']             = $row['entry_date'];
    if (!empty($row['qualification_deadline'])) $user['qualificationDeadline'] = $row['qualification_deadline'];
    if (!empty($row['advisor_meeting_url']))    $user['advisorMeetingUrl']     = $row['advisor_meeting_url'];
    if (!empty($row['article_url']))            $user['articleUrl']            = $row['article_url'];
    if (!empty($row['qualification_url']))      $user['qualificationUrl']      = $row['qualification_url'];
    if (!empty($row['thesis_url']))             $user['thesisUrl']             = $row['thesis_url'];
    if (!empty($row['photo_data_url']))         $user['photoDataUrl']          = $row['photo_data_url'];
    return $user;
}

/** Converte uma linha da tabela `labs` para o formato de array da API. */
function lab_to_array(array $row) {
    return [
        'id'       => $row['id'],
        'name'     => $row['name'],
        'location' => isset($row['location']) ? $row['location'] : '',
    ];
}

/** Converte uma linha da tabela `desks` para o formato de array da API. */
function desk_to_array(array $row) {
    return [
        'id'    => $row['id'],
        'labId' => $row['lab_id'],
        'name'  => $row['name'],
    ];
}

/** Converte uma linha da tabela `reservations` para o formato de array da API. */
function reservation_to_array(array $row) {
    return [
        'id'     => $row['id'],
        'userId' => $row['user_id'],
        'labId'  => $row['lab_id'],
        'deskId' => $row['desk_id'],
        'day'    => $row['day'],
        'start'  => $row['start_time'],
        'end'    => $row['end_time'],
    ];
}

/**
 * Insere ou atualiza um registro de usuário em uma única instrução SQL
 * (`INSERT ... ON DUPLICATE KEY UPDATE`), útil para operações de upsert
 * (ex.: sincronização de usuários por `id` já conhecido).
 *
 * Os nomes de coluna vêm de `array_keys($fields)` e são escapados com
 * backticks para permitir identificadores dinâmicos com segurança; os
 * valores são sempre passados via placeholders (`?`) e nunca concatenados
 * na string SQL, prevenindo SQL injection.
 *
 * @param PDO   $db     Conexão ativa.
 * @param array $fields Colunas => valores a inserir/atualizar (deve conter 'id').
 * @return array|false Linha resultante após o upsert, ou false se não encontrada.
 */
function upsert_user_record(PDO $db, array $fields) {
    $cols       = array_keys($fields);
    $quotedCols = array_map(function ($c) {
        return '`' . str_replace('`', '``', $c) . '`';
    }, $cols);
    $placeholders = implode(', ', array_fill(0, count($fields), '?'));
    $updates    = implode(', ', array_map(function ($qc) {
        return "$qc = VALUES($qc)";
    }, $quotedCols));
    $sql = 'INSERT INTO `users` (' . implode(', ', $quotedCols) . ') VALUES (' . $placeholders . ')
            ON DUPLICATE KEY UPDATE ' . $updates;
    $stmt = $db->prepare($sql);
    $stmt->execute(array_values($fields));

    $stmt = $db->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$fields['id']]);
    return $stmt->fetch();
}
