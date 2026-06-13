output "cluster_name" { value = module.eks.cluster_name }
output "ecr_repo_url" { value = aws_ecr_repository.app.repository_url }
output "region"       { value = var.region }
