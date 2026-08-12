<?php

namespace App\Support;

final class Request
{
    public function method()
    {
        return isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
    }

    public function body()
    {
        return get_json_body();
    }

    public function query($key, $default = null)
    {
        return isset($_GET[$key]) ? $_GET[$key] : $default;
    }
}
