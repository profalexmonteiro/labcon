<?php

namespace App\Repositories;

class DeskRepository extends BaseRepository
{
    public function all()
    {
        return $this->db->query('SELECT * FROM desks ORDER BY name')->fetchAll();
    }

    public function find($id)
    {
        $stmt = $this->db->prepare('SELECT * FROM desks WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function save(array $fields)
    {
        $this->upsert('desks', $fields);

        return $this->find($fields['id']);
    }

    public function delete($id)
    {
        $this->db->prepare('DELETE FROM desks WHERE id = ?')->execute([$id]);
    }

    public function deleteAll()
    {
        $this->db->exec('DELETE FROM desks');
    }
}
