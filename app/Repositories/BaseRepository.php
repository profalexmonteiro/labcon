<?php

namespace App\Repositories;

use PDO;

abstract class BaseRepository
{
    /** @var PDO */
    protected $db;

    public function __construct(PDO $db = null)
    {
        $this->db = $db !== null ? $db : get_db();
    }

    protected function upsert($table, array $fields)
    {
        $cols         = array_keys($fields);
        $quotedCols   = array_map(function ($c) {
            return '`' . str_replace('`', '``', $c) . '`';
        }, $cols);
        $placeholders = implode(', ', array_fill(0, count($fields), '?'));
        $updates      = implode(', ', array_map(
            function ($qc) {
                return "$qc = VALUES($qc)";
            },
            $quotedCols
        ));

        $sql = 'INSERT INTO `' . str_replace('`', '``', $table) . '`'
             . ' (' . implode(', ', $quotedCols) . ') VALUES (' . $placeholders . ')'
             . ' ON DUPLICATE KEY UPDATE ' . $updates;

        $this->db->prepare($sql)->execute(array_values($fields));
    }
}
