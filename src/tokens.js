import { createPrivateKey, createPublicKey } from 'node:crypto';
import { SignJWT, calculateJwkThumbprint, exportJWK } from 'jose';

export const AUDIENCIA = 'oficina-api';
export const AUDIENCIA_INTERNA = 'oficina-os';
export const EMISSOR_INTERNO = 'oficina-lambda-auth';
const VALIDADE_INTERNA_SEGUNDOS = 60;

export async function criarTokens(chavePrivadaPem) {
  const chavePrivada = createPrivateKey(chavePrivadaPem);
  const jwkPublico = await exportJWK(createPublicKey(chavePrivada));
  const kid = await calculateJwkThumbprint(jwkPublico);
  const jwks = { keys: [{ ...jwkPublico, kid, alg: 'RS256', use: 'sig' }] };

  return {
    jwks: () => jwks,

    emitir({ sub, roles, expiraEmSegundos, issuer }) {
      const agora = Math.floor(Date.now() / 1000);
      return new SignJWT({ roles })
        .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid })
        .setIssuer(issuer)
        .setAudience(AUDIENCIA)
        .setSubject(sub)
        .setIssuedAt(agora)
        .setExpirationTime(agora + expiraEmSegundos)
        .sign(chavePrivada);
    },

    emitirInterno() {
      const agora = Math.floor(Date.now() / 1000);
      return new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid })
        .setIssuer(EMISSOR_INTERNO)
        .setAudience(AUDIENCIA_INTERNA)
        .setSubject(EMISSOR_INTERNO)
        .setIssuedAt(agora)
        .setExpirationTime(agora + VALIDADE_INTERNA_SEGUNDOS)
        .sign(chavePrivada);
    },
  };
}
