# Hosting Hittem on a VM

Static files behind Caddy, deployed by rsync from GitHub Actions on push to `main`.
Nothing server-side runs: the app is HTML, CSS and JavaScript, and all state lives in
the browser.

## 1. Provision

A minimal Debian or Ubuntu VM is enough. Requirements:

- A public IPv4 address (and IPv6 if available).
- Inbound 80 and 443 open. Port 80 is not optional: Caddy uses it for the ACME
  HTTP-01 challenge and for the redirect to HTTPS.
- Inbound 22 reachable from GitHub Actions runners, or a self-hosted runner on your
  own network if you would rather not expose SSH.

## 2. DNS

Point both names at the VM **before** installing Caddy, otherwise the first
certificate request fails and Caddy backs off for a while.

At the registrar currently serving `hittem.site` (Namecheap, `dns1.registrar-servers.com`):

| Type | Host | Value |
|---|---|---|
| A | `@` | VM IPv4 |
| AAAA | `@` | VM IPv6, if it has one |
| A | `www` | VM IPv4 |

Delete the Vercel records first: the `A` record pointing at `216.198.79.1` and the
`CNAME` on `www` pointing at `ad91f40f115aa4bc.vercel-dns-017.com`.

Confirm before moving on, since Caddy will fail loudly otherwise:

```bash
dig +short hittem.site A && dig +short www.hittem.site A
```

## 3. Deploy user and web root

```bash
sudo adduser --system --group --shell /bin/bash --home /home/deploy deploy
sudo mkdir -p /srv/hittem
sudo chown -R deploy:deploy /srv/hittem
sudo chmod 755 /srv /srv/hittem
```

Caddy runs as its own `caddy` user and only needs to read `/srv/hittem`, which the
`755` above allows.

Authorise the deploy key (see step 5 for generating it):

```bash
sudo -u deploy mkdir -p /home/deploy/.ssh
sudo -u deploy tee -a /home/deploy/.ssh/authorized_keys < deploy-key.pub
sudo -u deploy chmod 700 /home/deploy/.ssh
sudo -u deploy chmod 600 /home/deploy/.ssh/authorized_keys
```

## 4. Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Install the config from this directory and reload:

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Watch the first certificate issuance:

```bash
sudo journalctl -u caddy -f
```

## 5. Deploy key and GitHub secrets

Generate a key dedicated to this deploy. Keep the private half out of the repo and
out of any chat window:

```bash
ssh-keygen -t ed25519 -N '' -C 'hittem-deploy' -f ./deploy-key
ssh-keyscan -t ed25519 <VM_HOST> 2>/dev/null
```

Add four repository secrets under Settings, Secrets and variables, Actions:

| Secret | Value |
|---|---|
| `DEPLOY_KEY` | contents of `deploy-key` (the private half) |
| `DEPLOY_KNOWN_HOSTS` | the `ssh-keyscan` output line |
| `DEPLOY_HOST` | VM hostname or IP |
| `DEPLOY_USER` | `deploy` |

Then delete the local private key: `rm deploy-key`.

`DEPLOY_KNOWN_HOSTS` is what stops the workflow trusting whatever answers on that
address. Without it the deploy key would be handed to anything that hijacked DNS.

## 6. First deploy

```bash
git commit --allow-empty -m "Trigger deploy" && git push
```

The workflow rsyncs `web/` to `/srv/hittem/` and then asserts `hittem.site` returns
200. Watch it with `gh run watch`.

## Google OAuth

The authorised JavaScript origins on the OAuth client already cover `https://hittem.site`
and `https://www.hittem.site`, so moving hosts changes nothing there as long as the
domain stays the same. No Google console change is needed for this migration.

## Rollback

Serving is just files in a directory, so rollback is a checkout and a re-run:

```bash
git revert <bad-commit> && git push
```

If Caddy itself is the problem, `sudo systemctl stop caddy` takes the site down
cleanly rather than serving something broken.
