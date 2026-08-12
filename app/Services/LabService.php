<?php

namespace App\Services;

use App\Repositories\LabRepository;
use InvalidArgumentException;

/** Regras de negócio de laboratórios: validação de campos e delegação ao repositório. */
class LabService
{
    /** @var LabRepository */
    private $labs;

    public function __construct(LabRepository $labs = null)
    {
        $this->labs = $labs !== null ? $labs : new LabRepository();
    }

    /** @return array Todos os laboratórios, no formato da API. */
    public function all()
    {
        return array_map('lab_to_array', $this->labs->all());
    }

    /**
     * Valida e persiste (insere ou atualiza) um laboratório.
     *
     * @throws InvalidArgumentException Quando id ou name estão ausentes.
     */
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

    /** @throws InvalidArgumentException Quando o id não é informado. */
    public function delete($id)
    {
        if (!$id) {
            throw new InvalidArgumentException('ID não informado.');
        }

        $this->labs->delete($id);
    }
}
