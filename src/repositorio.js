const TEMPO_LIMITE_MS = 3_000;

export function criarRepositorio({ baseUrl, tokenInterno, fetch: chamar = globalThis.fetch }) {
  async function requisitar(caminho, opcoes = {}) {
    const resposta = await chamar(`${baseUrl}${caminho}`, {
      ...opcoes,
      headers: {
        authorization: `Bearer ${await tokenInterno()}`,
        ...(opcoes.body ? { 'content-type': 'application/json' } : {}),
      },
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    if (resposta.status === 404) return null;
    if (!resposta.ok) throw new Error(`OS Service respondeu ${resposta.status} em ${caminho}`);
    return resposta.json();
  }

  return {
    buscarFuncionario(username) {
      return requisitar(`/internal/auth/funcionarios?username=${encodeURIComponent(username)}`);
    },

    buscarClientePorCpf(cpf) {
      return requisitar(`/internal/auth/clientes/${encodeURIComponent(cpf)}`);
    },

    async definirSenhaPrimeiroAcesso(cpf, email, senhaHash) {
      const resposta = await requisitar(`/internal/auth/clientes/${encodeURIComponent(cpf)}/primeiro-acesso`, {
        method: 'POST',
        body: JSON.stringify({ email, senhaHash }),
      });
      return resposta === null ? null : resposta.id;
    },
  };
}
