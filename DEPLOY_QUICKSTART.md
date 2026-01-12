# SpellWise Production Deployment - Quick Start

**Production URL:** `https://demo.colaps.team/spellwise`

---

## ⚡ 3-Step Quick Deploy

### Step 1: Prepare
```bash
cp .env.docker .env
# Edit .env with production secrets:
# - JWT_ACCESS_SECRET (strong random)
# - JWT_REFRESH_SECRET (strong random)
# - MONGO_PASSWORD (secure password)
# - OPENAI_API_KEY (your key)
```

### Step 2: Build
```bash
docker-compose -f docker-compose.multiapp.yml build
```

### Step 3: Deploy
```bash
docker-compose -f docker-compose.multiapp.yml up -d
```

---

## 🔗 Main Reverse Proxy Configuration

Update your main reverse proxy at `demo.colaps.team` to route:

```
PathPrefix(/spellwise) → http://localhost:3000
```

**Traefik:**
```yaml
labels:
  - traefik.http.routers.spellwise.rule=PathPrefix(`/spellwise`)
  - traefik.http.services.spellwise.loadbalancer.server.port=3000
```

**Nginx:**
```nginx
location /spellwise {
    proxy_pass http://localhost:3000;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Path /spellwise;
}
```

---

## ✅ Verify

```bash
# Check containers
docker-compose -f docker-compose.multiapp.yml ps

# Check logs
docker-compose -f docker-compose.multiapp.yml logs -f

# Test health endpoint
curl https://demo.colaps.team/spellwise/health
```

---

## 📚 Full Documentation

See `MULTIAPP_HOSTING.md` for complete setup and troubleshooting.

---

## 🎯 What Changed

| Component | Local | Production |
|-----------|-------|------------|
| URL | http://localhost:3000 | https://demo.colaps.team/spellwise |
| Port Exposure | Direct (3000, 4000, 27017) | Internal only (reverse proxy) |
| Deployment | docker-compose.yml | docker-compose.multiapp.yml |
| Reverse Proxy | None | Required (Traefik/Nginx) |

---

## 🔧 Commands

```bash
# Build
docker-compose -f docker-compose.multiapp.yml build

# Start
docker-compose -f docker-compose.multiapp.yml up -d

# Stop
docker-compose -f docker-compose.multiapp.yml down

# Logs
docker-compose -f docker-compose.multiapp.yml logs -f

# Shell
docker-compose -f docker-compose.multiapp.yml exec server sh
```

---

**Deployed!** Access at `https://demo.colaps.team/spellwise` 🚀
