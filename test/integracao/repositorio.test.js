import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { criarRepositorio } from '../../src/repositorio.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL_TESTE ?? 'postgres://postgres:postgres@localhost:5433/postgres',
  max: 2,
});
const repositorio = criarRepositorio(pool);
const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

before(async () => {
  await pool.query('SELECT 1');
});

beforeEach(async () => {
  await pool.query(schema);
  await pool.query(`
    INSERT INTO roles (name) VALUES ('ADMIN'), ('OPERADOR'), ('RECEPCAO');
    INSERT INTO users (id, username, password) VALUES
      ('11111111-1111-1111-1111-111111111111', 'kaua@gmail.com', '$2a$10$hashAdmin'),
      ('22222222-2222-2222-2222-222222222222', 'semrole@oficina.com', '$2a$10$hashSemRole');
    INSERT INTO users_roles (user_id, role_id)
      SELECT '11111111-1111-1111-1111-111111111111', role_id FROM roles WHERE name IN ('ADMIN', 'RECEPCAO');
    INSERT INTO cliente (nome, cpf_cnpj, tipo_documento, email, status, criado_em) VALUES
      ('João da Silva', '52998224725', 'CPF', 'Joao@Email.com', 'ATIVO', now()),
      ('Maria Oliveira', '98765432100', 'CPF', 'maria@email.com', 'INATIVO', now());
  `);
});

after(async () => {
  await pool.end();
});

describe('buscarFuncionario', () => {
  test('devolve hash e todas as roles', async () => {
    const funcionario = await repositorio.buscarFuncionario('kaua@gmail.com');
    assert.equal(funcionario.username, 'kaua@gmail.com');
    assert.equal(funcionario.senhaHash, '$2a$10$hashAdmin');
    assert.deepEqual([...funcionario.roles].sort(), ['ADMIN', 'RECEPCAO']);
  });

  test('usuário sem role devolve lista vazia', async () => {
    const funcionario = await repositorio.buscarFuncionario('semrole@oficina.com');
    assert.deepEqual(funcionario.roles, []);
  });

  test('usuário inexistente devolve null', async () => {
    assert.equal(await repositorio.buscarFuncionario('nao@existe.com'), null);
  });
});

describe('buscarClientePorCpf', () => {
  test('devolve id numérico, status e hash nulo', async () => {
    const cliente = await repositorio.buscarClientePorCpf('52998224725');
    assert.equal(typeof cliente.id, 'number');
    assert.equal(cliente.status, 'ATIVO');
    assert.equal(cliente.senhaHash, null);
  });

  test('CPF inexistente devolve null', async () => {
    assert.equal(await repositorio.buscarClientePorCpf('71498053297'), null);
  });
});

describe('definirSenhaPrimeiroAcesso', () => {
  test('grava o hash comparando e-mail sem diferenciar maiúsculas', async () => {
    const id = await repositorio.definirSenhaPrimeiroAcesso('52998224725', 'joao@email.com', '$2a$10$novo');
    assert.equal(typeof id, 'number');
    assert.equal((await repositorio.buscarClientePorCpf('52998224725')).senhaHash, '$2a$10$novo');
  });

  test('segunda tentativa não sobrescreve a senha', async () => {
    await repositorio.definirSenhaPrimeiroAcesso('52998224725', 'joao@email.com', '$2a$10$primeira');
    assert.equal(await repositorio.definirSenhaPrimeiroAcesso('52998224725', 'joao@email.com', '$2a$10$segunda'), null);
    assert.equal((await repositorio.buscarClientePorCpf('52998224725')).senhaHash, '$2a$10$primeira');
  });

  test('e-mail divergente devolve null', async () => {
    assert.equal(await repositorio.definirSenhaPrimeiroAcesso('52998224725', 'outro@email.com', '$2a$10$x'), null);
  });

  test('cliente inativo devolve null', async () => {
    assert.equal(await repositorio.definirSenhaPrimeiroAcesso('98765432100', 'maria@email.com', '$2a$10$x'), null);
  });

  test('duas tentativas simultâneas: só uma grava', async () => {
    const resultados = await Promise.all([
      repositorio.definirSenhaPrimeiroAcesso('52998224725', 'joao@email.com', '$2a$10$corridaA'),
      repositorio.definirSenhaPrimeiroAcesso('52998224725', 'joao@email.com', '$2a$10$corridaB'),
    ]);
    assert.equal(resultados.filter((id) => id !== null).length, 1);
  });
});
