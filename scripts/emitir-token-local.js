import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { criarTokens } from '../src/tokens.js';

const { values } = parseArgs({
  options: {
    sub: { type: 'string' },
    roles: { type: 'string', default: 'ADMIN' },
    chave: { type: 'string', default: '../fiap-15soat-oficina-api/src/main/resources/jwt.private.key' },
    issuer: { type: 'string', default: 'http://localhost:8080' },
    expira: { type: 'string', default: '3600' },
  },
});

if (!values.sub) {
  console.error('Uso: npm run token:local -- --sub <username ou id do cliente> [--roles ADMIN,RECEPCAO] [--chave caminho.pem]');
  process.exit(1);
}

const tokens = await criarTokens(readFileSync(values.chave, 'utf8'));
console.log(await tokens.emitir({
  sub: values.sub,
  roles: values.roles.split(','),
  expiraEmSegundos: Number(values.expira),
  issuer: values.issuer,
}));
