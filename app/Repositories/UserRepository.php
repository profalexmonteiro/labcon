<?php

namespace App\Repositories;

class UserRepository extends BaseRepository
{
    public function all()
    {
        return $this->db->query('SELECT * FROM users ORDER BY name')->fetchAll();
    }

    public function find($id)
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function findByEmail($email)
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function save(array $fields)
    {
        $this->upsert('users', $fields);

        return $this->find($fields['id']);
    }

    public function delete($id)
    {
        $this->db->prepare('UPDATE users SET advisor_id = NULL, advisor_name = NULL WHERE advisor_id = ?')->execute([$id]);
        $this->db->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
    }

    public function deleteAll()
    {
        $this->db->exec('DELETE FROM users');
    }
}
