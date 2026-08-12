<?php

namespace App\Repositories;

/** Acesso direto à tabela `password_reset_tokens`. */
class PasswordResetRepository extends BaseRepository
{
    /**
     * Cria um novo token de redefinição de senha para o usuário.
     *
     * Antes de inserir o novo token, invalida (`used_at = NOW()`) qualquer
     * token anterior ainda válido do mesmo usuário — garante que apenas o
     * link de redefinição mais recente enviado por e-mail funcione,
     * evitando que links antigos permaneçam ativos indefinidamente.
     *
     * @param string $userId
     * @param string $tokenHash Hash do token (o token em texto puro nunca é persistido).
     * @param string $expiresAt Data/hora de expiração (formato aceito pelo MySQL DATETIME).
     */
    public function create($userId, $tokenHash, $expiresAt)
    {
        $this->db->prepare('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL')
            ->execute([$userId]);

        $this->upsert('password_reset_tokens', [
            'id' => 'reset-' . bin2hex(random_bytes(8)),
            'user_id' => $userId,
            'token_hash' => $tokenHash,
            'expires_at' => $expiresAt,
            'used_at' => null,
        ]);
    }

    /**
     * Busca um token ainda válido (não usado e não expirado) pelo hash.
     * Quando há mais de um resultado (não deveria ocorrer em uso normal),
     * retorna o mais recente.
     *
     * @return array|null
     */
    public function findValid($tokenHash)
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM password_reset_tokens
             WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1'
        );
        $stmt->execute([$tokenHash]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    /** Marca o token como consumido, impedindo reutilização (link de uso único). */
    public function markUsed($id)
    {
        $this->db->prepare('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?')->execute([$id]);
    }
}
