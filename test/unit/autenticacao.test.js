import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { criarAutenticacao } from '../../src/autenticacao.js';
import { ErroHttp } from '../../src/erros.js';

const ISSUER = 'https://abc123.execute-api.us-east-1.amazonaws.com';
const CPF = '52998224725';

function montar({ funcionario = null, cliente = null, idPrimeiroAcesso = null } = {}) {
  const chamadas = { conferir: [], emitir: [], definirSenha: [] };
  const repositorio = {
    buscarFuncionario: async (username) => (funcionario && funcionario.username === username ? funcionario : null),
    buscarClientePorCpf: async (cpf) => (cliente && cpf === CPF ? cliente : null),
    definirSenhaPrimeiroAcesso: async (cpf, email, hash) => {
      chamadas.definirSenha.push({ cpf, email, hash });
      return idPrimeiroAcesso;
    },
  };
  const senhas = {
    conferir: async (senha, hash) => {
      chamadas.conferir.push({ senha, hash });
      return hash !== null && hash === `hash:${senha}`;
    },
    gerarHash: async (senha) => `hash:${senha}`,
  };
  const tokens = {
    emitir: async (claims) => {
      chamadas.emitir.push(claims);
      return 'token-assinado';
    },
  };
  return { autenticacao: criarAutenticacao({ repositorio, senhas, tokens }), chamadas };
}

async function assertErro(promessa, status) {
  await assert.rejects(promessa, (erro) => erro instanceof ErroHttp && erro.status === status);
}

describe('loginFuncionario', () => {
  const funcionario = { username: 'kaua@gmail.com', senhaHash: 'hash:Admin@123', roles: ['ADMIN'] };

  test('emite token de 8 h com as roles do banco e username normalizado', async () => {
    const { autenticacao, chamadas } = montar({ funcionario });

    const resultado = await autenticacao.loginFuncionario({ username: '  Kaua@Gmail.com ', senha: 'Admin@123' }, ISSUER);

    assert.deepEqual(resultado, { token: 'token-assinado', expiresIn: 28800 });
    assert.deepEqual(chamadas.emitir[0], { sub: 'kaua@gmail.com', roles: ['ADMIN'], expiraEmSegundos: 28800, issuer: ISSUER });
  });

  test('senha errada responde 401', async () => {
    const { autenticacao } = montar({ funcionario });
    await assertErro(autenticacao.loginFuncionario({ username: 'kaua@gmail.com', senha: 'errada' }, ISSUER), 401);
  });

  test('usuário inexistente responde 401 e ainda executa a comparação de senha', async () => {
    const { autenticacao, chamadas } = montar({ funcionario });
    await assertErro(autenticacao.loginFuncionario({ username: 'nao@existe.com', senha: 'x' }, ISSUER), 401);
    assert.equal(chamadas.conferir.length, 1);
    assert.equal(chamadas.conferir[0].hash, null);
  });

  test('corpo sem username ou senha responde 400', async () => {
    const { autenticacao } = montar({ funcionario });
    await assertErro(autenticacao.loginFuncionario({ senha: 'x' }, ISSUER), 400);
    await assertErro(autenticacao.loginFuncionario({ username: 'kaua@gmail.com' }, ISSUER), 400);
    await assertErro(autenticacao.loginFuncionario(null, ISSUER), 400);
  });
});

