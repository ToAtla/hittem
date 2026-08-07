# Isolated guest network. The "WithSourceNatService" offering gives the network a
# public IP on creation, which is what the site is served from; no second address has
# to be acquired.
resource "cloudstack_network" "hittem" {
  name             = "hittem-net"
  display_text     = "Hittem web"
  cidr             = var.network_cidr
  network_offering = "DefaultIsolatedNetworkOfferingWithSourceNatService"
  zone             = var.zone
  source_nat_ip    = true
}

resource "cloudstack_instance" "hittem" {
  name             = "hittem-web"
  display_name     = "hittem-web"
  service_offering = var.service_offering
  template         = var.template
  zone             = var.zone
  network_id       = cloudstack_network.hittem.id
  keypair          = var.keypair
  expunge          = true

  user_data = templatefile("${path.module}/cloud-init.yaml", {
    caddyfile             = file("${path.module}/../Caddyfile")
    deploy_authorized_key = var.deploy_authorized_key
    site_domain           = var.site_domain
  })
}

# Ingress. CloudStack evaluates the firewall on the public IP and the port forward
# separately: without both, a port is either unreachable or reachable but unmapped.
resource "cloudstack_firewall" "hittem" {
  ip_address_id = cloudstack_network.hittem.source_nat_ip_id

  rule {
    cidr_list = ["0.0.0.0/0"]
    protocol  = "tcp"
    ports     = ["80", "443"]
  }

  rule {
    cidr_list = [var.ssh_source_cidr]
    protocol  = "tcp"
    ports     = ["22"]
  }
}

resource "cloudstack_port_forward" "hittem" {
  ip_address_id = cloudstack_network.hittem.source_nat_ip_id

  # Port 80 is not optional even though the app is HTTPS-only: Caddy answers the ACME
  # HTTP-01 challenge on it and redirects everything else to 443.
  forward {
    protocol           = "tcp"
    private_port       = 80
    public_port        = 80
    virtual_machine_id = cloudstack_instance.hittem.id
  }

  forward {
    protocol           = "tcp"
    private_port       = 443
    public_port        = 443
    virtual_machine_id = cloudstack_instance.hittem.id
  }

  forward {
    protocol           = "tcp"
    private_port       = 22
    public_port        = 22
    virtual_machine_id = cloudstack_instance.hittem.id
  }
}
