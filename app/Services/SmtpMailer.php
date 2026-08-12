<?php

namespace App\Services;

use RuntimeException;

class SmtpMailer
{
    /** @var array */
    private $settings;
    /** @var resource|null */
    private $socket = null;

    public function __construct(array $settings)
    {
        $this->settings = $settings;
    }

    public function send($toEmail, $toName, $subject, $htmlBody, $textBody)
    {
        if (empty($this->settings['enabled'])) {
            throw new RuntimeException('SMTP nao configurado.');
        }

        $host = $this->settings['host'];
        // Conecta pelo IP já validado (não pelo hostname) para eliminar a
        // janela de DNS rebinding entre a checagem e a conexão; o hostname
        // original ainda é usado como SNI/peer_name para a verificação do
        // certificado TLS continuar correta.
        $ip = $this->validateSmtpHost($host);

        $port   = (int) $this->settings['port'];
        $scheme = $this->settings['encryption'] === 'ssl' ? 'ssl://' : '';
        $target = ($ip[0] === '[' || strpos($ip, ':') === false) ? $ip : ('[' . $ip . ']');
        $context = stream_context_create([
            'ssl' => [
                'peer_name'         => $host,
                'verify_peer'       => true,
                'verify_peer_name'  => true,
            ],
        ]);
        $this->socket = @stream_socket_client($scheme . $target . ':' . $port, $errno, $errstr, 20, STREAM_CLIENT_CONNECT, $context);
        if (!$this->socket) {
            throw new RuntimeException('Nao foi possivel conectar ao SMTP: ' . $errstr);
        }
        stream_set_timeout($this->socket, 20);

        $this->expect([220]);
        $server = isset($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : 'localhost';
        $this->command('EHLO ' . $server, [250]);

        if ($this->settings['encryption'] === 'tls') {
            $this->command('STARTTLS', [220]);
            if (!stream_socket_enable_crypto($this->socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('Falha ao iniciar TLS no SMTP.');
            }
            $this->command('EHLO ' . $server, [250]);
        }

        $fromEmail = $this->sanitizeSmtpAddress($this->settings['fromEmail']);
        $toEmail   = $this->sanitizeSmtpAddress($toEmail);

        $this->command('AUTH LOGIN', [334]);
        $this->command(base64_encode($this->settings['username']), [334]);
        $this->command(base64_encode($this->settings['password']), [235]);
        $this->command('MAIL FROM:<' . $fromEmail . '>', [250]);
        $this->command('RCPT TO:<' . $toEmail . '>', [250, 251]);
        $this->command('DATA', [354]);

        $message = $this->buildMessage($toEmail, $toName, $subject, $htmlBody, $textBody);
        fwrite($this->socket, $message . "\r\n.\r\n");
        $this->expect([250]);
        $this->command('QUIT', [221]);
        fclose($this->socket);
    }

    /**
     * Validar apenas a string do host (como era feito antes) é insuficiente:
     * um host público qualquer (ex.: "smtp.atacante.com") pode ter seu DNS
     * apontado para 127.0.0.1 ou para o endereço de metadados de nuvem
     * (169.254.169.254) — ataque de SSRF via DNS rebinding — e passaria
     * ileso por uma checagem baseada só no texto do hostname. Por isso
     * resolvemos o host e validamos o(s) IP(s) reais antes de conectar, e a
     * conexão em si é feita nesse IP já validado (ver send()).
     *
     * @return string IP validado para uso na conexão
     */
    private function validateSmtpHost($host)
    {
        $host = trim($host);
        if ($host === '') {
            throw new RuntimeException('Host SMTP não configurado.');
        }
        if (strtolower($host) === 'localhost') {
            throw new RuntimeException('Host SMTP inválido.');
        }

        $ips = $this->resolveHostIps($host);
        if (empty($ips)) {
            throw new RuntimeException('Não foi possível resolver o host SMTP.');
        }

        foreach ($ips as $ip) {
            $public = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
            if ($public === false) {
                throw new RuntimeException('Host SMTP inválido.');
            }
        }

        return $ips[0];
    }

    private function resolveHostIps($host)
    {
        if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
            return [$host];
        }

        $ips = [];
        $ipv4 = @gethostbynamel($host);
        if (is_array($ipv4)) {
            $ips = array_merge($ips, $ipv4);
        }
        if (function_exists('dns_get_record')) {
            $aaaa = @dns_get_record($host, DNS_AAAA);
            if (is_array($aaaa)) {
                foreach ($aaaa as $record) {
                    if (!empty($record['ipv6'])) {
                        $ips[] = $record['ipv6'];
                    }
                }
            }
        }

        return $ips;
    }

    private function sanitizeSmtpAddress($email)
    {
        // Remove caracteres que poderiam injetar comandos no protocolo SMTP
        $sanitized = preg_replace('/[\r\n<>]/', '', $email);
        return $sanitized !== null ? $sanitized : '';
    }

    private function buildMessage($toEmail, $toName, $subject, $htmlBody, $textBody)
    {
        $boundary = 'b_' . bin2hex(random_bytes(12));
        $headers = [
            'MIME-Version: 1.0',
            'Date: ' . date(DATE_RFC2822),
            'From: ' . $this->address($this->settings['fromEmail'], $this->settings['fromName']),
            'To: ' . $this->address($toEmail, $toName),
            'Subject: ' . $this->encodeHeader($subject),
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        ];

        return implode("\r\n", $headers) . "\r\n\r\n"
            . '--' . $boundary . "\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n"
            . $this->dotEscape($textBody) . "\r\n"
            . '--' . $boundary . "\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n"
            . $this->dotEscape($htmlBody) . "\r\n"
            . '--' . $boundary . '--';
    }

    private function command($command, array $expected)
    {
        fwrite($this->socket, $command . "\r\n");
        return $this->expect($expected);
    }

    private function expect(array $expected)
    {
        $response = '';
        while (($line = fgets($this->socket, 515)) !== false) {
            $response .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        $code = (int) substr($response, 0, 3);
        if (!in_array($code, $expected, true)) {
            throw new RuntimeException('Resposta SMTP inesperada: ' . trim($response));
        }
        return $response;
    }

    private function address($email, $name)
    {
        $name = trim($name);
        return ($name ? $this->encodeHeader($name) . ' ' : '') . '<' . $this->sanitizeSmtpAddress($email) . '>';
    }

    private function encodeHeader($value)
    {
        return '=?UTF-8?B?' . base64_encode($value) . '?=';
    }

    private function dotEscape($body)
    {
        $body = str_replace(["\r\n", "\r"], "\n", $body);
        $escaped = preg_replace('/^\./m', '..', $body);
        $body = $escaped !== null ? $escaped : $body;

        return str_replace("\n", "\r\n", $body);
    }
}
