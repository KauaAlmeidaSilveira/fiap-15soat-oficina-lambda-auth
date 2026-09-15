import bcrypt from 'bcryptjs';

const CUSTO = 10;
const HASH_FICTICIO = bcrypt.hashSync('senha-ficticia-para-tempo-constante', CUSTO);

export const senhas = {
  gerarHash(senha) {
    return bcrypt.hash(senha, CUSTO);
  },

  async conferir(senha, hash) {
    const confere = await bcrypt.compare(senha, hash ?? HASH_FICTICIO);
    return hash != null && confere;
  },
};
