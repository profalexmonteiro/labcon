<?php

namespace App\Services;

use App\Repositories\ReservationRepository;
use Exception;
use InvalidArgumentException;
use RuntimeException;

/**
 * Regras de negócio de reservas: validação, checagem de conflito de
 * horário/mesa e autorização por dono da reserva (aluno só edita/exclui
 * as próprias; professor/técnico/administrador podem gerenciar de todos).
 */
class ReservationService
{
    /** @var ReservationRepository */
    private $reservations;

    public function __construct(ReservationRepository $reservations = null)
    {
        $this->reservations = $reservations !== null ? $reservations : new ReservationRepository();
    }

    /** @return array Todas as reservas, no formato da API. */
    public function all()
    {
        return array_map('reservation_to_array', $this->reservations->all());
    }

    /**
     * Valida, autoriza e persiste uma única reserva.
     *
     * @param array  $item            Reserva no formato da API (camelCase).
     * @param string $callerId        Id do usuário autenticado que fez a requisição.
     * @param bool   $canManageOthers Se true, ignora a checagem de dono (professor/técnico/admin).
     * @throws InvalidArgumentException Em campos obrigatórios ausentes.
     * @throws RuntimeException Em falta de permissão ou conflito de horário.
     */
    public function saveOne(array $item, $callerId, $canManageOthers)
    {
        $this->validate($item);
        $this->assertWritable($item['id'], $callerId, $canManageOthers);

        if ($this->reservations->hasConflict($item)) {
            throw new RuntimeException('Já existe reserva nessa mesa para esse dia e faixa de horário.');
        }

        return reservation_to_array($this->reservations->save($this->toFields($item)));
    }

    /**
     * Salva um lote de reservas dentro de uma única transação: se qualquer
     * item falhar validação, autorização ou checagem de conflito, todo o
     * lote é revertido (`rollBack`) — evita salvar parcialmente uma edição
     * em lote feita pelo front-end (ex.: grade semanal de reservas).
     *
     * @throws Exception Repropaga a exceção do primeiro item que falhar.
     */
    public function saveMany(array $items, $callerId, $canManageOthers)
    {
        $db = get_db();
        $saved = [];

        $db->beginTransaction();
        try {
            foreach ($items as $item) {
                $this->validate($item);
                $this->assertWritable($item['id'], $callerId, $canManageOthers);

                if ($this->reservations->hasConflict($item)) {
                    throw new RuntimeException("Conflito de horário: mesa {$item['deskId']} já reservada em {$item['day']} {$item['start']}-{$item['end']}.");
                }

                $saved[] = reservation_to_array($this->reservations->save($this->toFields($item)));
            }
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }

        return $saved;
    }

    /**
     * Remove uma reserva sem checagem de dono — reservado para chamadores
     * que já possuem privilégio de gestão (verificado no Controller).
     *
     * @throws InvalidArgumentException Quando o id não é informado.
     */
    public function delete($id)
    {
        if (!$id) {
            throw new InvalidArgumentException('ID não informado.');
        }

        $this->reservations->delete($id);
    }

    /**
     * Remove uma reserva, mas apenas se pertencer ao próprio usuário —
     * usada quando o chamador não tem privilégio de gestão de terceiros.
     *
     * @throws InvalidArgumentException Quando o id não é informado ou a reserva não existe.
     * @throws RuntimeException Quando a reserva pertence a outro usuário.
     */
    public function deleteOwned($id, $userId)
    {
        if (!$id) {
            throw new InvalidArgumentException('ID não informado.');
        }

        $row = $this->reservations->find($id);
        if (!$row) {
            throw new InvalidArgumentException('Reserva não encontrada.');
        }
        if ($row['user_id'] !== $userId) {
            throw new RuntimeException('Sem permissão para excluir esta reserva.');
        }

        $this->reservations->delete($id);
    }

    /**
     * O save() do repositório é um upsert: sem esta checagem, um usuário sem
     * privilégio de gestão poderia enviar o id de uma reserva alheia já
     * existente (visível via GET) e, informando o próprio userId, sequestrar
     * ou sobrescrever a reserva de outra pessoa (IDOR).
     */
    private function assertWritable($id, $callerId, $canManageOthers)
    {
        if ($canManageOthers) {
            return;
        }

        $existing = $this->reservations->find($id);
        if ($existing && $existing['user_id'] !== $callerId) {
            throw new RuntimeException('Sem permissão para alterar reserva de outro usuário.');
        }
    }

    /** @throws InvalidArgumentException Quando algum campo obrigatório da reserva está ausente. */
    private function validate(array $item)
    {
        if (empty($item['id']) || empty($item['userId']) || empty($item['labId'])
            || empty($item['deskId']) || empty($item['day'])
            || empty($item['start']) || empty($item['end'])) {
            throw new InvalidArgumentException('Campos obrigatórios ausentes na reserva.');
        }
    }

    /** Converte a reserva do formato da API (camelCase) para colunas do banco (snake_case). */
    private function toFields(array $item)
    {
        return [
            'id' => $item['id'],
            'user_id' => $item['userId'],
            'lab_id' => $item['labId'],
            'desk_id' => $item['deskId'],
            'day' => $item['day'],
            'start_time' => $item['start'],
            'end_time' => $item['end'],
        ];
    }
}
