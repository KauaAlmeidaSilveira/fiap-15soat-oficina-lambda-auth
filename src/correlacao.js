import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export const CABECALHO = 'x-correlation-id';

// O repositório é criado uma vez por container e reaproveitado; o id de correlação é por requisição.
const contexto = new AsyncLocalStorage();

export function executarComCorrelacao(recebido, funcao) {
  const correlationId = recebido?.trim() || randomUUID();
  return contexto.run(correlationId, () => funcao(correlationId));
}

export function correlationIdAtual() {
  return contexto.getStore();
}
