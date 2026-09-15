terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
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
