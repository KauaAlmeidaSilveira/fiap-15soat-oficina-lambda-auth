output "api_gateway_url" {
  description = "URL publica do Gateway. Usar no secret APP_PUBLIC_BASE_URL da API (emissor dos tokens e links de aprovacao)."
  value       = aws_apigatewayv2_api.oficina.api_endpoint
}

output "lambda_function_name" {
  value = aws_lambda_function.auth.function_name
}
