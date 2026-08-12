<?php

namespace App\Services;

use App\Repositories\SettingsRepository;
use InvalidArgumentException;

/**
 * Persistência e cifragem das configurações de envio de e-mail (SMTP).
 *
 * As configurações são guardadas como um único JSON na tabela
 * `app_settings` (chave `smtp`), com a senha SMTP cifrada em
 * Encrypt-then-MAC (AES-256-CBC + HMAC-SHA256) usando chaves derivadas de
 * APP_SECRET — nunca em texto puro no banco.
 */
class SmtpSettingsService
{
    const KEY = 'smtp';

    /** @var SettingsRepository */
    private $settings;

    public function __construct(SettingsRepository $settings = null)
    {
        $this->settings = $settings !== null ? $settings : new SettingsRepository();
    }

    /**
     * Retorna as configurações SMTP com os valores padrão aplicados.
     *
     * @param bool $includeSecret Quando false (padrão, usado pela tela de
     *                            administração), a senha é omitida do
     *                            retorno — apenas a flag `passwordSet`
     *                            indica se uma senha já foi configurada.
     *                            Passar true apenas em uso interno (ex.: SmtpMailer).
     */
    public function get($includeSecret = false)
    {
        $stored = $this->decode($this->settings->get(self::KEY));
        $defaults = [
            'enabled' => false,
            'host' => '',
            'port' => 587,
            'encryption' => 'tls',
            'username' => '',
            'password' => '',
            'fromEmail' => '',
            'fromName' => APP_NAME,
        ];
        $smtp = array_merge($defaults, $stored);
        $smtp['port'] = (int) $smtp['port'];
        $smtp['passwordSet'] = !empty($smtp['password']);

        if (!$includeSecret) {
            unset($smtp['password']);
        }

        return $smtp;
    }

    /**
     * Valida e persiste as configurações SMTP enviadas pela tela de
     * administração.
     *
     * O campo `keepPassword` permite ao front-end salvar as demais
     * configurações sem reenviar a senha em texto puro a cada edição:
     * quando marcado e nenhuma nova senha é informada, a senha atual
     * (já decifrada internamente via `get(true)`) é reaproveitada.
     *
     * @throws InvalidArgumentException Em porta/criptografia inválida, ou
     *                                   campos obrigatórios ausentes quando `enabled=true`.
     */
    public function save(array $body)
    {
        $current = $this->get(true);
        $smtp = [
            'enabled' => !empty($body['enabled']),
            'host' => trim(isset($body['host']) ? $body['host'] : ''),
            'port' => (int) (isset($body['port']) ? $body['port'] : 587),
            'encryption' => isset($body['encryption']) ? $body['encryption'] : 'tls',
            'username' => trim(isset($body['username']) ? $body['username'] : ''),
            'password' => (string) (isset($body['password']) ? $body['password'] : ''),
            'fromEmail' => trim(isset($body['fromEmail']) ? $body['fromEmail'] : ''),
            'fromName' => trim(isset($body['fromName']) ? $body['fromName'] : APP_NAME),
        ];

        if ($smtp['password'] === '' && !empty($body['keepPassword'])) {
            $smtp['password'] = isset($current['password']) ? $current['password'] : '';
        }

        if (!in_array($smtp['encryption'], ['tls', 'ssl', 'none'], true)) {
            throw new InvalidArgumentException('Criptografia SMTP invalida.');
        }
        if ($smtp['port'] < 1 || $smtp['port'] > 65535) {
            throw new InvalidArgumentException('Porta SMTP invalida.');
        }
        if ($smtp['enabled']) {
            foreach (['host' => 'host', 'username' => 'usuario', 'password' => 'senha', 'fromEmail' => 'e-mail remetente'] as $key => $label) {
                if ($smtp[$key] === '') {
                    throw new InvalidArgumentException('Informe o ' . $label . ' do SMTP.');
                }
            }
            if (!filter_var($smtp['fromEmail'], FILTER_VALIDATE_EMAIL)) {
                throw new InvalidArgumentException('E-mail remetente invalido.');
            }
        }

        $this->settings->set(self::KEY, $this->encode($smtp));

        return $this->get();
    }

    /** Decodifica o JSON armazenado e decifra a senha, se presente. */
    private function decode($value)
    {
        if (!$value) {
            return [];
        }
        $data = json_decode($value, true);
        if (!is_array($data)) {
            return [];
        }
        if (!empty($data['password'])) {
            $data['password'] = $this->decrypt($data['password']);
        }
        return $data;
    }

