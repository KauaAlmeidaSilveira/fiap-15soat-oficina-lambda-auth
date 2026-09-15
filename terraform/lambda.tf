locals {
  lab_role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/LabRole"
}

resource "aws_security_group" "lambda" {
  name        = "${var.project_name}-auth-lambda-sg"
  description = "Lambda de autenticacao: so trafego de saida (RDS e Secrets Manager via NAT)"
  vpc_id      = data.aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.project_name}-auth"
  retention_in_days = 7
}

resource "aws_lambda_function" "auth" {
  function_name    = "${var.project_name}-auth"
  role             = local.lab_role_arn
  runtime          = "nodejs22.x"
  handler          = "src/handler.handler"
  filename         = var.pacote_lambda
  source_code_hash = filebase64sha256(var.pacote_lambda)
  memory_size      = 512
  timeout          = 10

  vpc_config {
    subnet_ids         = data.aws_subnets.private.ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DB_HOST   = data.aws_db_instance.oficina.address
      DB_NAME   = var.db_name
      DB_USER   = var.db_username
      SECRET_ID = aws_secretsmanager_secret.auth.arn
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda, aws_secretsmanager_secret_version.auth]
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.oficina.execution_arn}/*/*"
}
