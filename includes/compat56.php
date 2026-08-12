<?php
/**
 * Polyfills for functions introduced after PHP 5.6 that this codebase relies on.
 * Required because the target runtime is PHP 5.6.40.
 */

if (!function_exists('random_bytes')) {
    function random_bytes($length) {
        $length = (int) $length;
        if ($length < 1) {
            throw new InvalidArgumentException('Length must be a positive integer.');
        }

        if (function_exists('openssl_random_pseudo_bytes')) {
            $strong = false;
            $bytes = openssl_random_pseudo_bytes($length, $strong);
            if ($bytes !== false && $strong) {
                return $bytes;
            }
        }

        if (function_exists('mcrypt_create_iv')) {
            $bytes = mcrypt_create_iv($length, MCRYPT_DEV_URANDOM);
            if ($bytes !== false && strlen($bytes) === $length) {
                return $bytes;
            }
        }

        $handle = @fopen('/dev/urandom', 'rb');
        if ($handle !== false) {
            $bytes = fread($handle, $length);
            fclose($handle);
            if ($bytes !== false && strlen($bytes) === $length) {
                return $bytes;
            }
        }

        throw new RuntimeException('Unable to generate random bytes.');
    }
}

if (!function_exists('random_int')) {
    function random_int($min, $max) {
        $min = (int) $min;
        $max = (int) $max;
        if ($min > $max) {
            throw new InvalidArgumentException('Minimum value must be less than or equal to the maximum value.');
        }

        $range = $max - $min;
        if ($range === 0) {
            return $min;
        }

        $bytes = (int) ceil((strlen(decbin($range)) + 1) / 8);
        $mask = (1 << (int) ceil(log($range + 1, 2))) - 1;

        do {
            $randomBytes = random_bytes($bytes);
            $value = 0;
            for ($i = 0; $i < $bytes; $i++) {
                $value = ($value << 8) | ord($randomBytes[$i]);
            }
            $value &= $mask;
        } while ($value > $range);

        return $min + $value;
    }
}

if (!function_exists('str_contains')) {
    function str_contains($haystack, $needle) {
        if ($needle === '') {
            return true;
        }
        return strpos($haystack, $needle) !== false;
    }
}

if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle) {
        if ($needle === '') {
            return true;
        }
        return strncmp($haystack, $needle, strlen($needle)) === 0;
    }
}

if (!function_exists('str_ends_with')) {
    function str_ends_with($haystack, $needle) {
        if ($needle === '') {
            return true;
        }
        $needleLength = strlen($needle);
        if ($needleLength > strlen($haystack)) {
            return false;
        }
        return substr_compare($haystack, $needle, -$needleLength) === 0;
    }
}
