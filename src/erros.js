export class ErroHttp extends Error {
  constructor(status, titulo, detalhe) {
    super(detalhe);
    this.status = status;
    this.titulo = titulo;
    this.detalhe = detalhe;
  }
}
