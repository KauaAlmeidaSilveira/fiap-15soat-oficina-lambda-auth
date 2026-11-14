import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { criarRepositorio } from '../../src/repositorio.js';

const recebidas = [];
let servidor;
let repositorio;

const respostas = {
  'GET /internal/auth/funcionarios?username=kaua%40gmail.com': [200, { username: 'kaua@gmail.com', senhaHash: '$2a$x', roles: ['ADMIN'] }],
  'GET /internal/auth/funcionarios?username=semrole%40oficina.com': [200, { username: 'semrole@oficina.com', senhaHash: '$2a$x', roles: [] }],
  'GET /internal/auth/clientes/52998224725': [200, { id: 7, status: 'ATIVO', senhaHash: '$2a$y' }],
  'POST /internal/auth/clientes/52998224725/primeiro-acesso': [200, { id: 7 }],
  'GET /internal/auth/clientes/00000000000': [500, {}],
};

before(async () => {
  servidor = createServer((req, res) => {
    let corpo = '';
    req.on('data', (parte) => { corpo += parte; });
    req.on('end', () => {
      recebidas.push({ rota: `${req.method} ${req.url}`, autorizacao: req.headers.authorization, tipo: req.headers['content-type'], corpo });
      const [status, resposta] = respostas[`${req.method} ${req.url}`] ?? [404, {}];
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(resposta));
    });
  });
  await new Promise((pronto) => { servidor.listen(0, '127.0.0.1', pronto); });
  repositorio = criarRepositorio({
    baseUrl: `http://127.0.0.1:${servidor.address().port}`,
    tokenInterno: async () => 'token-interno',
  });
});

after(() => { servidor.close(); });

test('funcionário vem com hash e roles, enviando o token de serviço', async () => {
  const funcionario = await repositorio.buscarFuncionario('kaua@gmail.com');

  assert.deepEqual(funcionario, { username: 'kaua@gmail.com', senhaHash: '$2a$x', roles: ['ADMIN'] });
  assert.equal(recebidas.at(-1).autorizacao, 'Bearer token-interno');
});

test('funcionário sem role vem com lista vazia', async () => {
  assert.deepEqual((await repositorio.buscarFuncionario('semrole@oficina.com')).roles, []);
});

test('funcionário inexistente devolve null', async () => {
  assert.equal(await repositorio.buscarFuncionario('nao@existe.com'), null);
});

test('cliente vem com id, status e hash', async () => {
  assert.deepEqual(await repositorio.buscarClientePorCpf('52998224725'), { id: 7, status: 'ATIVO', senhaHash: '$2a$y' });
});

test('cliente inexistente devolve null', async () => {
  assert.equal(await repositorio.buscarClientePorCpf('71498053297'), null);
});

test('primeiro acesso envia e-mail e hash e devolve o id', async () => {
  const id = await repositorio.definirSenhaPrimeiroAcesso('52998224725', 'joao@email.com', '$2a$novo');

  assert.equal(id, 7);
  assert.equal(recebidas.at(-1).tipo, 'application/json');
  assert.deepEqual(JSON.parse(recebidas.at(-1).corpo), { email: 'joao@email.com', senhaHash: '$2a$novo' });
});

test('primeiro acesso recusado devolve null', async () => {
  assert.equal(await repositorio.definirSenhaPrimeiroAcesso('71498053297', 'x@email.com', '$2a$novo'), null);
});

test('erro do OS Service não vira credencial inválida: propaga', async () => {
  await assert.rejects(repositorio.buscarClientePorCpf('00000000000'), /respondeu 500/);
});
