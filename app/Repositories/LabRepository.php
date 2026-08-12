<?php

namespace App\Repositories;

/** Acesso direto à tabela `labs` (laboratórios). */
class LabRepository extends BaseRepository
{
    /** @return array Todos os laboratórios, ordenados por nome. */
    public function all()
    {
        return $this->db->query('SELECT * FROM labs ORDER BY name')->fetchAll();
    }

    /** @return array|null Laboratório pelo id, ou null se não encontrado. */
    public function find($id)
    {
        $stmt = $this->db->prepare('SELECT * FROM labs WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    /** Insere ou atualiza um laboratório e retorna o registro resultante. */
    public function save(array $fields)
    {
        $this->upsert('labs', $fields);

        return $this->find($fields['id']);
    }

    /**
     * Remove um laboratório. As mesas e reservas associadas são removidas
     * em cascata pelo banco (FK `ON DELETE CASCADE` definida em
     * includes/install.php), então não é necessário limpá-las aqui.
     */
    public function delete($id)
    {
        $this->db->prepare('DELETE FROM labs WHERE id = ?')->execute([$id]);
    }

    /** Remove todos os laboratórios (usado pela limpeza de dados administrativa). */
    public function deleteAll()
    {
        $this->db->exec('DELETE FROM labs');
    }
}
