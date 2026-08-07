# Public keys are not secrets, so this is safe to commit. The matching private half
# lives at ~/.ssh/hittem-deploy on the operator's machine and belongs in the DEPLOY_KEY
# repository secret. It must never be committed here.
deploy_authorized_key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFBhuJuifWD8XyGFwEdaOOemBjen4F70+m9aNXL6S7dh hittem-deploy"
