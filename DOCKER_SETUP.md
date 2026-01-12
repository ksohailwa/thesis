# SpellWise Docker Setup Guide

## 📦 Overview

This guide covers how to containerize and run SpellWise using Docker and Docker Compose.

**Included in this setup:**
- ✅ Multi-stage builds for optimal image size
- ✅ MongoDB database container
- ✅ Node.js server with health checks
- ✅ Nginx reverse proxy for static files
- ✅ Development and production configurations
- ✅ Security best practices (non-root user, security headers)
- ✅ Automated health checks
- ✅ Volume management for persistence

---

## 🛠️ Prerequisites

### Required
- **Docker Desktop** (19.03+) or Docker Engine
  - Download: https://www.docker.com/products/docker-desktop
- **Docker Compose** (1.29+)
  - Usually included with Docker Desktop

### Recommended
- **Docker CLI** knowledge (basic commands)
- **2GB+ free disk space** for images and containers
- **At least 4GB RAM** allocated to Docker

### Check Installation
```bash
docker --version
docker-compose --version
```

---

## 📁 Project Structure

```
SpellWise/
├── Dockerfile.server          # Server container definition
├── Dockerfile.client          # Client container definition
├── docker-compose.yml         # Multi-container orchestration
├── nginx.conf                 # Nginx configuration
├── .env.docker               # Docker environment variables
├── .dockerignore              # Files to exclude from build
├── server/
│   ├── src/
│   ├── dist/                 # Compiled output (generated)
│   └── package.json
├── client/
│   ├── src/
│   ├── dist/                 # Built static files (generated)
│   └── package.json
└── shared/
    └── package.json
```

---

## 🚀 Quick Start

### 1. Prepare Environment Variables

```bash
# Copy template to actual environment file
cp .env.docker .env

# Edit .env with your values
# IMPORTANT: Change JWT secrets and MongoDB password!
```

**Required variables:**
```
OPENAI_API_KEY=sk-your-actual-key
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-secret-key
MONGO_PASSWORD=strong-password
```

### 2. Build Images

```bash
# Build all images
docker-compose build

# View built images
docker images | grep spellwise
```

### 3. Start Containers

```bash
# Start all services
docker-compose up -d

# View running containers
docker ps

# View service logs
docker-compose logs -f

# View specific service logs
docker-compose logs server
docker-compose logs client
```

### 4. Access Application

- **Client:** http://localhost:3000
- **Server API:** http://localhost:4000
- **MongoDB:** localhost:27017

### 5. Seed Demo Data (Optional)

```bash
# Connect to server container
docker-compose exec server npm run seed:demo

# Or run directly
docker-compose exec server node server/dist/seedDemo.js
```

### 6. Stop Containers

```bash
# Stop services (preserves volumes)
docker-compose stop

# Stop and remove containers (keeps volumes)
docker-compose down

# Stop and remove everything (volumes too)
docker-compose down -v
```

---

## 🏗️ Architecture

### Services Overview

```
┌─────────────────────────────────────────────────────────┐
│              Docker Compose Network                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐      ┌──────────────────────────┐   │
│  │   Nginx      │      │   Node.js Server        │   │
│  │  (Client)    │◄────►│   (Express + TypeScript)│   │
│  │ Port 3000    │      │   Port 4000             │   │
│  └──────────────┘      └────────┬─────────────────┘   │
│                                 │                      │
│                        ┌────────▼────────┐            │
│                        │    MongoDB      │            │
│                        │  (Database)     │            │
│                        │  Port 27017     │            │
│                        └─────────────────┘            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Request
    ↓
[Client: Nginx on Port 3000]
    ├─→ Static files (HTML/CSS/JS)
    └─→ API requests → [Server: Express on Port 4000]
        ├─→ Business logic
        └─→ Database queries → [MongoDB on Port 27017]
```

---

## 📊 Service Details

### MongoDB (mongodb)
- **Image:** mongo:7.0-alpine
- **Port:** 27017 (internal), 27017 (external)
- **Volumes:**
  - `mongodb_data` - Database files
  - `mongodb_config` - Configuration
- **Health Check:** Ping command every 10 seconds
- **Username:** admin (configurable)
- **Password:** password (must change!)

