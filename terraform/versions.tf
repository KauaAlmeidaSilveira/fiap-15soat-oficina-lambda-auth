terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }

    # Usado so para dar margem de propagacao entre publicar a rota do discovery
    # e criar o authorizer (ver api_gateway.tf).
    time = {
      source  = "hashicorp/time"
      version = "~> 0.11"
    }
  }

  backend "s3" {
    bucket         = "fiap-15soat-oficina-tfstate"
    key            = "lambda-auth/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "fiap-15soat-oficina-tflock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
}
