output "public_ip" {
  description = "Point the A records for the site and www at this address."
  value       = cloudstack_network.hittem.source_nat_ip_address
}

output "private_ip" {
  description = "Guest address of the instance inside the isolated network."
  value       = cloudstack_instance.hittem.ip_address
}

output "next_steps" {
  description = "What has to happen outside Terraform before the site serves."
  value       = <<-EOT
    1. DNS: point ${var.site_domain} and www.${var.site_domain} A records at ${cloudstack_network.hittem.source_nat_ip_address},
       and delete the old Vercel records. Caddy cannot obtain a certificate until this
       resolves, and it backs off between attempts, so do it before checking the site.
    2. GitHub secrets: DEPLOY_HOST=${cloudstack_network.hittem.source_nat_ip_address}, DEPLOY_USER=deploy,
       DEPLOY_KEY=<private half>, DEPLOY_KNOWN_HOSTS=$(ssh-keyscan -t ed25519 ${cloudstack_network.hittem.source_nat_ip_address})
    3. Push to main, or re-run the Deploy Hittem workflow, to rsync web/ onto the box.
  EOT
}
