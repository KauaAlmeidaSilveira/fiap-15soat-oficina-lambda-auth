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

# Um NLB interno por servico, criado pelo Service LoadBalancer de cada um (manifestos em k8s/ de
# cada repositorio), nao por Terraform: este repositorio so pode ser aplicado depois do deploy dos
# servicos. O Kubernetes marca cada NLB com a tag kubernetes.io/service-name = <namespace>/<service>.
locals {
  servicos = toset(["os", "execucao", "billing"])
}

data "aws_lb" "servico" {
  for_each = local.servicos
  tags = {
    "kubernetes.io/service-name" = "oficina/oficina-${each.key}"
  }
}

data "aws_lb_listener" "servico" {
  for_each          = local.servicos
  load_balancer_arn = data.aws_lb.servico[each.key].arn
  port              = 80
}
