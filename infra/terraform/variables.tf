variable "hcloud_token" {
  description = "Hetzner Cloud API token (generate at console.hetzner.cloud → Security → API Tokens)"
  type        = string
  sensitive   = true
}

variable "ssh_public_key" {
  description = "Contents of your SSH public key (e.g. ~/.ssh/id_ed25519.pub)"
  type        = string
}

variable "server_type" {
  description = "Hetzner server type. cx22 = 2vCPU/4GB (~$6), cpx31 = 4vCPU/8GB (~$15)"
  type        = string
  default     = "cx22"
}

variable "location" {
  description = "Hetzner datacenter location. EU: nbg1 (Nuremberg), fsn1 (Falkenstein), hel1 (Helsinki). US: ash (Ashburn), hil (Hillsboro)"
  type        = string
  default     = "nbg1"
}

variable "environment" {
  description = "Deployment environment label (production, staging)"
  type        = string
  default     = "production"
}

variable "domain" {
  description = "Your domain name (e.g. oikos.family). Used for Caddy HTTPS."
  type        = string
}

variable "repo_url" {
  description = "Git repository URL to clone on the server"
  type        = string
  default     = "https://github.com/oikos-family-education/oikos-web.git"
}
