# SpellWise Docker Setup

## Quick Start

```bash
# 1. Copy environment file
cp .env.docker .env

# 2. Update .env with your values
# - OPENAI_API_KEY=sk-...
# - JWT_ACCESS_SECRET=your-secret
# - JWT_REFRESH_SECRET=your-secret
# - MONGO_PASSWORD=strong-password

# 3. Build and start
docker-compose build
docker-compose up -d

# 4. Access
# Client: http://localhost:3000
# Server: http://localhost:4000
# MongoDB: localhost:27017
```

## Services

- **Client** (nginx:alpine) - Port 3000
- **Server** (node:20-alpine) - Port 4000  
- **MongoDB** (mongo:7.0-alpine) - Port 27017

## Commands

```bash
docker-compose up -d              # Start services
docker-compose down               # Stop services
docker-compose logs -f            # View logs
docker-compose ps                 # View status
docker-compose exec server sh     # Shell into server
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port in use | Kill process: `lsof -i :3000` |
| MongoDB won't connect | Check logs: `docker-compose logs mongodb` |
| Build fails | Rebuild: `docker-compose build --no-cache` |
| Out of disk | Prune: `docker system prune -a` |

See DOCKER_SETUP_FULL.md for complete guide.
