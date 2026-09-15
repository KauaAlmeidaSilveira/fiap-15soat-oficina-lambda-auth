DROP TABLE IF EXISTS users_roles, users, roles, cliente;

CREATE TABLE roles (
    role_id BIGSERIAL PRIMARY KEY,
    name    VARCHAR(255)
);

CREATE TABLE users (
    id       UUID PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE users_roles (
    user_id UUID   NOT NULL REFERENCES users (id),
    role_id BIGINT NOT NULL REFERENCES roles (role_id),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE cliente (
    id             BIGSERIAL PRIMARY KEY,
    nome           VARCHAR(100) NOT NULL,
    cpf_cnpj       VARCHAR(14)  NOT NULL UNIQUE,
    tipo_documento VARCHAR(255) NOT NULL,
    telefone       VARCHAR(20),
    email          VARCHAR(150),
    endereco       VARCHAR(255),
    status         VARCHAR(20)  NOT NULL DEFAULT 'ATIVO',
    senha_hash     VARCHAR(60),
    criado_em      TIMESTAMP    NOT NULL,
    atualizado_em  TIMESTAMP
);
