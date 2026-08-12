<?php

namespace App\Support;

/**
 * Wrapper leve sobre as superglobais da requisição HTTP atual.
 *
 * Os Controllers dependem desta classe (em vez de ler $_SERVER/$_GET
 * diretamente) para manter a interpretação de HTTP isolada em um único
 * lugar e facilitar testes/mocks futuros.
 */
final class Request
{
    /** @return string Método HTTP da requisição (ex.: 'GET', 'POST'). */
    public function method()
    {
        return isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
    }

    /** @return array Corpo da requisição decodificado como JSON (ver includes/functions.php). */
    public function body()
    {
        return get_json_body();
    }

    /**
     * @param string $key     Nome do parâmetro de query string.
     * @param mixed  $default Valor retornado quando o parâmetro não existe.
     * @return mixed
     */
    public function query($key, $default = null)
    {
        return isset($_GET[$key]) ? $_GET[$key] : $default;
    }
}
