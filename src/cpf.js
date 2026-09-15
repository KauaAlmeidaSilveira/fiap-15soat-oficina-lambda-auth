export function normalizarDocumento(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

function digitoVerificador(base) {
  const soma = [...base].reduce((acc, digito, i) => acc + Number(digito) * (base.length + 1 - i), 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cpfValido(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }
  return digitoVerificador(cpf.slice(0, 9)) === Number(cpf[9])
    && digitoVerificador(cpf.slice(0, 10)) === Number(cpf[10]);
}
