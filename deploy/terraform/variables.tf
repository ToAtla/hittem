variable "cmk_config" {
  description = "Path to the cloudmonkey config holding the API credentials."
  type        = string
  default     = "~/.cmk/config"
}

variable "cmk_profile" {
  description = "Profile within the cloudmonkey config to authenticate as."
  type        = string
  default     = "mjolnir"
}

variable "zone" {
  description = "CloudStack zone name."
  type        = string
  default     = "is1"
}

variable "service_offering" {
  description = "Compute offering. Atlas.a4 (1 vCPU / 4 GB) is the smallest available and is already far more than a static site needs."
  type        = string
  default     = "Atlas.a4"
}

variable "template" {
  description = "OS template for the instance."
  type        = string
  default     = "Debian 13"
}

variable "keypair" {
  description = "Existing CloudStack SSH keypair granting interactive root access to the instance."
  type        = string
  default     = "thor-key"
}

variable "network_cidr" {
  description = "Guest CIDR for the isolated network."
  type        = string
  default     = "10.10.0.0/24"
}

variable "site_domain" {
  description = "Primary hostname Caddy serves and requests a certificate for."
  type        = string
  default     = "hittem.site"
}

variable "deploy_authorized_key" {
  description = <<-EOT
    Public half of the SSH key GitHub Actions uses to rsync the site. Generate it
    yourself and put only the PUBLIC half here; the private half belongs in the
    DEPLOY_KEY repository secret and must never reach this repo or Terraform state.
    Leaving it empty provisions the box without deploy access, which you can add later
    by setting this and re-applying.
  EOT
  type        = string
  default     = ""
}

variable "ssh_source_cidr" {
  description = <<-EOT
    Who may reach port 22. GitHub-hosted runners have no stable egress range, so
    push-to-deploy needs this open to the internet. Password auth is disabled and only
    key auth is accepted. Narrow this if you move to a self-hosted runner.
  EOT
  type        = string
  default     = "0.0.0.0/0"
}
