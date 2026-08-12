<?php

namespace App\Controllers;

use App\Services\LabService;
use App\Support\Request;
use App\Support\Response;
use InvalidArgumentException;

class LabController
{
    /** @var LabService */
    private $labs;

    public function __construct(LabService $labs = null)
    {
        $this->labs = $labs !== null ? $labs : new LabService();
    }

    public function handle(Request $request)
    {
        $caller = require_auth();

        try {
            if ($request->method() === 'GET') {
                Response::json($this->labs->all());
            }

            if ($request->method() === 'POST' || $request->method() === 'PUT') {
                if (!in_array(isset($caller['role']) ? $caller['role'] : '', ['professor', 'tecnico', 'administrador'], true)) {
                    Response::error('Sem permissão para gerenciar laboratórios.', 403);
                }
                Response::json(['success' => true, 'item' => $this->labs->save($request->body())]);
            }

            if ($request->method() === 'DELETE') {
                if (!in_array(isset($caller['role']) ? $caller['role'] : '', ['professor', 'tecnico', 'administrador'], true)) {
                    Response::error('Sem permissão para excluir laboratórios.', 403);
                }
                $this->labs->delete((string) $request->query('id', ''));
                Response::json(['success' => true]);
            }
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage());
        }

        Response::error('Método não permitido.', 405);
    }
}
