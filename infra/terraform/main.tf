terraform {
  required_version = ">= 1.7"
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.49"
    }
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

# ─── SSH Key ──────────────────────────────────────────────────────────────────
resource "hcloud_ssh_key" "oikos" {
  name       = "oikos-${var.environment}"
  public_key = var.ssh_public_key
}

# ─── Firewall ─────────────────────────────────────────────────────────────────
resource "hcloud_firewall" "oikos" {
  name = "oikos-${var.environment}"

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = ["0.0.0.0/0", "::/0"]
    description = "SSH"
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
    description = "HTTP (Caddy redirects to HTTPS)"
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
    description = "HTTPS"
  }

  # ICMP (ping) — optional but useful for health checks
  rule {
    direction  = "in"
    protocol   = "icmp"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
}

# ─── Primary IP (persists across server rebuilds / resizes) ───────────────────
resource "hcloud_primary_ip" "oikos" {
  name          = "oikos-${var.environment}"
  type          = "ipv4"
  datacenter    = data.hcloud_datacenter.selected.name
  assignee_type = "server"
  auto_delete   = false
}

data "hcloud_datacenter" "selected" {
  name = local.datacenter_map[var.location]
}

locals {
  datacenter_map = {
    nbg1 = "nbg1-dc3"
    fsn1 = "fsn1-dc14"
    hel1 = "hel1-dc2"
    ash  = "ash-dc1"
    hil  = "hil-dc1"
  }
}

# ─── Server ───────────────────────────────────────────────────────────────────
resource "hcloud_server" "oikos" {
  name         = "oikos-${var.environment}"
  image        = "ubuntu-24.04"
  server_type  = var.server_type
  location     = var.location
  ssh_keys     = [hcloud_ssh_key.oikos.id]
  firewall_ids = [hcloud_firewall.oikos.id]
  user_data    = templatefile("${path.module}/cloud-init.yaml", {
    repo_url = var.repo_url
    domain   = var.domain
  })

  public_net {
    ipv4_enabled = true
    ipv4         = hcloud_primary_ip.oikos.id
    ipv6_enabled = true
  }

  labels = {
    project     = "oikos"
    environment = var.environment
  }

  lifecycle {
    # Prevent accidental server destruction — resize server_type instead
    prevent_destroy = false
    ignore_changes  = [user_data]
  }
}
