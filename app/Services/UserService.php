<?php

namespace App\Services;

use App\Repositories\UserRepository;
use InvalidArgumentException;

class UserService
{
    const MAX_PHOTO_BYTES  = 524288; // 512 KB
    const ALLOWED_PHOTO_PREFIXES = [
        'data:image/jpeg;base64,',
        'data:image/png;base64,',
        'data:image/webp;base64,',
        'data:image/gif;base64,',
    ];

    /** @var UserRepository */
    private $users;

    public function __construct(UserRepository $users = null)
    {
        $this->users = $users !== null ? $users : new UserRepository();
    }

    public function all()
    {
        return array_map('user_to_array', $this->users->all());
    }

    public function save(array $item)
    {
        if (empty($item['id']) || empty($item['name'])) {
            throw new InvalidArgumentException('Campos obrigatórios ausentes: id, name.');
        }

        // role só é gravado se vier no payload (admins removem a restrição no controller)
        if (!isset($item['role'])) {
            $existing = $this->users->find($item['id']);
            if (!$existing) {
                throw new InvalidArgumentException('Usuário não encontrado.');
            }
            $item['role'] = $existing['role'];
        }

        $allowedRoles = ['aluno', 'professor', 'tecnico', 'administrador'];
        if (!in_array($item['role'], $allowedRoles, true)) {
            throw new InvalidArgumentException('Papel inválido.');
        }

        $fields = [
            'id'     => $item['id'],
            'name'   => $item['name'],
            'role'   => $item['role'],
            'source' => isset($item['source']) ? $item['source'] : 'manual',
        ];

        $nullables = [
            'email'            => 'email',
            'level'            => 'level',
            'course'           => 'course',
            'program'          => 'program',
            'postgradType'     => 'postgrad_type',
            'advisorId'        => 'advisor_id',
            'advisorName'      => 'advisor_name',
            'researchProject'  => 'research_project',
            'entryDate'        => 'entry_date',
            'qualificationDeadline' => 'qualification_deadline',
            'advisorMeetingUrl' => 'advisor_meeting_url',
            'articleUrl'       => 'article_url',
            'qualificationUrl' => 'qualification_url',
            'thesisUrl'        => 'thesis_url',
            'photoDataUrl'     => 'photo_data_url',
        ];

        foreach ($nullables as $jsKey => $dbCol) {
            $fields[$dbCol] = isset($item[$jsKey]) ? $item[$jsKey] : null;
        }

        if ($fields['photo_data_url'] !== null) {
            $fields['photo_data_url'] = $this->validatePhotoDataUrl($fields['photo_data_url']);
        }

        if (!empty($item['password'])) {
            $fields['password_hash'] = password_hash($item['password'], PASSWORD_BCRYPT);
        }

        return user_to_array($this->users->save($fields));
    }

    public function delete($id)
    {
        if (!$id) {
            throw new InvalidArgumentException('ID não informado.');
        }

        $this->users->delete($id);
    }

    private function validatePhotoDataUrl($dataUrl)
    {
        $matched = false;
        foreach (self::ALLOWED_PHOTO_PREFIXES as $prefix) {
            if (str_starts_with($dataUrl, $prefix)) {
                $matched = true;
                break;
            }
        }

        if (!$matched) {
            throw new InvalidArgumentException('Formato de imagem não permitido. Use JPEG, PNG, WebP ou GIF.');
        }

        if (strlen($dataUrl) > self::MAX_PHOTO_BYTES) {
            throw new InvalidArgumentException('Imagem muito grande. Tamanho máximo: 512 KB.');
        }

        return $dataUrl;
    }
}
