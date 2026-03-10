# MedShop – Medical Shop Management Platform

A free‑tier full‑stack web application to help medical shop owners manage inventory, track expiry dates, handle supplier orders, record sales, and provide simple prescription lookup.

## Stack Overview
- **Frontend** – Vite + React + TypeScript (glass‑morphism UI)
- **Backend** – Node.js + Express REST API with PostgreSQL
- **Containerisation** – Docker Swarm (local dev) + optional single‑node Swarm on AWS EC2 (t2.micro – free tier)
- **Infrastructure** – Terraform provisioning AWS VPC, EC2, RDS (PostgreSQL free tier), S3 backup
- **CI/CD** – GitHub Actions or GitLab CI (free)
- **Monitoring** – Prometheus + Grafana dashboards

## Quick Start (local)
```bash
# Clone the repo (once created)
git clone <repo-url>
cd medshop
# Initialise Docker Swarm (if not already)
Docker swarm init
# Deploy stack
docker stack deploy -c docker-compose.swarm.yml medshop
```

Visit `http://localhost` for the UI.
