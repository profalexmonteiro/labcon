<?php

namespace App\Support;

/**
 * Fachada estática para envio de respostas HTTP em JSON a partir dos
 * Controllers, delegando para os helpers globais em includes/functions.php.
 * Ambos os métodos finalizam a execução do script (exit).
 */
final class Response
{
    /**
     * Envia uma resposta de sucesso/dados em JSON.
     *
     * @param array $data   Corpo da resposta.
     * @param int   $status Código HTTP (padrão 200).
     */
    public static function json(array $data, $status = 200)
    {
        json_response($data, $status);
    }

    /**
     * Envia uma resposta de erro padronizada `{success:false, error:...}`.
     *
     * @param string $message Mensagem de erro amigável.
     * @param int    $status  Código HTTP (padrão 400).
     */
    public static function error($message, $status = 400)
    {
        json_error($message, $status);
    }
}
