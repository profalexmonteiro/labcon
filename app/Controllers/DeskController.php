<?php

namespace App\Controllers;

use App\Services\DeskService;
use App\Support\Request;
use App\Support\Response;
use InvalidArgumentException;

class DeskController
{
    /** @var DeskService */
    private $desks;

    public function __construct(DeskService $desks = null)
    {
        $this->desks = $desks !== null ? $desks : new DeskService();
    }

    public function handle(Request $request)
    {
        $caller = require_auth();

        try {
            if ($request->method() === 'GET') {
                Response::json($this->desks->all());
            }

            if ($request->method() === 'POST' || $request->method() === 'PUT') {
                if (!in_array(isset($caller['role']) ? $caller['role'] : '', ['professor', 'tecnico', 'administrador'], true)) {
                    Response::error('Sem permissão para gerenciar mesas.', 403);
                }
                Response::json(['success' => true, 'item' => $this->desks->save($request->body())]);
            }

            if ($request->method() === 'DELETE') {
                if (!in_array(isset($caller['role']) ? $caller['role'] : '', ['professor', 'tecnico', 'administrador'], true)) {
                    Response::error('Sem permissão para excluir mesas.', 403);
                }
                $this->desks->delete((string) $request->query('id', ''));
                Response::json(['success' => true]);
            }
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage());
        }

        Response::error('Método não permitido.', 405);
    }
}