    /** Cifra a senha (se presente) e serializa as configurações para JSON. */
    private function encode(array $smtp)
    {
        if (!empty($smtp['password'])) {
            $smtp['password'] = $this->encrypt($smtp['password']);
        }
        return json_encode($smtp, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    // Prefixo de versão do payload cifrado: permite evoluir o formato sem
    // quebrar segredos já gravados no banco com o formato legado (v1).
    const CIPHER_VERSION = "\x02";

    /**
     * Deriva chaves de cifra e de autenticação distintas a partir do
     * APP_SECRET (HMAC como KDF simples, compatível com PHP 5.6/sem libsodium).
     * Usar chaves separadas evita reuso de material entre AES e HMAC.
     */
    private function deriveKey($context)
    {
        return hash_hmac('sha256', $context, APP_SECRET, true);
    }

    /**
     * AES-256-CBC puro é maleável: sem autenticação, um atacante com acesso de
     * escrita ao banco (ex.: via outra falha, ou um DBA malicioso) pode
     * adulterar bytes do ciphertext (bit-flipping) ou reaproveitar blocos sem
     * que a aplicação perceba, e o oráculo de padding do CBC pode vazar o
     * segredo byte a byte. Por isso aplicamos Encrypt-then-MAC (HMAC-SHA256)
     * sobre IV+ciphertext e validamos o MAC com hash_equals antes de decifrar.
     */
    private function encrypt($plain)
    {
        $iv = random_bytes(16);
        $cipher = openssl_encrypt($plain, 'AES-256-CBC', $this->deriveKey('labcon-smtp-enc'), OPENSSL_RAW_DATA, $iv);
        $mac = hash_hmac('sha256', $iv . $cipher, $this->deriveKey('labcon-smtp-mac'), true);

        return base64_encode(self::CIPHER_VERSION . $iv . $mac . $cipher);
    }

    /** Decodifica de base64 e despacha para o decifrador do formato (v2 autenticado, ou legado v1). */
    private function decrypt($encoded)
    {
        $raw = base64_decode($encoded, true);
        if ($raw === false || $raw === '') {
            return '';
        }

        if ($raw[0] === self::CIPHER_VERSION) {
            return $this->decryptAuthenticated(substr($raw, 1));
        }

        // Formato legado (sem MAC): mantido apenas para ler segredos gravados
        // antes desta correção. O próximo save() regrava no formato v2.
        return $this->decryptLegacyUnauthenticated($raw);
    }

    /**
     * Decifra o formato atual (v2): valida o HMAC antes de decifrar
     * (Encrypt-then-MAC) e retorna string vazia — em vez de lançar erro —
     * caso a integridade falhe, para não interromper a leitura das demais
     * configurações SMTP por um segredo corrompido/adulterado.
     */
    private function decryptAuthenticated($raw)
    {
        if (strlen($raw) <= 16 + 32) {
            return '';
        }
        $iv     = substr($raw, 0, 16);
        $mac    = substr($raw, 16, 32);
        $cipher = substr($raw, 48);

        $expectedMac = hash_hmac('sha256', $iv . $cipher, $this->deriveKey('labcon-smtp-mac'), true);
        if (!hash_equals($expectedMac, $mac)) {
            error_log('[LabCon SECURITY] Falha de integridade (MAC) ao decifrar segredo SMTP; ignorando valor.');
            return '';
        }

        $plain = openssl_decrypt($cipher, 'AES-256-CBC', $this->deriveKey('labcon-smtp-enc'), OPENSSL_RAW_DATA, $iv);

        return $plain === false ? '' : $plain;
    }

    /**
     * Decifra o formato legado (v1, sem MAC), usado apenas para segredos
     * gravados antes da introdução da autenticação Encrypt-then-MAC.
     */
    private function decryptLegacyUnauthenticated($raw)
    {
        if (strlen($raw) <= 16) {
            return '';
        }
        $iv = substr($raw, 0, 16);
        $cipher = substr($raw, 16);
        $plain = openssl_decrypt($cipher, 'AES-256-CBC', hash('sha256', APP_SECRET, true), OPENSSL_RAW_DATA, $iv);

        return $plain === false ? '' : $plain;
    }
}
