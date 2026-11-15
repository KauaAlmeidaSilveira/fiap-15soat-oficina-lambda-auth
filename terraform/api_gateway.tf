locals {
  rotas_autenticacao = [
    "POST /auth/funcionario",
    "POST /auth/cliente",
    "POST /auth/cliente/primeiro-acesso",
  ]

  # Prefixos protegidos por JWT, por servico. Cada prefixo vira duas rotas (o prefixo exato e
  # "/{proxy+}"), porque {proxy+} exige ao menos um segmento depois do prefixo.
  # /internal/* fica de fora de proposito: so trafega dentro do cluster.
  prefixos_protegidos = {
    os       = ["/api/auth", "/api/clientes", "/api/veiculos", "/api/ordens-servico", "/api/minhas-ordens-servico"]
    execucao = ["/api/execucoes", "/api/produtos"]
    billing  = ["/api/orcamentos", "/api/pagamentos"]
  }

  rotas_protegidas = merge([
    for servico, prefixos in local.prefixos_protegidos : merge([
      for prefixo in prefixos : {
        "ANY ${prefixo}"          = servico
        "ANY ${prefixo}/{proxy+}" = servico
      }
    ]...)
  ]...)

  # Rotas sem token. O link de aprovacao carrega o proprio token (par "aprovacao"), e o webhook do
  # Mercado Pago so dispara a consulta da order na API do Mercado Pago, sem confiar no corpo.
  rotas_publicas = {
    "GET /aprovacao-os"           = "billing"
    "POST /webhooks/mercado-pago" = "billing"
    "GET /actuator/health"        = "os"
    "GET /swagger-ui.html"        = "os"
    "GET /swagger-ui/{proxy+}"    = "os"
    "GET /v3/api-docs"            = "os"
    "GET /v3/api-docs/{proxy+}"   = "os"
  }
}

resource "aws_apigatewayv2_api" "oficina" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.oficina.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.auth.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_security_group" "vpc_link" {
  name        = "${var.project_name}-api-vpc-link-sg"
  description = "ENIs do VPC Link do API Gateway ate os NLBs internos dos servicos"
  vpc_id      = data.aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [data.aws_vpc.main.cidr_block]
  }
}

resource "aws_apigatewayv2_vpc_link" "api" {
  name               = "${var.project_name}-api"
  subnet_ids         = data.aws_subnets.private.ids
  security_group_ids = [aws_security_group.vpc_link.id]
}

resource "aws_apigatewayv2_integration" "servico" {
  for_each           = local.servicos
  api_id             = aws_apigatewayv2_api.oficina.id
  integration_type   = "HTTP_PROXY"
  integration_method = "ANY"
  integration_uri    = data.aws_lb_listener.servico[each.key].arn
  connection_type    = "VPC_LINK"
  connection_id      = aws_apigatewayv2_vpc_link.api.id
}

# O issuer e a propria URL do Gateway: a Lambda publica discovery e JWKS nela.
#
# A AWS busca o /.well-known/openid-configuration NA CRIACAO do authorizer, nao so a cada
# requisicao, e a rota leva alguns segundos para comecar a responder depois que o stage publica.
# No primeiro apply desta infraestrutura o authorizer foi criado 1 segundo apos o stage e falhou
# com "Invalid issuer ... must have a valid discovery endpoint". Por isso a espera abaixo, alem
# das dependencias de rota, stage e permissao de invocacao da Lambda.
resource "time_sleep" "discovery_publicado" {
  depends_on = [
    aws_apigatewayv2_route.well_known,
    aws_apigatewayv2_stage.default,
    aws_lambda_permission.api_gateway,
  ]

  create_duration = "60s"
}

resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.oficina.id
  name             = "${var.project_name}-jwt"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    issuer   = aws_apigatewayv2_api.oficina.api_endpoint
    audience = ["oficina-api"]
  }

  depends_on = [time_sleep.discovery_publicado]
}

resource "aws_apigatewayv2_route" "autenticacao" {
  for_each  = toset(local.rotas_autenticacao)
  api_id    = aws_apigatewayv2_api.oficina.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "well_known" {
  api_id    = aws_apigatewayv2_api.oficina.id
  route_key = "GET /.well-known/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "publicas" {
  for_each  = local.rotas_publicas
  api_id    = aws_apigatewayv2_api.oficina.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.servico[each.value].id}"
}

# /actuator/prometheus propositalmente sem rota: o coletor do New Relic le de dentro do cluster.
resource "aws_apigatewayv2_route" "protegidas" {
  for_each           = local.rotas_protegidas
  api_id             = aws_apigatewayv2_api.oficina.id
  route_key          = each.key
  target             = "integrations/${aws_apigatewayv2_integration.servico[each.value].id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/apigateway/${var.project_name}-api"
  retention_in_days = 7
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.oficina.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_rate_limit  = 50
    throttling_burst_limit = 100
  }

  dynamic "route_settings" {
    for_each = toset(local.rotas_autenticacao)
    content {
      route_key              = route_settings.value
      throttling_rate_limit  = 5
      throttling_burst_limit = 10
    }
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api.arn
    format = jsonencode({
      requestId       = "$context.requestId"
      rota            = "$context.routeKey"
      status          = "$context.status"
      latenciaMs      = "$context.responseLatency"
      ip              = "$context.identity.sourceIp"
      erroAutorizador = "$context.authorizer.error"
    })
  }

  depends_on = [aws_apigatewayv2_route.autenticacao]
}
