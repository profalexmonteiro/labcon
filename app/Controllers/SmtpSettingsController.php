<?php

namespace App\Controllers;

use App\Services\SmtpMailer;
use App\Services\SmtpSettingsService;
use App\Support\Request;
use App\Support\Response;
use InvalidArgumentException;
use RuntimeException;

/**
 * Endpoint `api/smtp.php`: leitura e gravação das configurações de SMTP,
 * e envio de um e-mail de teste (`action=test`). Restrito a administradores.
 */
class SmtpSettingsController
{
    /** @var SmtpSettingsService */
    private $smtp;

    public function __construct(SmtpSettingsService $smtp = null)
    {
        $this->smtp = $smtp !== null ? $smtp : new SmtpSettingsService();
    }

    public function handle(Request $request)
    {
        $user = require_auth();
        if ((isset($user['role']) ? $user['role'] : '') !== 'administrador') {
            Response::error('Acesso restrito ao administrador.', 403);
        }

        try {
            if ($request->method() === 'GET') {
                Response::json(['success' => true, 'settings' => $this->smtp->get()]);
            }

            if ($request->method() === 'POST') {
                $body = $request->body();
                if ((isset($body['action']) ? $body['action'] : '') === 'test') {
                    $settings = $this->smtp->get(true);
                    $to = isset($body['to']) ? $body['to'] : (isset($settings['fromEmail']) ? $settings['fromEmail'] : '');
                    $to = trim($to);
                    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
                        throw new InvalidArgumentException('Informe um e-mail de teste valido.');
                    }
                    (new SmtpMailer($settings))->send(
                        $to,
                        'Teste SMTP',
                        APP_NAME . ' - teste SMTP',
                        '<p>Configuracao SMTP validada com sucesso.</p>',
                        'Configuracao SMTP validada com sucesso.'
                    );
                    Response::json(['success' => true]);
                }

                Response::json(['success' => true, 'settings' => $this->smtp->save($body)]);
            }
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage());
        } catch (RuntimeException $e) {
            Response::error($e->getMessage(), 500);
        }

        Response::error('Metodo nao permitido.', 405);
    }
}
