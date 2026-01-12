# SpellWise Multi-App Hosting Setup

## 🌐 Deployment Context

**Production URL:** `https://demo.colaps.team/spellwise`

This setup is designed for hosting multiple web applications under a single domain with a reverse proxy (Traefik, Nginx, etc.) distributing traffic based on URL paths.

---

## 📋 Setup Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              demo.colaps.team (HTTPS)                       │
│         ↓ (demo.colaps.team/spellwise)                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Main Reverse Proxy (Traefik/Nginx)                 │   │
│  │  • SSL/TLS termination                              │   │
│  │  • Path-based routing (/spellwise → spellwise)     │   │
│  │  • Load balancing                                   │   │
│  └──────────────────┬──────────────────────────────────┘   │
│                     │                                        │
│                     ▼ (localhost:3000)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SpellWise Nginx Container                          │  │
│  │  • SPA routing (/spellwise/*)                       │  │
│  │  • API proxy → /api/... to :4000                    │  │
│  │  • Static files                                      │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│        ┌────────────┴────────────┐                          │
│        ▼                         ▼                          │
│  ┌─────────────┐          ┌────────────────┐               │
│  │ Server      │          │ MongoDB        │               │
│  │ :4000       │          │ :27017         │               │
│  └─────────────┘          └────────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Deployment

### Prerequisites

- Docker & Docker Compose installed
- Access to demo.colaps.team infrastructure
- MongoDB credentials (or use provided defaults)
- OpenAI API key
- JWT secrets

### Step 1: Prepare Environment

```bash
# Copy environment template
cp .env.docker .env

# Edit with your actual values
nano .env
```

**Required in .env:**
```bash
# MongoDB
MONGO_USERNAME=admin
MONGO_PASSWORD=your-secure-password
MONGO_PORT=27017

# OpenAI
OPENAI_API_KEY=sk-your-actual-key

# JWT (change these!)
JWT_ACCESS_SECRET=your-very-long-random-secret-key
JWT_REFRESH_SECRET=your-very-long-random-secret-key

# App
NODE_ENV=production
```

### Step 2: Build for Multi-App

```bash
# Use the multi-app compose file
docker-compose -f docker-compose.multiapp.yml build
```

### Step 3: Deploy

```bash
# Start services
docker-compose -f docker-compose.multiapp.yml up -d

# Verify
docker-compose -f docker-compose.multiapp.yml ps
docker-compose -f docker-compose.multiapp.yml logs -f
```

### Step 4: Configure Main Reverse Proxy

The main reverse proxy (at demo.colaps.team) should route `/spellwise` to `http://localhost:3000`.

**Traefik example:**
```yaml
services:
  spellwise:
    image: your-registry/spellwise-client:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.spellwise.rule=PathPrefix(`/spellwise`)"
      - "traefik.http.middlewares.spellwise-strip.stripprefix.prefixes=/spellwise"
      - "traefik.http.routers.spellwise.middlewares=spellwise-strip"
      - "traefik.http.services.spellwise.loadbalancer.server.port=3000"
```

**Nginx example:**
```nginx
server {
    listen 443 ssl;
    server_name demo.colaps.team;
    
    ssl_certificate /path/to/cert;
    ssl_certificate_key /path/to/key;
    
    location /spellwise {
        proxy_pass http://spellwise-client:3000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
    }
}
```

---

## 🔧 Configuration Files

### Modified Files

#### 1. **vite.config.ts** (Client Build)
- Sets `base: '/spellwise/'` for all static assets
- Assets built to `/spellwise/assets/`
- Router links work with `/spellwise` prefix

#### 2. **nginx.conf** (Nginx Configuration)
- Handles `/spellwise/*` paths
- Strips `/spellwise` prefix for API calls to server
- SPA routing for client-side routes
- Proxies `/spellwise/api/` → `http://server:4000/api/`

#### 3. **Dockerfile.client** (Client Build)
- Builds with `VITE_BASE_PATH=/spellwise/`
- Uses updated nginx.conf

#### 4. **Dockerfile.server** (Unchanged)
- Listens on port 4000
- Endpoints at `/api/*` and `/static/*`
- No base path needed

#### 5. **docker-compose.multiapp.yml** (New)
- Exposes services internally only
- Compatible with external reverse proxy
- Labels for Traefik integration
- BASE_PATH environment variable for future server-side routing

---

## 🌍 Environment Variables

### Client-Side (.env - frontend)

```bash
# Build-time variable
VITE_BASE_PATH=/spellwise/

# API endpoint
VITE_API_URL=https://demo.colaps.team/spellwise/api
```

### Server-Side (.env - backend)

```bash
# Server settings
PORT=4000
NODE_ENV=production
BASE_PATH=/spellwise

# Database
MONGO_URI=mongodb://admin:password@mongodb:27017/spellwise?authSource=admin

# Authentication
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...

# External APIs
OPENAI_API_KEY=...
```

---

## 🔄 URL Routing

### Before (Local Dev)
```
http://localhost:5173          → Client (dev server)
http://localhost:4000          → Server API
http://localhost:4000/health   → Health check
```

### After (Production)
```
https://demo.colaps.team/spellwise               → Client (React SPA)
https://demo.colaps.team/spellwise/api/*        → Server API
https://demo.colaps.team/spellwise/static/*     → Audio files
https://demo.colaps.team/spellwise/health       → Health check
```

### Reverse Proxy Handling

**Main Reverse Proxy Routes:**
```
/spellwise → http://localhost:3000 (Nginx container)
/otherapp  → http://localhost:3001 (Other app)
/etc       → http://localhost:3002 (etc...)
```

---

## 📝 API Client Configuration

### For Frontend (src/services/api.ts)

Update to use `/spellwise` prefix:

```typescript
const API_BASE = '/spellwise/api';

export const API = {
  login: (email: string, password: string, role: 'teacher' | 'student') =>
    fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role })
    }).then(r => r.json())
  
  // ... rest of API calls use ${API_BASE}
};
```

### For Server (src/index.ts)

No changes needed - server listens on `/api/*` internally.

---

## 🚢 Deployment Checklist

Before going live at `https://demo.colaps.team/spellwise`:

- [ ] `.env` file created with production secrets
- [ ] MongoDB credentials set and secured
- [ ] OpenAI API key configured
- [ ] JWT secrets are long, random, and unique
- [ ] `NODE_ENV=production` set
- [ ] Images built: `docker-compose -f docker-compose.multiapp.yml build`
- [ ] Services started: `docker-compose -f docker-compose.multiapp.yml up -d`
- [ ] Health check passing: `curl https://demo.colaps.team/spellwise/health`
- [ ] Client loads: `https://demo.colaps.team/spellwise`
- [ ] Can signup/login
- [ ] API calls working (check Network tab)
- [ ] Audio files loading from `/spellwise/static/`
- [ ] Reverse proxy correctly routing `/spellwise` traffic

---

## 🔍 Debugging Multi-App Issues

### Issue: API calls fail (404 or CORS errors)

**Check:**
```bash
# Verify server is running
docker-compose -f docker-compose.multiapp.yml logs server

# Test API internally
curl http://localhost:4000/health

# Check nginx config is correct
docker-compose -f docker-compose.multiapp.yml exec client cat /etc/nginx/conf.d/default.conf
```

### Issue: Static files (CSS, JS) fail to load

**Check:**
- Vite built with correct base path: `VITE_BASE_PATH=/spellwise/`
- Assets are in `client/dist/assets/`
- Nginx correctly serves from `/spellwise/assets/`

**Fix:**
```bash
docker-compose -f docker-compose.multiapp.yml build --no-cache client
docker-compose -f docker-compose.multiapp.yml up -d client
```

### Issue: SPA routes show 404

**Check:**
- nginx.conf has `try_files` fallback to `index.html`
- All `/spellwise/*` routes redirect to index for client-side routing

### Issue: External reverse proxy doesn't route to app

**Check:**
- Reverse proxy has rule: `PathPrefix('/spellwise')` or similar
- Proxy forwards to `http://localhost:3000` (or container name)
- No path stripping (nginx container handles stripping)

---

## 📊 Monitoring

### Container Status
```bash
docker-compose -f docker-compose.multiapp.yml ps
```

### Service Logs
```bash
# All services
docker-compose -f docker-compose.multiapp.yml logs -f

# Specific service
docker-compose -f docker-compose.multiapp.yml logs -f client
docker-compose -f docker-compose.multiapp.yml logs -f server
docker-compose -f docker-compose.multiapp.yml logs -f mongodb
```

### Health Checks
```bash
# Client health
curl http://localhost:3000/

# Server health
curl http://localhost:4000/health

# Through reverse proxy
curl https://demo.colaps.team/spellwise/health
```

---

## 🔐 Security Considerations

### SSL/TLS
- Main reverse proxy (demo.colaps.team) handles HTTPS
- Internal communication between services is HTTP (secure network)
- No additional SSL needed for inter-container communication

### Authentication
- JWT tokens secure API calls
- Refresh token rotation for security
- Non-root user in containers

### Environment Secrets
- Use `.env` file (not in version control)
- Change default MongoDB password
- Use strong JWT secrets
- Keep OpenAI API key confidential

### Base Path Security
- `/spellwise` path isolation
- Other apps at `/otherapp`, etc. don't interfere
- Nginx enforces path-based routing

---

## 🆘 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| API returns 404 from `/spellwise/api/*` | Check nginx.conf proxy rule and BASE_PATH env var |
| CSS/JS files return 404 | Ensure vite.config.ts has correct base path |
| SPA routes show 404 | Verify nginx `try_files` redirect to index.html |
| MongoDB connection fails | Check MONGO_URI includes auth database: `?authSource=admin` |
| Reverse proxy can't reach container | Ensure expose port 3000, not ports mapping |
| CORS errors | Check X-Forwarded-Proto and Host headers |

---

## 📚 Additional Resources

- **Traefik Docs:** https://docs.traefik.io/
- **Nginx Reverse Proxy:** http://nginx.org/en/docs/http/ngx_http_proxy_module.html
- **React Router Base Path:** https://reactrouter.com/start/library/how-do-i-handle-absolute-links
- **Vite Config:** https://vitejs.dev/config/

---

## 🎯 Next Steps

1. **Test Locally:**
   ```bash
   docker-compose -f docker-compose.multiapp.yml up -d
   # Access at http://localhost:3000
   ```

2. **Deploy to Server:**
   - Copy files to deployment server
   - Configure `.env` with production secrets
   - Run: `docker-compose -f docker-compose.multiapp.yml up -d`

3. **Configure Main Reverse Proxy:**
   - Update demo.colaps.team config
   - Route `/spellwise` to `http://localhost:3000`
   - Test: `https://demo.colaps.team/spellwise`

4. **Monitor:**
   - Watch logs for errors
   - Check health endpoints
   - Verify all functionality works

---

**Ready to deploy to production!** 🚀
