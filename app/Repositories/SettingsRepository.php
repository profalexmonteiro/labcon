<?php

namespace App\Repositories;

/**
 * Acesso direto à tabela `app_settings`, um armazenamento genérico de
 * chave/valor usado para configurações administrativas (ex.: SMTP).
 */
class SettingsRepository extends BaseRepository
{
    /** @return string|null Valor bruto armazenado, ou null se a chave não existe. */
    public function get($key)
    {
        $stmt = $this->db->prepare('SELECT setting_value FROM app_settings WHERE setting_key = ?');
        $stmt->execute([$key]);
        $value = $stmt->fetchColumn();

        return $value === false ? null : (string) $value;
    }

    /** Grava (ou sobrescreve) o valor associado a uma chave de configuração. */
    public function set($key, $value)
    {
        $this->upsert('app_settings', [
            'setting_key' => $key,
            'setting_value' => $value,
        ]);
    }
}
