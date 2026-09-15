import { test } from 'node:test';
import assert from 'node:assert/strict';
import { senhas } from '../../src/senhas.js';

const HASH_GERADO_PELO_SPRING = '$2a$10$FlXMmy.Fkbk8TIc4HtSHa.M7WtITMtW3/0NHj6VPWFvmK4ttTI4T2';

test('hash gerado confere com a senha original', async () => {
  const hash = await senhas.gerarHash('Cliente@123');
  assert.match(hash, /^\$2[aby]\$10\$/);
  assert.equal(await senhas.conferir('Cliente@123', hash), true);
  assert.equal(await senhas.conferir('errada', hash), false);
});

test('confere hash $2a$ no formato gravado pelo BCryptPasswordEncoder do Spring', async () => {
  assert.equal(await senhas.conferir('Admin@123', HASH_GERADO_PELO_SPRING), true);
});

test('hash ausente nunca confere', async () => {
  assert.equal(await senhas.conferir('qualquer', null), false);
});
