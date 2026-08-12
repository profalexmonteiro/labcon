<?php

namespace App\Controllers;

use App\Services\ReservationService;
use App\Support\Request;
use App\Support\Response;
use Exception;
use InvalidArgumentException;
use RuntimeException;

class ReservationController
{
    /** @var ReservationService */
    private $reservations;

    public function __construct(ReservationService $reservations = null)
    {
        $this->reservations = $reservations !== null ? $reservations : new ReservationService();
    }

    public function handle(Request $request)
    {
        $caller = require_auth();
        $callerRole = isset($caller['role']) ? $caller['role'] : '';
        $callerId   = isset($caller['id']) ? $caller['id'] : '';
        $canManageOthers = in_array($callerRole, ['professor', 'tecnico', 'administrador'], true);

        try {
            if ($request->method() === 'GET') {
                Response::json($this->reservations->all());
            }

            if ($request->method() === 'POST') {
                $body  = $request->body();
                $items = isset($body['items']) ? $body['items'] : [$body];

                if (!$canManageOthers) {
                    foreach ($items as $item) {
                        if ((isset($item['userId']) ? $item['userId'] : '') !== $callerId) {
                            Response::error('Sem permissão para reservar em nome de outro usuário.', 403);
                        }
                    }
                }

                $saved = $this->reservations->saveMany($items, $callerId, $canManageOthers);

                if (count($saved) === 1) {
                    Response::json(['success' => true, 'item' => $saved[0], 'items' => $saved]);
                }

                Response::json(['success' => true, 'items' => $saved]);
            }

            if ($request->method() === 'PUT') {
                $body = $request->body();
                if (!$canManageOthers && (isset($body['userId']) ? $body['userId'] : '') !== $callerId) {
                    Response::error('Sem permissão para alterar reserva de outro usuário.', 403);
                }
                Response::json(['success' => true, 'item' => $this->reservations->saveOne($body, $callerId, $canManageOthers)]);
            }

            if ($request->method() === 'DELETE') {
                $id = (string) $request->query('id', '');
                if (!$canManageOthers) {
                    $this->reservations->deleteOwned($id, $callerId);
                } else {
                    $this->reservations->delete($id);
                }
                Response::json(['success' => true]);
            }
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage());
        } catch (RuntimeException $e) {
            Response::error($e->getMessage());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }

        Response::error('Método não permitido.', 405);
    }
}
