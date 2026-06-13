# 🚀 Production-Grade AWS EKS CI/CD Platform

> A fully automated DevOps pipeline — from code commit to live deployment on Kubernetes, with real-time monitoring.

![AWS](https://img.shields.io/badge/AWS-EKS-orange?logo=amazonaws)
![Terraform](https://img.shields.io/badge/IaC-Terraform-purple?logo=terraform)
![Kubernetes](https://img.shields.io/badge/Orchestration-Kubernetes-blue?logo=kubernetes)
![GitHub Actions](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-black?logo=githubactions)
![Helm](https://img.shields.io/badge/Monitoring-Prometheus%20%2B%20Grafana-red?logo=helm)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring](#monitoring)
- [Auto Scaling](#auto-scaling)
- [Rollback Strategy](#rollback-strategy)
- [Cleanup](#cleanup)

---

## Overview

This project demonstrates a **production-ready DevOps platform** built on AWS, designed to simulate how real companies ship and operate containerized applications at scale.

**What happens on every `git push` to `main`:**

```
Code Push → GitHub Actions → Docker Build → ECR Push → EKS Rolling Deploy
```

**Key capabilities:**
- Zero-downtime rolling deployments with automatic rollback on failure
- Horizontal pod autoscaling based on CPU utilization
- Full cluster observability via Prometheus + Grafana
- Infrastructure provisioned entirely as code using Terraform

---

## Architecture

<img width="1072" height="568" alt="image" src="https://github.com/user-attachments/assets/e1fc146b-7f44-44a1-9a17-c8f072bcef7e" />


## Tech Stack

|       Layer      |       Technology      |           Purpose                  |
|------------------|-----------------------|------------------------------------|
| App              | Node.js + Express     | E-commerce web application         |
| Containerization | Docker                | Image build + packaging            |
| Registry         | Amazon ECR            | Private container image store      |
| Infrastructure   | Terraform             | VPC, EKS cluster, ECR provisioning |
| Orchestration    | Kubernetes (EKS 1.30) | Container scheduling + management  |
| CI/CD            | GitHub Actions        | Automated build, push, deploy      |
| Autoscaling      | HPA                   | Scale pods 2–6 based on CPU        |
| Monitoring       | Prometheus + Grafana  | Metrics collection + dashboards    |
| OS               | RHEL 10               | Workstation / build machine        |
| Region           | ap-south-1 (Mumbai)   | AWS deployment region              |


## Project Structure

```
eks-cicd-platform/
├── app/
│   ├── server.js          # Express app (/, /health endpoints)
│   ├── package.json       # Node.js dependencies
│   └── Dockerfile         # Multi-stage container build
├── k8s/
│   ├── deployment.yaml    # K8s Deployment (rolling update strategy)
│   ├── service.yaml       # LoadBalancer Service (port 80 → 3000)
│   └── hpa.yaml           # HorizontalPodAutoscaler (2–6 replicas)
├── terraform/
│   ├── providers.tf       # AWS provider config
│   ├── variables.tf       # Region, cluster name, ECR repo
│   ├── vpc.tf             # VPC, subnets, NAT gateway
│   ├── eks.tf             # EKS cluster + managed node group
│   ├── ecr.tf             # ECR repository
│   └── outputs.tf         # Cluster name, ECR URL, region
└── .github/
    └── workflows/
        └── deploy.yml     # Full CI/CD pipeline definition
```


## Prerequisites

|   Tool    | Version Used |
|-----------|--------------|
| Git       | 2.52.0       |
| Docker    | 29.5.2       |
| AWS CLI   | 2.27.0       |
| kubectl   | v1.36.1      |
| Terraform | v1.15.5      |
| eksctl    | 0.227.0      |
| Helm      | v4.1.1       |
| Node.js   | v22.22.0     |



## Getting Started

### 1. Configure AWS credentials

```bash
aws configure
# Region: ap-south-1
aws sts get-caller-identity   # verify
```

### 2. Provision infrastructure

```bash
cd terraform
terraform init
terraform apply -auto-approve   # ~15–20 min
```

### 3. Connect kubectl to the cluster

```bash
aws eks update-kubeconfig --region ap-south-1 --name ecommerce-eks
kubectl get nodes   # should show 2 Ready nodes
```

### 4. Build and push the app image

```bash
ECR_URL=$(terraform output -raw ecr_repo_url)

aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin \
  986552987314.dkr.ecr.ap-south-1.amazonaws.com

cd ../app
docker build -t ecommerce-app:v1 .
docker tag ecommerce-app:v1 $ECR_URL:latest
docker push $ECR_URL:latest
```

### 5. Deploy to Kubernetes

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml

kubectl get svc ecommerce-service   # get LoadBalancer URL
```

### 6. Add GitHub Secrets

In your repo: **Settings → Secrets → Actions**, add:

|        Secret           |       Value         |
|-------------------------|---------------------|
| `AWS_ACCESS_KEY_ID`     | Your IAM access key |
| `AWS_SECRET_ACCESS_KEY` | Your IAM secret key |

From this point, every push to `main` automatically builds and deploys.

---

## CI/CD Pipeline

The pipeline defined in `.github/workflows/deploy.yml` runs on every push to `main`:

```
1. Checkout code
2. Configure AWS credentials
3. Login to Amazon ECR
4. Docker build + tag with git SHA + push
5. Update kubeconfig
6. kubectl set image → rolling deploy
7. kubectl rollout status (wait for healthy)
8. Auto rollback if any step fails
```

**To trigger a deploy:**

```bash
git add .
git commit -m "your change"
git push
```

Watch it live at: `https://github.com/gokul-s05/eks-cicd-platform/actions`

---

## Monitoring

Prometheus + Grafana installed via the `kube-prometheus-stack` Helm chart.

```bash
# Install
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack -n monitoring

# Access Grafana
kubectl get secret -n monitoring monitoring-grafana \
  -o jsonpath="{.data.admin-password}" | base64 --decode

kubectl port-forward -n monitoring svc/monitoring-grafana 19090:80
# Open http://localhost:19090  (admin / <password above>)
```

**Pre-built dashboards available:**
- Kubernetes / Compute Resources / Cluster
- Kubernetes / Compute Resources / Node
- Kubernetes / Compute Resources / Pod

---

## Auto Scaling

HPA scales pods between **2 and 6 replicas** when average CPU exceeds 50%.

```bash
kubectl get hpa          # current replica count + CPU %
kubectl top pods         # live resource usage
```

Node-level scaling is handled by the EKS managed node group (2–4 nodes, `t3.medium`).

---

## Rollback Strategy

**Automatic:** The GitHub Actions workflow rolls back on any pipeline failure:

```yaml
- name: Rollback on failure
  if: failure()
  run: kubectl rollout undo deployment/ecommerce-app
```

**Manual rollback:**

```bash
kubectl rollout history deployment/ecommerce-app   # view history
kubectl rollout undo deployment/ecommerce-app       # roll back one version
kubectl rollout undo deployment/ecommerce-app --to-revision=2  # specific version
```

The deployment uses `maxUnavailable: 0` — old pods stay up until new ones pass health checks, guaranteeing zero downtime.

---

## Cleanup

⚠️ EKS + NAT Gateway + LoadBalancer incur ongoing AWS charges. Destroy when done:

```bash
kubectl delete -f k8s/
helm uninstall monitoring -n monitoring
kubectl delete namespace monitoring

cd terraform
terraform destroy -auto-approve   # ~15 min
```

---

## Author

**Gokul S** — [github.com/gokul-s05](https://github.com/gokul-s05)
