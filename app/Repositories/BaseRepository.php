<?php

namespace App\Repositories;

use PDO;

/**
 * Base para todos os Repositories: fornece a conexão PDO e o utilitário
 * genérico de upsert. Por convenção da camada (ver README, seção
 * "Regras de camada"), todo SQL da aplicação deve ficar concentrado em
 * classes que estendem esta — Services e Controllers não devem montar SQL.
 */
abstract class BaseRepository
{
    /** @var PDO */
    protected $db;

    /**
     * @param PDO|null $db Conexão a usar; quando omitida, usa a conexão
     *                     compartilhada de get_db() (includes/db.php).
     */
    public function __construct(PDO $db = null)
    {
        $this->db = $db !== null ? $db : get_db();
    }

    /**
     * Insere um registro ou atualiza-o caso a chave primária/única já
     * exista (`INSERT ... ON DUPLICATE KEY UPDATE`). Os nomes de tabela e
     * de colunas são escapados com backticks (permitindo identificadores
     * dinâmicos), enquanto os valores são sempre enviados via placeholders
     * — nunca concatenados na SQL — o que evita SQL injection.
     *
     * @param string $table  Nome da tabela.
     * @param array  $fields Colunas => valores a inserir/atualizar.
     */
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
