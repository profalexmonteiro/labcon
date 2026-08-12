<?php

namespace App\Services;

use App\Repositories\DeskRepository;
use App\Repositories\LabRepository;
use App\Repositories\ReservationRepository;
use App\Repositories\UserRepository;

/**
 * Agrega o estado completo da aplicação (usuários, laboratórios, mesas e
 * reservas) usado pelo painel administrativo, e oferece as operações
 * administrativas de manutenção de dados: limpar tudo ou popular com
 * dados de exemplo.
 */
class StateService
{
    /** @var UserRepository */
    private $users;
    /** @var LabRepository */
    private $labs;
    /** @var DeskRepository */
    private $desks;
    /** @var ReservationRepository */
    private $reservations;

    public function __construct(
        UserRepository $users = null,
        LabRepository $labs = null,
        DeskRepository $desks = null,
        ReservationRepository $reservations = null
    ) {
        $this->users = $users !== null ? $users : new UserRepository();
        $this->labs = $labs !== null ? $labs : new LabRepository();
        $this->desks = $desks !== null ? $desks : new DeskRepository();
        $this->reservations = $reservations !== null ? $reservations : new ReservationRepository();
    }

    /** @return array Snapshot completo do estado, no formato consumido pelo front-end. */
    public function all()
    {
        return [
            'users' => array_map('user_to_array', $this->users->all()),
            'labs' => array_map('lab_to_array', $this->labs->all()),
            'desks' => array_map('desk_to_array', $this->desks->all()),
            'reservations' => array_map('reservation_to_array', $this->reservations->all()),
        ];
    }

    /**
     * Remove todos os dados de todas as entidades. A ordem (reservas →
     * mesas → laboratórios → usuários) respeita as dependências de chave
     * estrangeira do schema, evitando erros de FK mesmo que o banco não
     * tenha `ON DELETE CASCADE` configurado para alguma delas.
     */
    public function clear()
    {
        $this->reservations->deleteAll();
        $this->desks->deleteAll();
        $this->labs->deleteAll();
        $this->users->deleteAll();
    }

    /**
     * Popula a base com um laboratório, dois professores e 16 mesas de
     * exemplo — usado para demonstração/testes manuais, acionado pela
     * interface administrativa (`action=seed`).
     */
    public function seed()
    {
        $labId = 'lab-' . bin2hex(random_bytes(6));
        $this->labs->save([
            'id' => $labId,
            'name' => 'ETSS',
            'location' => 'Laboratório ETSS',
        ]);

        foreach ([
            ['id' => 'user-' . bin2hex(random_bytes(5)), 'name' => 'Eduardo Souto', 'role' => 'professor'],
            ['id' => 'user-' . bin2hex(random_bytes(5)), 'name' => 'Eduardo Feitosa', 'role' => 'professor'],
        ] as $professor) {
            $this->users->save($professor + ['source' => 'manual']);
        }

        foreach (str_split('ABCDEFGHIJKLMNOP') as $letter) {
            $this->desks->save([
                'id' => 'desk-' . bin2hex(random_bytes(5)),
                'lab_id' => $labId,
                'name' => "Baia $letter",
            ]);
        }
    }
}
