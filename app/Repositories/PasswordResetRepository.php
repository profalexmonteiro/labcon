<?php

namespace App\Repositories;

class PasswordResetRepository extends BaseRepository
{
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

    public function markUsed($id)
    {
        $this->db->prepare('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?')->execute([$id]);
    }
}
