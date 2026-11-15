import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executarComCorrelacao } from '../../src/correlacao.js';
import { criarRepositorio } from '../../src/repositorio.js';

function montar() {
  const chamadas = [];
  const repositorio = criarRepositorio({
    baseUrl: 'http://os.interno',
    tokenInterno: async () => 'token-interno',
    fetch: async (url, opcoes) => {
      chamadas.push({ url, headers: opcoes.headers });
      return { status: 200, ok: true, json: async () => ({ id: 7 }) };
    },
  });
  return { repositorio, chamadas };
}

test('repassa ao OS o X-Correlation-Id da requisição em andamento', async () => {
  const { repositorio, chamadas } = montar();

  await executarComCorrelacao('rastreio-9', () => repositorio.buscarClientePorCpf('52998224725'));

  assert.equal(chamadas[0].headers['x-correlation-id'], 'rastreio-9');
  assert.equal(chamadas[0].headers.authorization, 'Bearer token-interno');
});

test('fora de uma requisição não envia o cabeçalho', async () => {
  const { repositorio, chamadas } = montar();

  await repositorio.buscarClientePorCpf('52998224725');

  assert.equal('x-correlation-id' in chamadas[0].headers, false);
});
