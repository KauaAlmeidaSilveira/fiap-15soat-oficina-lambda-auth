resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-auth-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Logs no CloudWatch e criacao das ENIs na VPC.
resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "lambda_segredo" {
  name = "segredo-auth"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = aws_secretsmanager_secret.auth.arn
    }]
  })
}

locals {
  # Sem valor em os_internal_url, a Lambda fala com o NLB interno do OS.
  os_internal_url = coalesce(var.os_internal_url, "http://${data.aws_lb.servico["os"].dns_name}")
}

resource "aws_security_group" "lambda" {
  name        = "${var.project_name}-auth-lambda-sg"
  description = "Lambda de autenticacao: so trafego de saida (OS Service e Secrets Manager via NAT)"
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
  role             = aws_iam_role.lambda.arn
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
      OS_INTERNAL_URL = local.os_internal_url
      SECRET_ID       = aws_secretsmanager_secret.auth.arn
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda,
    aws_secretsmanager_secret_version.auth,
    aws_iam_role_policy_attachment.lambda_vpc,
    aws_iam_role_policy.lambda_segredo,
  ]
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.oficina.execution_arn}/*/*"
}
