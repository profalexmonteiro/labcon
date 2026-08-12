<?php

namespace App\Repositories;

class ReservationRepository extends BaseRepository
{
    public function all()
    {
        return $this->db->query('SELECT * FROM reservations ORDER BY day, start_time')->fetchAll();
    }

    public function find($id)
    {
        $stmt = $this->db->prepare('SELECT * FROM reservations WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function hasConflict(array $item)
    {
        $stmt = $this->db->prepare(
            'SELECT id FROM reservations
             WHERE desk_id = ? AND day = ? AND id != ?
               AND start_time < ? AND end_time > ?'
        );
        $stmt->execute([$item['deskId'], $item['day'], $item['id'], $item['end'], $item['start']]);

        return (bool) $stmt->fetch();
    }

    public function save(array $fields)
    {
        $this->upsert('reservations', $fields);

        return $this->find($fields['id']);
    }

    public function delete($id)
    {
        $this->db->prepare('DELETE FROM reservations WHERE id = ?')->execute([$id]);
    }

    public function deleteAll()
    {
        $this->db->exec('DELETE FROM reservations');
    }
}
