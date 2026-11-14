import { criarAutenticacao } from './autenticacao.js';
import { ErroHttp } from './erros.js';
import { criarRepositorio } from './repositorio.js';
import { lerSegredos } from './segredos.js';
import { senhas } from './senhas.js';
import { criarTokens } from './tokens.js';

const ROTAS_AUTENTICACAO = {
  'POST /auth/funcionario': { metodo: 'loginFuncionario', status: 200 },
  'POST /auth/cliente': { metodo: 'loginCliente', status: 200 },
  'POST /auth/cliente/primeiro-acesso': { metodo: 'primeiroAcesso', status: 201 },
};

function json(status, corpo, tipo = 'application/json') {
  return { statusCode: status, headers: { 'content-type': tipo }, body: JSON.stringify(corpo) };
}

function problema(status, titulo, detalhe) {
  return json(status, {
    type: 'about:blank', title: titulo, status, detail: detalhe, timestamp: new Date().toISOString(),
  }, 'application/problem+json');
}

function lerCorpo(event) {
  if (!event.body) return null;
  const texto = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  try {
    return JSON.parse(texto);
  } catch {
    throw new ErroHttp(400, 'Erro de validação', 'O corpo da requisição não é um JSON válido.');
  }
}

function log(nivel, dados) {
  console.log(JSON.stringify({ nivel, timestamp: new Date().toISOString(), ...dados }));
}

async function responder(event, dependencias, issuer) {
  const rotaAutenticacao = ROTAS_AUTENTICACAO[event.routeKey];
  if (rotaAutenticacao) {
    const { autenticacao } = await dependencias();
    const resultado = await autenticacao[rotaAutenticacao.metodo](lerCorpo(event), issuer);
    return json(rotaAutenticacao.status, resultado);
  }
  if (event.routeKey === 'GET /.well-known/{proxy+}') {
    if (event.rawPath === '/.well-known/openid-configuration') {
      return json(200, {
        issuer,
        jwks_uri: `${issuer}/.well-known/jwks.json`,
        id_token_signing_alg_values_supported: ['RS256'],
        response_types_supported: ['token'],
        subject_types_supported: ['public'],
      });
    }
    if (event.rawPath === '/.well-known/jwks.json') {
      const { tokens } = await dependencias();
      return json(200, tokens.jwks());
    }
  }
  return problema(404, 'Recurso não encontrado', 'Rota não encontrada.');
}

export function criarHandler(dependencias) {
  return async (event) => {
    const inicio = Date.now();
    const issuer = `https://${event.requestContext.domainName}`;
    const correlationId = event.headers?.['x-correlation-id'];
    let resposta;
    try {
      resposta = await responder(event, dependencias, issuer);
    } catch (erro) {
      if (erro instanceof ErroHttp) {
        resposta = problema(erro.status, erro.titulo, erro.detalhe);
      } else {
        log('ERROR', { mensagem: 'falha inesperada', rota: event.routeKey, correlationId, erro: erro.message });
        resposta = problema(500, 'Erro interno', 'Não foi possível processar a requisição.');
      }
    }
    log('INFO', {
      mensagem: 'requisicao', rota: event.routeKey, status: resposta.statusCode, correlationId, duracaoMs: Date.now() - inicio,
    });
    return resposta;
  };
}

let dependenciasDeProducao;

async function carregarDependenciasDeProducao() {
  if (!dependenciasDeProducao) {
    dependenciasDeProducao = (async () => {
      const { jwtPrivateKey } = await lerSegredos(process.env.SECRET_ID);
      const tokens = await criarTokens(jwtPrivateKey);
      const repositorio = criarRepositorio({ baseUrl: process.env.OS_INTERNAL_URL, tokenInterno: () => tokens.emitirInterno() });
      const autenticacao = criarAutenticacao({ repositorio, senhas, tokens });
      return { autenticacao, tokens };
    })().catch((erro) => {
      dependenciasDeProducao = undefined;
      throw erro;
    });
  }
  return dependenciasDeProducao;
}

export const handler = criarHandler(carregarDependenciasDeProducao);
