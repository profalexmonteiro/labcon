<?php

function json_response(array $data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error($message, $status = 400) {
    json_response(['success' => false, 'error' => $message], $status);
}

function get_json_body() {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

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

function lab_to_array(array $row) {
    return [
        'id'       => $row['id'],
        'name'     => $row['name'],
        'location' => isset($row['location']) ? $row['location'] : '',
    ];
}

function desk_to_array(array $row) {
    return [
        'id'    => $row['id'],
        'labId' => $row['lab_id'],
        'name'  => $row['name'],
    ];
}

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
