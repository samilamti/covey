# Production deployment helpers

Small helpers for managing the GleSYS production VPS without doing manual SSH gymnastics. Designed to be reusable for any future env-var rotation or one-shot prod operation.

## `set-prod-secret.sh` — inject or rotate a single env-var line

Idempotently writes one `KEY='value'` line into `~/apps/tillsammans/.env.prod` on the VPS, then restarts the backend service so it picks up the new value. Existing lines for the same `KEY=` are replaced; everything else in `.env.prod` is preserved.

### Setup (one time)

1. Copy the config template and fill in the SSH/sudo details:

   ```bash
   cp scripts/deploy/.env.local.example scripts/deploy/.env.local
   chmod 600 scripts/deploy/.env.local
   $EDITOR scripts/deploy/.env.local
   ```

   `.env.local` is gitignored. It needs:
   - `PROD_HOST` (VPS IP)
   - `PROD_USER` (the original GleSYS user — has sudo with password)
   - `PROD_KEY` (path to a passphrase-free SSH private key — keep in `/tmp` so it's not in the repo)
   - `PROD_SUDO_PASS` (sudo password for `PROD_USER`)
   - `PROD_DEPLOY_USER` (the docker-running user, typically `deploy`)
   - `PROD_APP_DIR` (`/home/deploy/apps/tillsammans`)

2. If your SSH key is passphrase-protected, make a one-shot working copy:

   ```bash
   cp ~/.ssh/covey_key /tmp/covey-deploy/key
   chmod 600 /tmp/covey-deploy/key
   ssh-keygen -p -f /tmp/covey-deploy/key -N '' -P '<passphrase>'
   ```

   Update `PROD_KEY` to point at the working copy. Shred it after you're done.

### Usage

Write the env-var line to a local file, then run the helper:

```bash
# Single-quote-wrap the value so backslashes are preserved literally.
# This matters for JSON service-account keys with embedded "\n".
cat > /tmp/firebase.line <<'EOF'
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key":"-----BEGIN ...\n...\n-----END ...\n",...}'
EOF

bash scripts/deploy/set-prod-secret.sh /tmp/firebase.line

# Shred when done
rm -f /tmp/firebase.line
```

The helper prints (length-only, never the value) confirmation that the variable is loaded into the running container.

### What it does, step by step

1. SCP the line file to `/tmp/.<VAR>.<pid>` on the VPS
2. SSH as `PROD_USER`, sudo to root, atomically rewrite `.env.prod` (backup + replace + chown to `deploy` + chmod 600)
3. `git pull --ff-only` in the app directory (as `deploy`)
4. `docker compose --env-file .env.prod ... up -d backend` (as `deploy`)
5. `docker compose exec` to verify the var is present in the running container — prints **only the length** to avoid leaking secrets to logs

### Safety properties

- **Backup before write**: the existing `.env.prod` is copied to `.env.prod.bak.<timestamp>` before any edit.
- **Idempotent**: re-running with the same line file produces the same end state. Multiple invocations don't accumulate duplicate lines.
- **Length-only verification**: the secret value is never echoed to stdout/stderr or shell history.
- **Single-quote preservation**: passing the JSON in single quotes means Docker Compose's env-file parser preserves `\n` as literal two-character escapes; Node's `JSON.parse` then resolves them to real newlines for `firebase-admin` PEM parsing.

## Why a helper instead of `ssh + nano`

Three concrete recurring problems this avoids:

- **Heredoc-as-sudo-password bug**: naive `echo "$pass" | sudo -S bash <<EOF ... EOF` over SSH causes the heredoc body to be eaten as the sudo password. The helper builds a single stdin stream where the password is line 1 and the heredoc is lines 2+, then `sudo -S` consumes line 1 and `bash -s` reads the rest.
- **Quoting JSON values with embedded newlines**: easy to mangle when typing into `nano` or `echo`. Putting the value in a file preserves bytes verbatim.
- **Forgetting to chown back to `deploy`**: when sudo rewrites a file, ownership flips to root and `docker compose` (running as `deploy`) silently can't read it. The helper restores ownership before swapping the file in.
