output "server_ip" {
  description = "Public IPv4 address of the Oikos server"
  value       = hcloud_server.oikos.ipv4_address
}

output "server_ipv6" {
  description = "Public IPv6 address of the Oikos server"
  value       = hcloud_server.oikos.ipv6_address
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh root@${hcloud_server.oikos.ipv4_address}"
}

output "dns_instruction" {
  description = "Point this DNS A record to the server IP"
  value       = "Create an A record: ${var.domain} → ${hcloud_server.oikos.ipv4_address}"
}
