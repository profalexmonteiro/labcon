<?php

namespace App\Services;

use App\Repositories\PasswordResetRepository;
use App\Repositories\UserRepository;
use InvalidArgumentException;
use RuntimeException;

class AuthService
{
    /** @var UserRepository */
    private $users;
    /** @var PasswordResetRepository */
    private $resets;
    /** @var SmtpSettingsService */
    private $smtpSettings;

    const MAX_ATTEMPTS   = 10;
    const WINDOW_SECONDS = 300;

    public function __construct(
        UserRepository $users = null,
        PasswordResetRepository $resets = null,
        SmtpSettingsService $smtpSettings = null
    )
    {
        $this->users = $users !== null ? $users : new UserRepository();
        $this->resets = $resets !== null ? $resets : new PasswordResetRepository();
        $this->smtpSettings = $smtpSettings !== null ? $smtpSettings : new SmtpSettingsService();
    }

    public function login($email, $password)
    {
        $email = trim($email);
        if (!$email || !$password) {
            throw new InvalidArgumentException('E-mail e senha são obrigatórios.');
        }

        $ip         = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0';
        $identifier = hash('sha256', $ip . '|' . strtolower($email));

        $this->enforceRateLimit($identifier);

        $row = $this->users->findByEmail($email);
        if (!$row || !$row['password_hash'] || !password_verify($password, $row['password_hash'])) {
            $this->recordFailedAttempt($identifier);
            throw new RuntimeException('E-mail ou senha incorretos.');
        }

        $this->clearAttempts($identifier);

        $user = user_to_array($row);
        set_session_user($user);

        return $user;
    }

