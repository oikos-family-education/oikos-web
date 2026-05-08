# Oikos Deployment Guide

Single-VPS deployment on **Hetzner Cloud** using Terraform + Docker Compose + Caddy (automatic HTTPS).

## Architecture

```
Internet
   │
   ▼
Caddy (80/443) ──▶ web:3000 (Next.js)
                       │
                       │ internal rewrite (/api/*)
                       ▼
                   api:8000 (FastAPI)
                       │
               ┌───────┴───────┐
               ▼               ▼
           db:5432         redis:6379
         (Postgres)         (Redis)
```

All containers live on one Hetzner VM. Caddy handles TLS automatically via Let's Encrypt — no certificate management needed.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Terraform | ≥ 1.7 | https://developer.hashicorp.com/terraform/install |
| SSH keypair | — | `ssh-keygen -t ed25519 -C "oikos-deploy"` |
| Hetzner account | — | https://console.hetzner.cloud |
| Domain name | — | Point DNS A record to server IP after step 3 |

---

## Step 1 — Create a Hetzner API token

1. Log in to [console.hetzner.cloud](https://console.hetzner.cloud)
2. Select your project → **Security** → **API Tokens** → **Generate API Token**
3. Choose **Read & Write** permission
4. Copy the token — it is shown only once

---

## Step 2 — Configure Terraform variables

```bash
cd infra/terraform

# Create your variables file (never commit this)
cp terraform.tfvars.example terraform.tfvars   # see below for contents
```

Create `infra/terraform/terraform.tfvars`:

```hcl
hcloud_token   = "your_hetzner_api_token"
ssh_public_key = "ssh-ed25519 AAAA... you@machine"
domain         = "oikos.family"

# Optional — defaults shown:
# server_type = "cx22"    # upgrade to cpx31 when you need more RAM
# location    = "nbg1"    # EU: nbg1, fsn1, hel1 | US: ash, hil
# environment = "production"
```

Add `terraform.tfvars` to `.gitignore` (it already is via the root `.gitignore`).

---

## Step 3 — Provision the server

```bash
cd infra/terraform

terraform init
terraform plan      # review what will be created
terraform apply     # type "yes" to confirm
```

Terraform creates:
- SSH key uploaded to Hetzner
- Firewall (ports 22, 80, 443)
- Static primary IP (survives server rebuilds)
- Ubuntu 24.04 VM (cx22 by default)
- cloud-init bootstrap: Docker, ufw, fail2ban, 2 GB swap, repo clone

**Output example:**
```
server_ip       = "65.21.x.x"
ssh_command     = "ssh root@65.21.x.x"
dns_instruction = "Create an A record: oikos.family → 65.21.x.x"
```

Wait ~2 minutes for cloud-init to finish before continuing.

---

## Step 4 — Point your domain DNS

Create an **A record** at your DNS provider:

```
oikos.family  →  65.21.x.x   (the IP from terraform output)
```

DNS propagation usually takes 1–5 minutes. Caddy will not issue a certificate until the domain resolves correctly.

---

## Step 5 — Configure production secrets

SSH into the server:

```bash
ssh root@65.21.x.x
cd /opt/oikos
```

Copy and fill in the environment file:

```bash
cp infra/deploy/.env.production.example infra/deploy/.env.production
nano infra/deploy/.env.production
```

Generate strong secrets where indicated:

```bash
# Strong passwords / keys:
openssl rand -hex 16   # for POSTGRES_PASSWORD and REDIS_PASSWORD
openssl rand -hex 32   # for JWT_SECRET_KEY
```

Set the domain to match your DNS:

```
DOMAIN=oikos.family
APP_BASE_URL=https://oikos.family
```

---

## Step 6 — First deploy

Still on the server:

```bash
cd /opt/oikos

docker compose \
  -f infra/deploy/docker-compose.prod.yml \
  --env-file infra/deploy/.env.production \
  up -d --build
```

This will:
1. Build production images (takes 3–8 minutes on first run)
2. Run database migrations
3. Seed the database
4. Start Postgres, Redis, API, Next.js, and Caddy
5. Caddy issues a Let's Encrypt certificate automatically

**Verify everything is running:**

```bash
docker compose -f infra/deploy/docker-compose.prod.yml ps
```

All services should show `Up`. Visit `https://oikos.family` — you should see the app with a valid TLS certificate.

---

## Step 7 — Set up continuous deployment (optional)

Add these secrets to your GitHub repository (**Settings → Secrets → Actions**):

| Secret | Value |
|--------|-------|
| `SERVER_IP` | The IP from terraform output |
| `SSH_PRIVATE_KEY` | Contents of your `~/.ssh/id_ed25519` (private key) |

Every push to `main` will now automatically deploy to the server via `.github/workflows/deploy.yml`.

To trigger a manual deploy: **Actions → Deploy → Run workflow**.

---

## Day-2 Operations

### View logs

```bash
cd /opt/oikos

# All services
docker compose -f infra/deploy/docker-compose.prod.yml logs -f

# Single service
docker compose -f infra/deploy/docker-compose.prod.yml logs -f api
docker compose -f infra/deploy/docker-compose.prod.yml logs -f web
```

### Manual redeploy

```bash
cd /opt/oikos
git pull origin main
docker compose -f infra/deploy/docker-compose.prod.yml \
  --env-file infra/deploy/.env.production \
  up -d --build --remove-orphans
```

### Database backup

```bash
docker compose -f infra/deploy/docker-compose.prod.yml \
  exec db pg_dump -U oikos oikos | gzip > backup-$(date +%F).sql.gz
```

Restore:

```bash
gunzip -c backup-2026-01-01.sql.gz | \
  docker compose -f infra/deploy/docker-compose.prod.yml \
  exec -T db psql -U oikos oikos
```

### Scale up the server

Resizing takes ~2 minutes and keeps all data intact:

1. In Hetzner Console: **Server → Actions → Resize** (or update `server_type` in `terraform.tfvars` and `terraform apply`)
2. The server reboots with more CPU/RAM
3. Docker and all containers restart automatically

Recommended progression:

| Traffic | Server | Cost/mo |
|---------|--------|---------|
| Getting started | `cx22` (2 vCPU / 4 GB) | ~$6 |
| Growing | `cpx31` (4 vCPU / 8 GB) | ~$15 |
| Established | `cpx41` (8 vCPU / 16 GB) | ~$25 |

### Renew / rotate secrets

Edit `.env.production` on the server, then restart the affected service:

```bash
nano /opt/oikos/infra/deploy/.env.production

docker compose -f /opt/oikos/infra/deploy/docker-compose.prod.yml \
  --env-file /opt/oikos/infra/deploy/.env.production \
  up -d api
```

---

## File reference

```
infra/
├── terraform/
│   ├── main.tf                    # Hetzner server, firewall, SSH key, primary IP
│   ├── variables.tf               # All input variables with descriptions
│   ├── outputs.tf                 # Server IP, SSH command, DNS instruction
│   └── cloud-init.yaml            # First-boot: Docker, ufw, fail2ban, swap, git clone
└── deploy/
    ├── docker-compose.prod.yml    # Production stack (Caddy, Postgres, Redis, API, Web)
    ├── Caddyfile                  # HTTPS reverse proxy config
    └── .env.production.example    # Secret template — copy to .env.production

apps/
├── api/Dockerfile.prod            # FastAPI — 2 uvicorn workers, no --reload
└── web/Dockerfile.prod            # Next.js — multi-stage build + next start

.github/workflows/deploy.yml       # CD: push to main → SSH deploy
```
