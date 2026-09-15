import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarHandler } from '../../src/handler.js';
import { ErroHttp } from '../../src/erros.js';

const DOMINIO = 'abc123.execute-api.us-east-1.amazonaws.com';

function evento(routeKey, corpo, extras = {}) {
  return {
    routeKey,
    headers: { 'x-correlation-id': 'rastreio-1' },
    requestContext: { domainName: DOMINIO },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    isBase64Encoded: false,
    ...extras,
  };
}

function montar(autenticacao = {}) {
  const recebidos = [];
  const registrar = (nome, resposta) => async (corpo, issuer) => {
    recebidos.push({ nome, corpo, issuer });
    if (resposta instanceof Error) throw resposta;
    return resposta;
  };
  const dependencias = {
    autenticacao: {
      loginFuncionario: registrar('loginFuncionario', autenticacao.loginFuncionario ?? { token: 't', expiresIn: 28800 }),
      loginCliente: registrar('loginCliente', autenticacao.loginCliente ?? { token: 't', expiresIn: 3600 }),
      primeiroAcesso: registrar('primeiroAcesso', autenticacao.primeiroAcesso ?? { token: 't', expiresIn: 3600 }),
    },
    tokens: { jwks: () => ({ keys: [{ kid: 'k1' }] }) },
  };
  return { handler: criarHandler(async () => dependencias), recebidos };
}

test('POST /auth/funcionario responde 200 e repassa corpo e issuer', async () => {
  const { handler, recebidos } = montar();

  const resposta = await handler(evento('POST /auth/funcionario', { username: 'a', senha: 'b' }));

  assert.equal(resposta.statusCode, 200);
  assert.deepEqual(JSON.parse(resposta.body), { token: 't', expiresIn: 28800 });
  assert.deepEqual(recebidos[0], { nome: 'loginFuncionario', corpo: { username: 'a', senha: 'b' }, issuer: `https://${DOMINIO}` });
});

test('POST /auth/cliente responde 200', async () => {
  const { handler } = montar();
  assert.equal((await handler(evento('POST /auth/cliente', { cpf: '1', senha: '2' }))).statusCode, 200);
});

test('POST /auth/cliente/primeiro-acesso responde 201', async () => {
  const { handler } = montar();
  assert.equal((await handler(evento('POST /auth/cliente/primeiro-acesso', { cpf: '1' }))).statusCode, 201);
});

test('corpo em base64 é decodificado', async () => {
  const { handler, recebidos } = montar();
  const corpo = Buffer.from(JSON.stringify({ username: 'a', senha: 'b' })).toString('base64');

  await handler(evento('POST /auth/funcionario', undefined, { body: corpo, isBase64Encoded: true }));

  assert.deepEqual(recebidos[0].corpo, { username: 'a', senha: 'b' });
});

test('ErroHttp vira problem+json com o status do erro', async () => {
  const { handler } = montar({ loginCliente: new ErroHttp(401, 'Credenciais inválidas', 'CPF ou senha inválidos.') });

  const resposta = await handler(evento('POST /auth/cliente', { cpf: '1', senha: '2' }));

  assert.equal(resposta.statusCode, 401);
  assert.equal(resposta.headers['content-type'], 'application/problem+json');
  const problema = JSON.parse(resposta.body);
  assert.equal(problema.status, 401);
  assert.equal(problema.title, 'Credenciais inválidas');
  assert.equal(problema.detail, 'CPF ou senha inválidos.');
  assert.ok(problema.timestamp);
});

test('JSON malformado responde 400', async () => {
  const { handler } = montar();
  const resposta = await handler(evento('POST /auth/cliente', undefined, { body: '{nao-e-json' }));
  assert.equal(resposta.statusCode, 400);
});

test('erro inesperado responde 500 sem vazar a mensagem interna', async () => {
  const { handler } = montar({ loginCliente: new Error('connection refused 10.0.1.5') });

  const resposta = await handler(evento('POST /auth/cliente', { cpf: '1', senha: '2' }));

  assert.equal(resposta.statusCode, 500);
  assert.doesNotMatch(resposta.body, /10\.0\.1\.5/);
});

test('rota desconhecida responde 404', async () => {
  const { handler } = montar();
  assert.equal((await handler(evento('GET /auth/qualquer'))).statusCode, 404);
});

test('discovery usa o domínio da requisição como issuer', async () => {
  const { handler } = montar();

  const resposta = await handler(evento('GET /.well-known/{proxy+}', undefined, { rawPath: '/.well-known/openid-configuration' }));

  const documento = JSON.parse(resposta.body);
  assert.equal(resposta.statusCode, 200);
  assert.equal(documento.issuer, `https://${DOMINIO}`);
  assert.equal(documento.jwks_uri, `https://${DOMINIO}/.well-known/jwks.json`);
});

test('jwks.json devolve as chaves públicas', async () => {
  const { handler } = montar();

  const resposta = await handler(evento('GET /.well-known/{proxy+}', undefined, { rawPath: '/.well-known/jwks.json' }));

  assert.equal(resposta.statusCode, 200);
  assert.deepEqual(JSON.parse(resposta.body), { keys: [{ kid: 'k1' }] });
});
