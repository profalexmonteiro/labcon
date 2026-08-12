<?php

namespace App\Repositories;

/** Acesso direto à tabela `users` (todo SQL de usuários fica aqui). */
class UserRepository extends BaseRepository
{
    /** @return array Todos os usuários, ordenados por nome. */
    public function all()
    {
        return $this->db->query('SELECT * FROM users ORDER BY name')->fetchAll();
    }

    /** @return array|null Usuário pelo id, ou null se não encontrado. */
    public function find($id)
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    /** @return array|null Usuário pelo e-mail (usado no login e cadastro), ou null. */
    public function findByEmail($email)
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    /** Insere ou atualiza um usuário e retorna o registro resultante. */
    public function save(array $fields)
    {
        $this->upsert('users', $fields);

        return $this->find($fields['id']);
    }

    /**
     * Remove um usuário. Antes de excluir, limpa a referência de
     * orientador (`advisor_id`/`advisor_name`) em qualquer outro usuário
     * que apontava para este id — como esses campos guardam uma cópia
     * "denormalizada" do nome do orientador (e não têm FK), a exclusão
     * direta deixaria órfãos com um advisor_id inexistente.
     */
    public function delete($id)
    {
        $this->db->prepare('UPDATE users SET advisor_id = NULL, advisor_name = NULL WHERE advisor_id = ?')->execute([$id]);
        $this->db->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
    }

    /** Remove todos os usuários (usado pela limpeza de dados administrativa). */
    public function deleteAll()
    {
        $this->db->exec('DELETE FROM users');
    }
}