### Server (server)
- **Base Image:** node:20-alpine
- **Port:** 4000
- **Build:** Multi-stage (builder + runtime)
- **User:** nodejs (non-root for security)
- **Volumes:**
  - `./server/static` - Audio files
  - `./logs` - Application logs
- **Environment:**
  - MONGO_URI
  - JWT_ACCESS_SECRET
  - JWT_REFRESH_SECRET
  - OPENAI_API_KEY
- **Health Check:** HTTP GET /health every 30 seconds

### Client (client)
- **Base Image:** nginx:alpine
- **Port:** 3000
- **Build:** Multi-stage (builder + nginx runtime)
- **Static Site Serving:** Nginx
- **SPA Routing:** try_files fallback to index.html
- **Reverse Proxy:** /api routes to server:4000
- **Health Check:** HTTP GET / every 30 seconds

---

## 🔧 Docker Commands Reference

### Image Management
```bash
# List images
docker images

# Remove image
docker rmi spellwise-server

# Build specific service
docker-compose build server

# Force rebuild without cache
docker-compose build --no-cache
```

### Container Management
```bash
# View running containers
docker ps

# View all containers (including stopped)
docker ps -a

# View container logs
docker logs spellwise-server

# Follow logs in real-time
docker logs -f spellwise-server

# View last 50 lines
docker logs --tail 50 spellwise-server

# Execute command in container
docker-compose exec server npm run seed:demo

# Shell into container
docker-compose exec server sh
```

### Volume Management
```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect spellwise_mongodb_data

# Remove unused volumes
docker volume prune

# Backup volume
docker run --rm -v spellwise_mongodb_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/mongodb_backup.tar.gz -C /data .

# Restore volume
docker run --rm -v spellwise_mongodb_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/mongodb_backup.tar.gz -C /data
```

### Network Management
```bash
# List networks
docker network ls

# Inspect network
docker network inspect spellwise_spellwise-network

# View container network info
docker inspect spellwise-server | grep -A 20 NetworkSettings
```

---

## 🐛 Troubleshooting

### Container won't start

**Problem:** Service exits immediately  
**Solution:**
```bash
# Check logs
docker-compose logs server

# Verify environment variables
docker-compose config

# Check port availability
lsof -i :4000
```

### MongoDB connection failed

**Problem:** "connect ECONNREFUSED 127.0.0.1:27017"  
**Solution:**
```bash
# Ensure MongoDB is running
docker-compose ps

# Check MongoDB logs
docker-compose logs mongodb

# Verify MONGO_URI in .env
cat .env | grep MONGO_URI
```

### Port already in use

**Problem:** "Error binding to port 3000"  
**Solution:**
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in .env
CLIENT_PORT=3001
```

### Out of disk space

**Problem:** "No space left on device"  
**Solution:**
```bash
# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune

# Clean everything (be careful!)
docker system prune -a
```

### Container keeps restarting

**Problem:** "restart: unless-stopped" causing loop  
**Solution:**
```bash
# Check logs for errors
docker-compose logs -f server

# Stop auto-restart temporarily
docker-compose stop

# Fix the issue and rebuild
docker-compose build --no-cache
docker-compose up
```

---

## 🔐 Security Best Practices

### 1. Environment Variables
```bash
# ❌ BAD: Secrets in docker-compose.yml
environment:
  JWT_SECRET: hardcoded-secret

# ✅ GOOD: Use .env file
# In docker-compose.yml:
environment:
  JWT_SECRET: ${JWT_SECRET}
# In .env:
JWT_SECRET=actual-secret
```

### 2. Non-Root User
Already implemented in Dockerfiles:
```dockerfile
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs
```

### 3. Image Security Scanning
```bash
# Scan image for vulnerabilities
docker scan spellwise-server

# Or use Trivy
trivy image spellwise-server
```

### 4. Secrets Management
For production, use:
- Docker Secrets (Swarm mode)
- HashiCorp Vault
- AWS Secrets Manager
- GitHub Secrets (for CI/CD)

---

## 📈 Performance Optimization

### Build Optimization
```bash
# Multi-stage builds reduce final image size
# Current approach: ~200MB (optimized)
# Without optimization: ~500MB

