<?php

namespace App\Repositories;

/** Acesso direto à tabela `desks` (mesas de laboratório). */
class DeskRepository extends BaseRepository
{
    /** @return array Todas as mesas, ordenadas por nome. */
    public function all()
    {
        return $this->db->query('SELECT * FROM desks ORDER BY name')->fetchAll();
    }

    /** @return array|null Mesa pelo id, ou null se não encontrada. */
    public function find($id)
    {
        $stmt = $this->db->prepare('SELECT * FROM desks WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    /** Insere ou atualiza uma mesa e retorna o registro resultante. */
    public function save(array $fields)
    {
        $this->upsert('desks', $fields);

        return $this->find($fields['id']);
    }

    /**
     * Remove uma mesa. As reservas associadas são removidas em cascata
     * pelo banco (FK `ON DELETE CASCADE`), sem necessidade de limpeza manual.
     */
    public function delete($id)
    {
        $this->db->prepare('DELETE FROM desks WHERE id = ?')->execute([$id]);
    }

    /** Remove todas as mesas (usado pela limpeza de dados administrativa). */
    public function deleteAll()
    {
        $this->db->exec('DELETE FROM desks');
    }
}
