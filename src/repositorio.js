import pg from 'pg';

export function criarPool({ host, database, user, password, ssl }) {
  return new pg.Pool({
    host,
    database,
    user,
    password,
    port: 5432,
    ssl,
    max: 1,
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 5_000,
  });
}

export function criarRepositorio(pool) {
  return {
    async buscarFuncionario(username) {
      const { rows } = await pool.query(
        `SELECT u.username,
                u.password AS senha_hash,
                COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
           FROM users u
           LEFT JOIN users_roles ur ON ur.user_id = u.id
           LEFT JOIN roles r ON r.role_id = ur.role_id
          WHERE u.username = $1
          GROUP BY u.id, u.username, u.password`,
        [username],
      );
      if (rows.length === 0) return null;
      return { username: rows[0].username, senhaHash: rows[0].senha_hash, roles: rows[0].roles };
    },

    async buscarClientePorCpf(cpf) {
      const { rows } = await pool.query(
        'SELECT id, status, senha_hash FROM cliente WHERE cpf_cnpj = $1',
        [cpf],
      );
      if (rows.length === 0) return null;
      return { id: Number(rows[0].id), status: rows[0].status, senhaHash: rows[0].senha_hash };
    },

    async definirSenhaPrimeiroAcesso(cpf, email, senhaHash) {
      const { rows } = await pool.query(
        `UPDATE cliente
            SET senha_hash = $1
          WHERE cpf_cnpj = $2
            AND status = 'ATIVO'
            AND lower(email) = lower($3)
            AND senha_hash IS NULL
         RETURNING id`,
        [senhaHash, cpf, email],
      );
      return rows.length === 0 ? null : Number(rows[0].id);
    },
  };
}