# Check image size
docker images spellwise*
```

### Runtime Optimization
```bash
# Limit resources
docker-compose.yml:
services:
  server:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### Database Optimization
```bash
# Add MongoDB indexes
docker-compose exec mongodb mongosh -u admin -p password --authenticationDatabase admin

db.users.createIndex({ email: 1 })
db.experiments.createIndex({ createdBy: 1 })
```

---

## 🚢 Production Deployment

### Pre-Deployment Checklist
- [ ] Change all default passwords
- [ ] Update JWT secrets (use strong, random values)
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS (reverse proxy with SSL)
- [ ] Set up logging aggregation
- [ ] Configure database backups
- [ ] Set resource limits
- [ ] Enable security scanning
- [ ] Set up monitoring/alerts

### Deploy with Swarm Mode
```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml spellwise

# View services
docker service ls

# View logs
docker service logs spellwise_server
```

### Deploy with Kubernetes
```bash
# Convert compose to Kubernetes manifest
kompose convert -f docker-compose.yml

# Apply to cluster
kubectl apply -f *.yaml

# Check status
kubectl get pods
```

### SSL/TLS with Let's Encrypt
```bash
# Add Certbot sidecar to nginx
# Update docker-compose.yml with volume for certificates
# Configure nginx.conf with SSL directives
```

---

## 📝 Logging & Monitoring

### View Logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs server

# Follow logs
docker-compose logs -f

# Last N lines
docker-compose logs --tail 100

# Timestamps
docker-compose logs --timestamps
```

### Container Stats
```bash
# Real-time resource usage
docker stats

# Specific container
docker stats spellwise-server
```

### Health Checks
```bash
# Check health status
docker ps --format "table {{.Names}}\t{{.Status}}"

# Manual health check
curl http://localhost:4000/health
```

---

## 🔄 Development Workflow

### Local Development (without Docker)
```bash
# Still useful for development
npm run dev --workspace=@spellwise/server
npm run dev --workspace=@spellwise/client
```

### Development with Docker
```bash
# Start services
docker-compose up

# In another terminal, make code changes
# Changes to `/server/src` require rebuild:
docker-compose build server
docker-compose up -d server

# For client changes, similarly:
docker-compose build client
docker-compose up -d client
```

### Hot Reload (Experimental)
```bash
# Mount source code as volume
# Update docker-compose.yml:
volumes:
  - ./server/src:/app/server/src
  - ./client/src:/app/client/src

# Requires app to support hot reload
```

---

## 📊 Compose File Reference

### Full Example with Optional Services
```yaml
# See docker-compose.yml for complete example
# Can extend with:
# - Redis (caching)
# - Prometheus (metrics)
# - Grafana (visualization)
# - ELK Stack (logging)
```

---

## 🆘 Getting Help

### Useful Resources
- Docker Docs: https://docs.docker.com
- Docker Compose: https://docs.docker.com/compose
- Node.js Best Practices: https://github.com/goldbergyoni/nodebestpractices
- nginx Configuration: http://nginx.org/en/docs

### Common Issues & Solutions
See "Troubleshooting" section above.

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] `docker ps` shows all 3 containers running
- [ ] `docker-compose logs` show no errors
- [ ] Client accessible at http://localhost:3000
- [ ] Server API responds at http://localhost:4000/health
- [ ] MongoDB connected (check server logs)
- [ ] Can login/signup on client
- [ ] Can create experiment (API working)
- [ ] Health checks passing (green status)

---

## 📚 Additional Resources

### Docker Best Practices
- Use Alpine Linux (lighter images)
- Multi-stage builds (reduce size)
- Non-root users (security)
- Health checks (reliability)
- .dockerignore (faster builds)

### Compose Best Practices
- Pin image versions
- Use named volumes (persistence)
- Set resource limits
- Use networks (isolation)
- Implement health checks

### Example Commands

```bash
# Complete restart
docker-compose down -v && docker-compose up -d

# View all logs
docker-compose logs -f --all

# Backup database
docker-compose exec mongodb mongodump --username admin --password password --authenticationDatabase admin --out /backup

# Monitor performance
watch -n 1 'docker stats --no-stream'
```

---

**End of Docker Setup Guide**

For questions or issues, check logs and troubleshooting section above.
