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

variable "db_name" {
  description = "Nome do banco no RDS"
  type        = string
  default     = "oficina"
}

variable "db_username" {
  description = "Usuario do banco usado pela Lambda"
  type        = string
  default     = "oficina"
}

variable "db_password" {
  description = "Senha do banco (vai para o Secrets Manager, nunca para variavel de ambiente)"
  type        = string
  sensitive   = true
}

variable "jwt_private_key" {
  description = "Chave privada RSA em PEM - o mesmo par usado pela API"
  type        = string
  sensitive   = true
}

variable "pacote_lambda" {
  description = "Caminho do zip gerado por npm run empacotar"
  type        = string
  default     = "../dist/lambda.zip"
}
