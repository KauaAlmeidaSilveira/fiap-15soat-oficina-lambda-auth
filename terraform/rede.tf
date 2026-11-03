data "aws_caller_identity" "current" {}

# Descoberta por convencao de nomes e tags, sem terraform_remote_state - mesmo padrao do infra-db.
data "aws_vpc" "main" {
  filter {
    name   = "tag:Name"
    values = ["${var.project_name}-vpc"]
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }

  filter {
    name   = "tag:Name"
    values = ["${var.project_name}-vpc-private-*"]
  }
}

# Criado pelo Service do Kubernetes (k8s/service.yaml na API), nao por Terraform:
# este repositorio so pode ser aplicado depois do primeiro deploy da API.
data "aws_lb" "api" {
  tags = {
    "kubernetes.io/service-name" = "oficina/oficina-api"
  }
}

data "aws_lb_listener" "api" {
  load_balancer_arn = data.aws_lb.api.arn
  port              = 80
}
