# Tillsammans Beta Deployment Guide

Production deployment of Tillsammans at covey.se on a GleSYS VPS.

## Prerequisites

- GleSYS account with a provisioned VPS (2 vCPU, 4 GB RAM, 40 GB SSD, Debian 12 or Ubuntu 24.04)
- SSH access to the VPS
- DNS control for covey.se

---

## 1. Server Setup

### Initial access and hardening

```bash
ssh root@<VPS_IP>

# System update
apt update && apt upgrade -y

# Create deploy user
adduser deploy
usermod -aG sudo deploy

# SSH key setup
mkdir -p /home/deploy/.ssh
echo "ssh-ed25519 AAAA... your-key-here" >> /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh

# Disable root login and password auth
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd
```

### Firewall

```bash
sudo apt install ufw -y
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Security tools

```bash
# Automatic security updates
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades

# Brute-force protection
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Timezone
sudo timedatectl set-timezone Europe/Stockholm
```

### Swap (recommended for 2-4 GB RAM)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 2. Docker Installation

```bash
su - deploy
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker deploy
newgrp docker

# Verify
docker --version
docker compose version
```

### Docker log rotation

```bash
sudo tee /etc/docker/daemon.json > /dev/null << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
sudo systemctl restart docker
```

---

## 3. DNS Configuration

At your domain registrar for `covey.se`, create these records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<VPS_IP>` | 300 (lower to 3600 once verified) |
| A | `www` | `<VPS_IP>` | 300 |
| TXT | `@` | `v=spf1 -all` | 3600 |
| CAA | `@` | `0 issue "letsencrypt.org"` | 3600 |

Wait for DNS propagation before deploying (check with `dig covey.se`).

---

## 4. Deploy

### Clone the repository

```bash
ssh deploy@<VPS_IP>
mkdir -p ~/apps
cd ~/apps
git clone https://codeberg.org/Sami-X-Lamti/Tillsammans.git tillsammans
cd tillsammans
```

### Generate secrets

```bash
# Database password
PGPASS=$(openssl rand -base64 32 | tr -d '=/+' | head -c 40)
echo "POSTGRES_PASSWORD: $PGPASS"

# JWT secret
JWTSECRET=$(openssl rand -base64 64 | tr -d '=/+' | head -c 80)
echo "JWT_SECRET: $JWTSECRET"

# VAPID keys
cd ~/apps/tillsammans/backend
npm ci --omit=dev
npx web-push generate-vapid-keys
# Save the Public Key and Private Key output
cd ~/apps/tillsammans
```

### Create production .env

```bash
cp .env.example .env.prod

# Edit .env.prod and fill in:
# - POSTGRES_PASSWORD (generated above)
# - JWT_SECRET (generated above)
# - VAPID_PUBLIC_KEY (generated above)
# - VAPID_PRIVATE_KEY (generated above)
nano .env.prod

# Lock down permissions
chmod 600 .env.prod
```

### Start the stack

```bash
docker compose \
  --env-file .env.prod \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up --build -d
```

### Verify

```bash
# All 4 containers running
docker compose --env-file .env.prod \
  -f docker-compose.yml -f docker-compose.prod.yml ps

# Backend health
curl -s https://covey.se/api/health
# Expected: {"ok":true}

# TLS certificate
curl -vI https://covey.se 2>&1 | grep "subject:"
# Expected: subject: CN=covey.se

# Feature flags
curl -s https://covey.se/api/features

# Frontend loads
curl -s https://covey.se | head -5
```

---

## 5. Post-Deploy

### Database backups (daily cron)

```bash
mkdir -p ~/backups/db

cat > ~/apps/backup-db.sh << 'BKEOF'
#!/bin/bash
set -e
BACKUP_DIR="$HOME/backups/db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec tillsammans-db-1 bash -c \
  'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB --format=custom' \
  > "$BACKUP_DIR/tillsammans_${TIMESTAMP}.dump"
gzip "$BACKUP_DIR/tillsammans_${TIMESTAMP}.dump"
find "$BACKUP_DIR" -name "*.dump.gz" -mtime +30 -delete
echo "Backup complete: tillsammans_${TIMESTAMP}.dump.gz"
BKEOF
chmod +x ~/apps/backup-db.sh

# Schedule daily at 3 AM
(crontab -l 2>/dev/null; echo "0 3 * * * ~/apps/backup-db.sh >> ~/backups/backup.log 2>&1") | crontab -
```

### Uptime monitoring

Set up a free UptimeRobot monitor:
- URL: `https://covey.se/api/health`
- Interval: 5 minutes
- Alert: email to sentinel@covey.se

### Redeploy script

```bash
cat > ~/apps/tillsammans/deploy.sh << 'DEPLEOF'
#!/bin/bash
set -e
cd ~/apps/tillsammans
echo "=== Pulling latest ==="
git pull origin main
echo "=== Backing up DB ==="
~/apps/backup-db.sh
echo "=== Rebuilding ==="
docker compose --env-file .env.prod \
  -f docker-compose.yml -f docker-compose.prod.yml \
  up --build -d
echo "=== Waiting for health ==="
sleep 10
for i in {1..12}; do
  curl -sf https://covey.se/api/health > /dev/null && echo "Healthy!" && break
  echo "Waiting... ($i/12)"
  sleep 5
done
docker compose --env-file .env.prod \
  -f docker-compose.yml -f docker-compose.prod.yml ps
DEPLEOF
chmod +x ~/apps/tillsammans/deploy.sh
```

Usage: `~/apps/tillsammans/deploy.sh`

---

## Quick Reference

| What | Command |
|------|---------|
| View logs | `docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml logs -f backend` |
| Restart stack | `docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml restart` |
| Stop stack | `docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml down` |
| DB shell | `docker exec -it tillsammans-db-1 bash -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB'` |
| Manual backup | `~/apps/backup-db.sh` |
| Redeploy | `~/apps/tillsammans/deploy.sh` |
| Container stats | `docker stats --no-stream` |