describe('loginCliente', () => {
  const clienteAtivo = { id: 7, status: 'ATIVO', senhaHash: 'hash:Cliente@123' };

  test('emite token de 1 h com role CLIENTE e sub igual ao id', async () => {
    const { autenticacao, chamadas } = montar({ cliente: clienteAtivo });

    const resultado = await autenticacao.loginCliente({ cpf: '529.982.247-25', senha: 'Cliente@123' }, ISSUER);

    assert.deepEqual(resultado, { token: 'token-assinado', expiresIn: 3600 });
    assert.deepEqual(chamadas.emitir[0], { sub: '7', roles: ['CLIENTE'], expiraEmSegundos: 3600, issuer: ISSUER });
  });

  test('CPF com dígito verificador inválido responde 400', async () => {
    const { autenticacao } = montar({ cliente: clienteAtivo });
    await assertErro(autenticacao.loginCliente({ cpf: '12345678901', senha: 'x' }, ISSUER), 400);
  });

  test('CNPJ responde 400 com mensagem própria', async () => {
    const { autenticacao } = montar({ cliente: clienteAtivo });
    await assert.rejects(
      autenticacao.loginCliente({ cpf: '12.345.678/0001-99', senha: 'x' }, ISSUER),
      (erro) => erro.status === 400 && /apenas para CPF/.test(erro.detalhe),
    );
  });

  test('cliente inexistente, sem senha e senha errada respondem o mesmo 401', async () => {
    const inexistente = montar();
    const semSenha = montar({ cliente: { ...clienteAtivo, senhaHash: null } });
    const senhaErrada = montar({ cliente: clienteAtivo });

    const erros = [];
    for (const [{ autenticacao }, senha] of [[inexistente, 'Cliente@123'], [semSenha, 'Cliente@123'], [senhaErrada, 'errada']]) {
      await autenticacao.loginCliente({ cpf: CPF, senha }, ISSUER).catch((e) => erros.push(e));
    }

    assert.equal(erros.length, 3);
    assert.ok(erros.every((e) => e.status === 401 && e.detalhe === erros[0].detalhe));
  });

  test('cliente inativo com senha correta responde 403', async () => {
    const { autenticacao } = montar({ cliente: { ...clienteAtivo, status: 'INATIVO' } });
    await assertErro(autenticacao.loginCliente({ cpf: CPF, senha: 'Cliente@123' }, ISSUER), 403);
  });

  test('cliente inativo com senha errada responde 401, sem revelar o status', async () => {
    const { autenticacao } = montar({ cliente: { ...clienteAtivo, status: 'INATIVO' } });
    await assertErro(autenticacao.loginCliente({ cpf: CPF, senha: 'errada' }, ISSUER), 401);
  });
});

describe('primeiroAcesso', () => {
  test('grava o hash e devolve token do cliente', async () => {
    const { autenticacao, chamadas } = montar({ idPrimeiroAcesso: 7 });

    const resultado = await autenticacao.primeiroAcesso({ cpf: '529.982.247-25', email: 'joao@email.com', senha: 'Cliente@123' }, ISSUER);

    assert.deepEqual(resultado, { token: 'token-assinado', expiresIn: 3600 });
    assert.deepEqual(chamadas.definirSenha[0], { cpf: CPF, email: 'joao@email.com', hash: 'hash:Cliente@123' });
    assert.deepEqual(chamadas.emitir[0], { sub: '7', roles: ['CLIENTE'], expiraEmSegundos: 3600, issuer: ISSUER });
  });

  test('senha com menos de 8 caracteres responde 400 sem tocar no banco', async () => {
    const { autenticacao, chamadas } = montar({ idPrimeiroAcesso: 7 });
    await assertErro(autenticacao.primeiroAcesso({ cpf: CPF, email: 'joao@email.com', senha: 'curta' }, ISSUER), 400);
    assert.equal(chamadas.definirSenha.length, 0);
  });

  test('CPF inválido ou e-mail ausente responde 400', async () => {
    const { autenticacao } = montar({ idPrimeiroAcesso: 7 });
    await assertErro(autenticacao.primeiroAcesso({ cpf: '12345678901', email: 'joao@email.com', senha: 'Cliente@123' }, ISSUER), 400);
    await assertErro(autenticacao.primeiroAcesso({ cpf: CPF, senha: 'Cliente@123' }, ISSUER), 400);
  });

  test('nenhuma linha atualizada responde 422 genérico', async () => {
    const { autenticacao, chamadas } = montar({ idPrimeiroAcesso: null });
    await assertErro(autenticacao.primeiroAcesso({ cpf: CPF, email: 'outro@email.com', senha: 'Cliente@123' }, ISSUER), 422);
    assert.equal(chamadas.emitir.length, 0);
  });
});
