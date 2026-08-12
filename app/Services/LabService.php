<?php

namespace App\Services;

use App\Repositories\LabRepository;
use InvalidArgumentException;

class LabService
{
    /** @var LabRepository */
    private $labs;

    public function __construct(LabRepository $labs = null)
    {
        $this->labs = $labs !== null ? $labs : new LabRepository();
    }

    public function all()
    {
        return array_map('lab_to_array', $this->labs->all());
    }

    public function save(array $item)
    {
        if (empty($item['id']) || empty($item['name'])) {
            throw new InvalidArgumentException('Campos obrigatórios ausentes: id, name.');
        }

        return lab_to_array($this->labs->save([
            'id' => $item['id'],
            'name' => $item['name'],
            'location' => isset($item['location']) ? $item['location'] : null,
        ]));
    }

    public function delete($id)
    {
        if (!$id) {
            throw new InvalidArgumentException('ID não informado.');
        }

        $this->labs->delete($id);
    }
}
