# Credentials come from the cloudmonkey config, never from this repo. The provider
# reads ~/.cmk/config and picks the named profile, so no API key or secret is stored
# in Terraform files, in tfvars, or in state.
provider "cloudstack" {
  config  = pathexpand(var.cmk_config)
  profile = var.cmk_profile

  # Storage in this zone is slow to materialise a root volume: the first deploy took
  # over half an hour just to move the ROOT volume from Allocated to Creating. The
  # provider default gave up mid-deploy, which left the instance running in CloudStack
  # but absent from state, so the next apply would have built a second one. Waiting
  # longer is the cheap fix; an orphaned instance is the expensive failure.
  timeout = 5400
}
