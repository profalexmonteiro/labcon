<?php

namespace App\Support;

final class Response
{
    public static function json(array $data, $status = 200)
    {
        json_response($data, $status);
    }

    public static function error($message, $status = 400)
    {
        json_error($message, $status);
    }
}
