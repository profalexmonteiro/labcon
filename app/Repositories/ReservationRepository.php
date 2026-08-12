<?php

namespace App\Repositories;

/** Acesso direto à tabela `reservations` (reservas de mesa por dia/horário). */
class ReservationRepository extends BaseRepository
{
    /** @return array Todas as reservas, ordenadas por dia e horário de início. */
    public function all()
    {
        return $this->db->query('SELECT * FROM reservations ORDER BY day, start_time')->fetchAll();
    }

    /** @return array|null Reserva pelo id, ou null se não encontrada. */
    public function find($id)
    {
        $stmt = $this->db->prepare('SELECT * FROM reservations WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    /**
     * Verifica se `$item` colide com alguma reserva já existente na mesma
     * mesa e dia. Dois intervalos [start, end) colidem quando um começa
     * antes do outro terminar E termina depois do outro começar — daí a
     * condição `start_time < end AND end_time > start`. O próprio registro
     * (`id != ?`) é excluído da checagem para permitir editar uma reserva
     * sem que ela conflite com si mesma.
     *
     * @param array $item Deve conter 'deskId', 'day', 'id', 'start', 'end'.
     * @return bool
     */
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

    /** Insere ou atualiza uma reserva e retorna o registro resultante. */
    public function save(array $fields)
    {
        $this->upsert('reservations', $fields);

        return $this->find($fields['id']);
    }

    /** Remove uma reserva pelo id. */
    public function delete($id)
    {
        $this->db->prepare('DELETE FROM reservations WHERE id = ?')->execute([$id]);
    }

    /** Remove todas as reservas (usado pela limpeza de dados administrativa). */
    public function deleteAll()
    {
        $this->db->exec('DELETE FROM reservations');
    }
}
