# SpellWise Multi-App Hosting Configuration Summary

## 🎯 Changes Made for demo.colaps.team/spellwise

### Files Updated/Created

1. **nginx.conf** (Updated)
   - Added `/spellwise` base path routing
   - SPA routing with try_files fallback
   - API proxy with path stripping: `/spellwise/api/*` → `http://server:4000/api/*`
   - Static file proxying with path stripping

2. **Dockerfile.client** (Updated)
   - Build with `VITE_BASE_PATH=/spellwise/`
   - Assets built to `/spellwise/assets/`

3. **client/vite.config.ts** (Updated)
   - `base: process.env.VITE_BASE_PATH || '/spellwise/'`
   - Ensures all imports reference `/spellwise/` prefix

4. **docker-compose.multiapp.yml** (NEW)
   - Multi-app optimized compose file
   - Exposes services internally only (no direct port mapping)
   - Compatible with external reverse proxy (Traefik, Nginx, etc.)
   - Traefik labels for automatic routing

5. **MULTIAPP_HOSTING.md** (NEW)
   - Complete deployment guide
   - Architecture overview
   - Setup instructions
   - Troubleshooting guide

---

## 🚀 Key Differences from Local Setup

### Local (docker-compose.yml)
```
Port 3000 → Direct access
Port 4000 → Direct access
Port 27017 → Direct access
```

### Production (docker-compose.multiapp.yml)
```
Port 3000 → Internal only (through nginx in app)
Port 4000 → Internal only (not exposed)
Port 27017 → Internal only (not exposed)
External: https://demo.colaps.team/spellwise → nginx container
```

---

## 📝 Configuration for deployment

### .env.docker (Update these values)

```bash
# Production secrets - CHANGE THESE!
JWT_ACCESS_SECRET=<generate-strong-random-secret>
JWT_REFRESH_SECRET=<generate-strong-random-secret>
MONGO_PASSWORD=<secure-database-password>

# OpenAI
OPENAI_API_KEY=sk-<your-actual-key>

# Multi-app paths
VITE_BASE_PATH=/spellwise/
VITE_API_URL=https://demo.colaps.team/spellwise/api
BASE_PATH=/spellwise
```

---

## 🔄 URL Mapping

| Type | Local | Production |
|------|-------|-----------|
| Client | http://localhost:3000 | https://demo.colaps.team/spellwise |
| API | http://localhost:4000/api | https://demo.colaps.team/spellwise/api |
| Audio | http://localhost:4000/static | https://demo.colaps.team/spellwise/static |
| Health | http://localhost:4000/health | https://demo.colaps.team/spellwise/health |

---

## 🛠️ Deployment Steps

### 1. Build Images
```bash
docker-compose -f docker-compose.multiapp.yml build
```

### 2. Configure Environment
```bash
# Copy and edit .env.docker
cp .env.docker .env
nano .env  # Update secrets and API keys
```

### 3. Start Services
```bash
docker-compose -f docker-compose.multiapp.yml up -d
```

### 4. Configure Main Reverse Proxy

Update demo.colaps.team configuration to route:
```
/spellwise → http://localhost:3000 (spellwise-client container)
```

**Traefik example:**
```yaml
services:
  spellwise:
    image: your-registry/spellwise-client:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.spellwise.rule=PathPrefix(`/spellwise`)"
      - "traefik.http.services.spellwise.loadbalancer.server.port=3000"
```

### 5. Test
```bash
curl https://demo.colaps.team/spellwise/health
curl https://demo.colaps.team/spellwise/
```

---

## 🔍 Nginx Routing Details

### Incoming Request: `/spellwise/api/auth/login`

```
Client Browser
    ↓ https://demo.colaps.team/spellwise/api/auth/login
Main Reverse Proxy (demo.colaps.team)
    ↓ (routes to) http://localhost:3000/spellwise/api/auth/login
Nginx Container (spellwise-client)
    ↓ (strips /spellwise, proxies) http://server:4000/api/auth/login
Server Container (spellwise-server)
    ↓ (processes) /api/auth/login endpoint
MongoDB
    ↓ (queries) spellwise.users collection
```

### Static Asset Request: `/spellwise/assets/index.abc123.js`

```
Client Browser
    ↓ https://demo.colaps.team/spellwise/assets/index.abc123.js
Main Reverse Proxy
    ↓ http://localhost:3000/spellwise/assets/index.abc123.js
Nginx Container
    ↓ (serves from dist/) /usr/share/nginx/html/assets/index.abc123.js
```

---

## ✅ Verification Checklist

After deployment:

- [ ] Client loads at https://demo.colaps.team/spellwise
- [ ] Can click through UI without 404s
- [ ] CSS/JS files load (check DevTools)
- [ ] Can signup/login (check Network tab)
- [ ] Audio files load from /spellwise/static/
- [ ] API calls to /spellwise/api/* work
- [ ] Health check: https://demo.colaps.team/spellwise/health returns 200

---

## 🔧 Commands Reference

### Using Multi-App Compose
```bash
# Build
docker-compose -f docker-compose.multiapp.yml build

# Start
docker-compose -f docker-compose.multiapp.yml up -d

# Logs
docker-compose -f docker-compose.multiapp.yml logs -f

# Stop
docker-compose -f docker-compose.multiapp.yml down

# Shell
docker-compose -f docker-compose.multiapp.yml exec server sh
```

---

## 📚 Files Reference

- **MULTIAPP_HOSTING.md** - Complete setup and troubleshooting guide
- **docker-compose.multiapp.yml** - Production compose file
- **Dockerfile.server** - Unchanged from original
- **Dockerfile.client** - Updated with VITE_BASE_PATH
- **nginx.conf** - Updated for /spellwise routing
- **client/vite.config.ts** - Updated with base path config

---

## 💡 Notes

- App name can be changed from "spellwise" to anything in /spellwise path
- All routing happens in nginx.conf (no server-side changes needed)
- Server runs exactly the same, just accessed through nginx proxy
- MongoDB credentials should be strong in production
- JWT secrets should be long, random, and unique
- Consider adding monitoring/alerting for production

---

**Configuration complete! Ready for deployment to demo.colaps.team** 🚀
