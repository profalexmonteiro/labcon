<?php

namespace App\Services;

use App\Repositories\DeskRepository;
use InvalidArgumentException;

/** Regras de negócio de mesas: validação de campos e delegação ao repositório. */
class DeskService
{
    /** @var DeskRepository */
    private $desks;

    public function __construct(DeskRepository $desks = null)
    {
        $this->desks = $desks !== null ? $desks : new DeskRepository();
    }

    /** @return array Todas as mesas, no formato da API. */
    public function all()
    {
        return array_map('desk_to_array', $this->desks->all());
    }

    /**
     * Valida e persiste (insere ou atualiza) uma mesa.
     *
     * @throws InvalidArgumentException Quando id, labId ou name estão ausentes.
     */
    public function save(array $item)
    {
        if (empty($item['id']) || empty($item['labId']) || empty($item['name'])) {
            throw new InvalidArgumentException('Campos obrigatórios ausentes: id, labId, name.');
        }

        return desk_to_array($this->desks->save([
            'id' => $item['id'],
            'lab_id' => $item['labId'],
            'name' => $item['name'],
        ]));
    }

    /** @throws InvalidArgumentException Quando o id não é informado. */
    public function delete($id)
    {
        if (!$id) {
            throw new InvalidArgumentException('ID não informado.');
        }

        $this->desks->delete($id);
    }
}
