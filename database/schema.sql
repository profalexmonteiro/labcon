-- LabCon - Schema MySQL
-- Execute como: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS labcon CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE labcon;

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(80) PRIMARY KEY,
    email VARCHAR(255) UNIQUE DEFAULT NULL,
    password_hash VARCHAR(255) DEFAULT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('aluno','professor','tecnico','administrador') NOT NULL DEFAULT 'aluno',
    level VARCHAR(20) DEFAULT NULL,
    course VARCHAR(255) DEFAULT NULL,
    program VARCHAR(50) DEFAULT NULL,
    postgrad_type VARCHAR(50) DEFAULT NULL,
    advisor_id VARCHAR(80) DEFAULT NULL,
    advisor_name VARCHAR(255) DEFAULT NULL,
    research_project TEXT DEFAULT NULL,
    entry_date DATE DEFAULT NULL,
    qualification_deadline DATE DEFAULT NULL,
    advisor_meeting_url VARCHAR(500) DEFAULT NULL,
    article_url VARCHAR(500) DEFAULT NULL,
    qualification_url VARCHAR(500) DEFAULT NULL,
    thesis_url VARCHAR(500) DEFAULT NULL,
    photo_data_url MEDIUMTEXT DEFAULT NULL,
    source VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO users (id, email, password_hash, name, role, source)
VALUES (
    'admin-0000000000000000',
    'admin@labcon.local',
    '$2y$12$BLAMWlJ.gm0ms0aUp.JwuOyXkw1nOGvxPY9.QD0.BdbLAPmsVYLzq',
    'Administrador Padrão',
    'administrador',
    'manual'
) ON DUPLICATE KEY UPDATE id = id;

CREATE TABLE IF NOT EXISTS labs (
    id VARCHAR(80) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS desks (
    id VARCHAR(80) PRIMARY KEY,
    lab_id VARCHAR(80) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reservations (
    id VARCHAR(80) PRIMARY KEY,
    user_id VARCHAR(80) NOT NULL,
    lab_id VARCHAR(80) NOT NULL,
    desk_id VARCHAR(80) NOT NULL,
    day ENUM('Segunda','Terca','Quarta','Quinta','Sexta','Sabado') NOT NULL,
    start_time VARCHAR(5) NOT NULL,
    end_time VARCHAR(5) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE,
    FOREIGN KEY (desk_id) REFERENCES desks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(120) PRIMARY KEY,
    setting_value MEDIUMTEXT DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id VARCHAR(80) PRIMARY KEY,
    user_id VARCHAR(80) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índices para melhorar consultas
CREATE INDEX IF NOT EXISTS idx_desks_lab_id ON desks(lab_id);
CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_lab_id ON reservations(lab_id);
CREATE INDEX IF NOT EXISTS idx_reservations_desk_id ON reservations(desk_id);
CREATE INDEX IF NOT EXISTS idx_reservations_day ON reservations(day);
CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens(user_id);
