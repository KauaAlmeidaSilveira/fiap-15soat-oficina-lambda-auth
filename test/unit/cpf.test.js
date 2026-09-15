import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpfValido, normalizarDocumento } from '../../src/cpf.js';

test('normaliza removendo pontuação', () => {
  assert.equal(normalizarDocumento('529.982.247-25'), '52998224725');
});

test('normaliza valores ausentes para string vazia', () => {
  assert.equal(normalizarDocumento(undefined), '');
  assert.equal(normalizarDocumento(null), '');
});

test('aceita CPF com dígitos verificadores corretos', () => {
  assert.equal(cpfValido('52998224725'), true);
  assert.equal(cpfValido('71498053297'), true);
  assert.equal(cpfValido('98765432100'), true);
});

test('rejeita CPF com dígito verificador errado', () => {
  assert.equal(cpfValido('12345678901'), false);
  assert.equal(cpfValido('52998224724'), false);
});

test('rejeita sequência de dígitos repetidos', () => {
  assert.equal(cpfValido('11111111111'), false);
});

test('rejeita tamanho diferente de 11', () => {
  assert.equal(cpfValido('5299822472'), false);
  assert.equal(cpfValido('12345678000199'), false);
  assert.equal(cpfValido(''), false);
});
