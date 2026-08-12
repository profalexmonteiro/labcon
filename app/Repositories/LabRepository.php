<?php

namespace App\Repositories;

class LabRepository extends BaseRepository
{
    public function all()
    {
        return $this->db->query('SELECT * FROM labs ORDER BY name')->fetchAll();
    }

    public function find($id)
    {
        $stmt = $this->db->prepare('SELECT * FROM labs WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function save(array $fields)
    {
        $this->upsert('labs', $fields);

        return $this->find($fields['id']);
    }

    public function delete($id)
    {
        $this->db->prepare('DELETE FROM labs WHERE id = ?')->execute([$id]);
    }

    public function deleteAll()
    {
        $this->db->exec('DELETE FROM labs');
    }
}
