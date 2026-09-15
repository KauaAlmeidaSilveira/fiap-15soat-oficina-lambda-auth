import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

let cache;

export async function lerSegredos(secretId, cliente = new SecretsManagerClient({})) {
  if (!cache) {
    const resposta = await cliente.send(new GetSecretValueCommand({ SecretId: secretId }));
    cache = JSON.parse(resposta.SecretString);
  }
  return cache;
}
