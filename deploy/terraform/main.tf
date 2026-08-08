# Isolated guest network with a source NAT public IP.
#
# The offering choice is load-bearing. The obvious pick,
# DefaultIsolatedNetworkOfferingWithSourceNatService, sets egressdefaultpolicy=false,
# which denies all outbound traffic from the guest. That cannot be relaxed here: this
# zone rejects createEgressFirewallRule outright with error 4350, so there is no way to
# open egress after the fact. The Kubernetes service offering carries an identical
# service list and sets egressdefaultpolicy=true, so it is a drop-in that permits
# outbound.
#
# Outbound is not optional. Caddy has to reach Let's Encrypt to obtain a certificate,
# and apt has to reach the Caddy repository to install it. The failure mode when egress
# is denied is quietly misleading: the virtual router still answers DNS, so hostnames
# resolve normally and every connection then hangs until it times out.
resource "cloudstack_network" "hittem" {
  name             = "hittem-pub"
  display_text     = "Hittem web"
  cidr             = var.network_cidr
  network_offering = var.network_offering
  zone             = var.zone
  source_nat_ip    = true
}

# Configuration is Ansible's job, not the instance's. There is deliberately no user_data
# here: cloud-init's runcmd fires once on first boot, so a failed step means rebuilding
# the instance to retry, and debugging it means reading logs on a box you cannot reach
# yet. deploy/ansible/site.yml does the same work idempotently over SSH.
resource "cloudstack_instance" "hittem" {
  name             = var.instance_name
  display_name     = var.instance_name
  service_offering = var.service_offering
  template         = var.template
  zone             = var.zone
  network_id       = cloudstack_network.hittem.id
  keypair          = var.keypair
  expunge          = true
}

# CloudStack evaluates the firewall on the public IP and the port forward separately.
# Without both, a port is either unreachable or reachable but unmapped.
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
