variable "aws_region" {
  description = "Regiao AWS"
  type        = string
  default     = "us-east-1"
}

# ATENCAO: precisa ser identico em fiap-15soat-oficina-infra-k8s e fiap-15soat-oficina-infra-db.
variable "project_name" {
  description = "Prefixo de nome dos recursos. Contrato compartilhado entre os repositorios."
  type        = string
  default     = "oficina"
}

variable "os_internal_url" {
  description = "URL interna do OS Service, que responde as rotas /internal/auth/*"
  type        = string
}

variable "jwt_private_key" {
  description = "Chave privada RSA em PEM - os servicos Java so recebem a chave publica"
  type        = string
  sensitive   = true
}

variable "pacote_lambda" {
  description = "Caminho do zip gerado por npm run empacotar"
  type        = string
  default     = "../dist/lambda.zip"
}
