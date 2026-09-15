import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createLocalJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import { AUDIENCIA, criarTokens } from '../../src/tokens.js';

const ISSUER = 'https://abc123.execute-api.us-east-1.amazonaws.com';

function chavePem(tipo) {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: tipo, format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }).privateKey;
}

test('emite JWT RS256 verificável pelo JWKS publicado', async () => {
  const tokens = await criarTokens(chavePem('pkcs8'));

  const token = await tokens.emitir({ sub: '7', roles: ['CLIENTE'], expiraEmSegundos: 3600, issuer: ISSUER });
  const { payload } = await jwtVerify(token, createLocalJWKSet(tokens.jwks()), { issuer: ISSUER, audience: AUDIENCIA });

  assert.equal(payload.sub, '7');
  assert.deepEqual(payload.roles, ['CLIENTE']);
  assert.equal(payload.exp - payload.iat, 3600);
});

test('header e JWKS compartilham o mesmo kid', async () => {
  const tokens = await criarTokens(chavePem('pkcs8'));
  const token = await tokens.emitir({ sub: 'kaua@gmail.com', roles: ['ADMIN'], expiraEmSegundos: 60, issuer: ISSUER });

  const { alg, kid } = decodeProtectedHeader(token);
  const [chave] = tokens.jwks().keys;

  assert.equal(alg, 'RS256');
  assert.equal(kid, chave.kid);
  assert.equal(chave.use, 'sig');
  assert.equal(chave.d, undefined);
});

test('aceita chave privada em PKCS#1', async () => {
  const tokens = await criarTokens(chavePem('pkcs1'));
  assert.equal(tokens.jwks().keys.length, 1);
});
