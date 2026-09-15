import { cpfValido, normalizarDocumento } from './cpf.js';
import { ErroHttp } from './erros.js';

const EXPIRACAO_FUNCIONARIO = 28800;
const EXPIRACAO_CLIENTE = 3600;
const TAMANHO_MINIMO_SENHA = 8;

function textoPreenchido(valor) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function dadosInvalidos(detalhe) {
  return new ErroHttp(400, 'Dados inválidos', detalhe);
}

function exigirCpf(valor) {
  const documento = normalizarDocumento(valor);
  if (documento.length === 14) {
    throw dadosInvalidos('Login disponível apenas para CPF.');
  }
  if (!cpfValido(documento)) {
    throw dadosInvalidos('CPF inválido.');
  }
  return documento;
}

export function criarAutenticacao({ repositorio, senhas, tokens }) {
  async function tokenDoCliente(id, issuer) {
    const token = await tokens.emitir({ sub: String(id), roles: ['CLIENTE'], expiraEmSegundos: EXPIRACAO_CLIENTE, issuer });
    return { token, expiresIn: EXPIRACAO_CLIENTE };
  }

  return {
    async loginFuncionario(corpo, issuer) {
      if (!textoPreenchido(corpo?.username) || !textoPreenchido(corpo?.senha)) {
        throw dadosInvalidos('Informe username e senha.');
      }
      const username = corpo.username.trim().toLowerCase();
      const funcionario = await repositorio.buscarFuncionario(username);
      const senhaConfere = await senhas.conferir(corpo.senha, funcionario?.senhaHash ?? null);
      if (!funcionario || !senhaConfere) {
        throw new ErroHttp(401, 'Credenciais inválidas', 'Usuário ou senha inválidos.');
      }
      const token = await tokens.emitir({
        sub: funcionario.username, roles: funcionario.roles, expiraEmSegundos: EXPIRACAO_FUNCIONARIO, issuer,
      });
      return { token, expiresIn: EXPIRACAO_FUNCIONARIO };
    },

    async loginCliente(corpo, issuer) {
      if (!textoPreenchido(corpo?.senha)) {
        throw dadosInvalidos('Informe CPF e senha.');
      }
      const cpf = exigirCpf(corpo.cpf);
      const cliente = await repositorio.buscarClientePorCpf(cpf);
      const senhaConfere = await senhas.conferir(corpo.senha, cliente?.senhaHash ?? null);
      if (!cliente || !senhaConfere) {
        throw new ErroHttp(401, 'Credenciais inválidas', 'CPF ou senha inválidos.');
      }
      if (cliente.status !== 'ATIVO') {
        throw new ErroHttp(403, 'Cliente inativo', 'Cliente inativo. Procure a oficina.');
      }
      return tokenDoCliente(cliente.id, issuer);
    },

    async primeiroAcesso(corpo, issuer) {
      if (!textoPreenchido(corpo?.email)) {
        throw dadosInvalidos('Informe CPF, e-mail e senha.');
      }
      if (typeof corpo.senha !== 'string' || corpo.senha.length < TAMANHO_MINIMO_SENHA) {
        throw dadosInvalidos(`A senha deve ter no mínimo ${TAMANHO_MINIMO_SENHA} caracteres.`);
      }
      const cpf = exigirCpf(corpo.cpf);
      const hash = await senhas.gerarHash(corpo.senha);
      const id = await repositorio.definirSenhaPrimeiroAcesso(cpf, corpo.email.trim(), hash);
      if (id === null) {
        throw new ErroHttp(422, 'Primeiro acesso não concluído',
          'Não foi possível concluir o primeiro acesso. Verifique os dados informados ou procure a oficina.');
      }
      return tokenDoCliente(id, issuer);
    },
  };
}