    private function enforceRateLimit($identifier)
    {
        $db   = get_db();
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM login_attempts
             WHERE identifier = ? AND attempted_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)'
        );
        $stmt->execute([$identifier, self::WINDOW_SECONDS]);
        $count = (int) $stmt->fetchColumn();

        if ($count >= self::MAX_ATTEMPTS) {
            throw new RuntimeException('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
        }
    }

    private function recordFailedAttempt($identifier)
    {
        $db   = get_db();
        $stmt = $db->prepare('INSERT INTO login_attempts (identifier) VALUES (?)');
        $stmt->execute([$identifier]);

        $stmt = $db->prepare(
            'DELETE FROM login_attempts WHERE attempted_at < DATE_SUB(NOW(), INTERVAL ? SECOND)'
        );
        $stmt->execute([self::WINDOW_SECONDS * 2]);
    }

    private function clearAttempts($identifier)
    {
        $db   = get_db();
        $stmt = $db->prepare('DELETE FROM login_attempts WHERE identifier = ?');
        $stmt->execute([$identifier]);
    }

    public function register(array $body)
    {
        $name = trim(isset($body['name']) ? $body['name'] : '');
        $email = trim(isset($body['email']) ? $body['email'] : '');
        $password = isset($body['password']) ? $body['password'] : '';
        // O auto-cadastro público sempre cria papel "aluno": permitir que o
        // próprio requisitante escolha "professor"/"tecnico" (e assim ganhe
        // permissão para gerenciar laboratórios, mesas e outros usuários)
        // seria uma escalação de privilégio trivial. Contas com papéis
        // elevados devem ser criadas por um administrador (UserController).
        $role = 'aluno';

        if (!$name || !$email || !$password) {
            throw new InvalidArgumentException('Nome, e-mail e senha são obrigatórios.');
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('E-mail inválido.');
        }
        if (mb_strlen($password) < 8) {
            throw new InvalidArgumentException('A senha deve ter pelo menos 8 caracteres.');
        }
        if ($this->users->findByEmail($email)) {
            throw new InvalidArgumentException('Já existe um cadastro com este e-mail.');
        }

        $fields = [
            'id' => 'auth-' . bin2hex(random_bytes(8)),
            'email' => $email,
            'password_hash' => password_hash($password, PASSWORD_BCRYPT),
            'name' => $name,
            'role' => $role,
            'source' => 'auth',
        ];

        $level = isset($body['level']) ? $body['level'] : 'graduacao';
        $fields['level'] = $level;
        $fields['advisor_id'] = isset($body['advisorId']) ? $body['advisorId'] : null;
        $fields['advisor_name'] = isset($body['advisorName']) ? $body['advisorName'] : null;
        $fields['research_project'] = isset($body['researchProject']) ? $body['researchProject'] : null;

        if ($level === 'graduacao') {
            $fields['course'] = isset($body['course']) ? $body['course'] : null;
            $fields['program'] = isset($body['program']) ? $body['program'] : null;
        } else {
            $fields['postgrad_type'] = isset($body['postgradType']) ? $body['postgradType'] : null;
        }

        $fields = array_filter($fields, function ($value) {
            return $value !== null;
        });
        $user = user_to_array($this->users->save($fields));
        set_session_user($user);

        return $user;
    }

    public function logout()
    {
        clear_session();
    }

    public function requestPasswordReset($email)
    {
        $email = trim($email);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Informe um e-mail valido.');
        }

        $row = $this->users->findByEmail($email);
        if (!$row) {
            return;
        }

        $settings = $this->smtpSettings->get(true);
        if (empty($settings['enabled'])) {
            throw new RuntimeException('SMTP nao configurado. Solicite ao administrador a configuracao do envio de e-mails.');
        }

        $token = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $token);
        $expiresAt = date('Y-m-d H:i:s', time() + 60 * 60);
        $this->resets->create($row['id'], $tokenHash, $expiresAt);

        $link = $this->baseUrl() . '/reset_password.php?token=' . urlencode($token);
        $name = isset($row['name']) ? $row['name'] : 'Usuario';
        $subject = APP_NAME . ' - recuperacao de senha';
        $text = "Ola, {$name}.\n\nAcesse o link abaixo para criar uma nova senha. O link expira em 1 hora.\n\n{$link}\n\nSe voce nao solicitou a recuperacao, ignore este e-mail.";
        $html = '<p>Ola, ' . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . '.</p>'
            . '<p>Acesse o link abaixo para criar uma nova senha. O link expira em 1 hora.</p>'
            . '<p><a href="' . htmlspecialchars($link, ENT_QUOTES, 'UTF-8') . '">Redefinir senha</a></p>'
            . '<p>Se voce nao solicitou a recuperacao, ignore este e-mail.</p>';

        (new SmtpMailer($settings))->send($email, $name, $subject, $html, $text);
    }

    public function resetPassword($token, $password)
    {
        $token = trim($token);
        if ($token === '' || mb_strlen($token) < 32) {
            throw new InvalidArgumentException('Token invalido.');
        }
        if (mb_strlen($password) < 8) {
            throw new InvalidArgumentException('A senha deve ter pelo menos 8 caracteres.');
        }

        $reset = $this->resets->findValid(hash('sha256', $token));
        if (!$reset) {
            throw new RuntimeException('Link de recuperacao invalido ou expirado.');
        }

        $user = $this->users->find($reset['user_id']);
        if (!$user) {
            throw new RuntimeException('Usuario nao encontrado.');
        }

        $this->users->save([
            'id' => $user['id'],
            'name' => $user['name'],
            'role' => $user['role'],
            'source' => isset($user['source']) ? $user['source'] : 'manual',
            'email' => isset($user['email']) ? $user['email'] : null,
            'level' => isset($user['level']) ? $user['level'] : null,
            'course' => isset($user['course']) ? $user['course'] : null,
            'program' => isset($user['program']) ? $user['program'] : null,
            'postgrad_type' => isset($user['postgrad_type']) ? $user['postgrad_type'] : null,
            'advisor_id' => isset($user['advisor_id']) ? $user['advisor_id'] : null,
            'advisor_name' => isset($user['advisor_name']) ? $user['advisor_name'] : null,
            'research_project' => isset($user['research_project']) ? $user['research_project'] : null,
            'entry_date' => isset($user['entry_date']) ? $user['entry_date'] : null,
            'qualification_deadline' => isset($user['qualification_deadline']) ? $user['qualification_deadline'] : null,
            'advisor_meeting_url' => isset($user['advisor_meeting_url']) ? $user['advisor_meeting_url'] : null,
            'article_url' => isset($user['article_url']) ? $user['article_url'] : null,
            'qualification_url' => isset($user['qualification_url']) ? $user['qualification_url'] : null,
            'thesis_url' => isset($user['thesis_url']) ? $user['thesis_url'] : null,
            'photo_data_url' => isset($user['photo_data_url']) ? $user['photo_data_url'] : null,
            'password_hash' => password_hash($password, PASSWORD_BCRYPT),
        ]);
        $this->resets->markUsed($reset['id']);
    }

    private function baseUrl()
    {
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ((isset($_SERVER['SERVER_PORT']) ? $_SERVER['SERVER_PORT'] : '') === '443');
        $scheme = $https ? 'https' : 'http';
        $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';
        $dir = rtrim(str_replace('\\', '/', dirname(isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '')), '/');
        if ($dir === '/api') {
            $dir = '';
        } elseif (str_ends_with($dir, '/api')) {
            $dir = substr($dir, 0, -4);
        }

        return $scheme . '://' . $host . ($dir ? $dir : '');
    }
}
