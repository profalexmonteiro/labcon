<?php

namespace App\Controllers;

use App\Services\UserService;
use App\Support\Request;
use App\Support\Response;
use InvalidArgumentException;

/**
 * Endpoint `api/users.php`: CRUD de usuários.
 *
 * Regras de autorização aplicadas aqui (antes de delegar a UserService):
 * qualquer usuário autenticado pode listar; editar exige ser o próprio
 * usuário ou um administrador (e só administrador pode alterar `role`);
 * excluir é restrito a administradores.
 */
class UserController
{
    /** @var UserService */
    private $users;

    public function __construct(UserService $users = null)
    {
        $this->users = $users !== null ? $users : new UserService();
    }

    public function handle(Request $request)
    {
        $caller = require_auth();

        try {
            if ($request->method() === 'GET') {
                Response::json($this->users->all());
            }

            if ($request->method() === 'POST' || $request->method() === 'PUT') {
                $body      = $request->body();
                $targetId  = isset($body['id']) ? $body['id'] : '';
                $callerRole = isset($caller['role']) ? $caller['role'] : '';

                // Não-admins só podem editar o próprio cadastro e não podem alterar role
                if ($callerRole !== 'administrador') {
                    if ($targetId !== (isset($caller['id']) ? $caller['id'] : '')) {
                        Response::error('Sem permissão para alterar outro usuário.', 403);
                    }
                    unset($body['role']);
                }

                Response::json(['success' => true, 'item' => $this->users->save($body)]);
            }

            if ($request->method() === 'DELETE') {
                if ((isset($caller['role']) ? $caller['role'] : '') !== 'administrador') {
                    Response::error('Apenas o administrador pode excluir usuários.', 403);
                }
                $this->users->delete((string) $request->query('id', ''));
                Response::json(['success' => true]);
            }
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage());
        }

        Response::error('Método não permitido.', 405);
    }
}
