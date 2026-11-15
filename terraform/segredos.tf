resource "aws_secretsmanager_secret" "auth" {
  name = "${var.project_name}/auth"
  # Sem janela de recuperacao: o ambiente e destruido e recriado a cada uso, e um segredo
  # "agendado para exclusao" bloquearia a recriacao com o mesmo nome.
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "auth" {
  secret_id = aws_secretsmanager_secret.auth.id
  secret_string = jsonencode({
    jwtPrivateKey = var.jwt_private_key
  })
}
