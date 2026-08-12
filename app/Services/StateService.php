<?php

namespace App\Services;

use App\Repositories\DeskRepository;
use App\Repositories\LabRepository;
use App\Repositories\ReservationRepository;
use App\Repositories\UserRepository;

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

    public function all()
    {
        return [
            'users' => array_map('user_to_array', $this->users->all()),
            'labs' => array_map('lab_to_array', $this->labs->all()),
            'desks' => array_map('desk_to_array', $this->desks->all()),
            'reservations' => array_map('reservation_to_array', $this->reservations->all()),
        ];
    }

    public function clear()
    {
        $this->reservations->deleteAll();
        $this->desks->deleteAll();
        $this->labs->deleteAll();
        $this->users->deleteAll();
    }

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
