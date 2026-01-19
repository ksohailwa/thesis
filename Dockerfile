# Multi-stage build for SpellWise monorepo

# Stage 1: Build everything
FROM node:20-alpine AS builder

WORKDIR /app

# Copy all package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
COPY shared/package*.json ./shared/

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Ensure server/static directory exists (for generated audio files)
RUN mkdir -p /app/server/static/audio

# Build shared, then server and client
RUN npm run build --workspace=@spellwise/shared
RUN npm run build --workspace=@spellwise/server

# Build client with root base path for Docker
ENV VITE_BASE_PATH=/
RUN npm run build --workspace=@spellwise/client

# Stage 2: Production server
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY shared/package*.json ./shared/

# Install production dependencies only
RUN npm ci --omit=dev --workspace=@spellwise/shared --workspace=@spellwise/server

# Copy built server and shared
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/dist ./server/dist

# Copy built client to server static folder
COPY --from=builder /app/client/dist ./server/static/client

# Copy server static assets
COPY --from=builder /app/server/static ./server/static

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["node", "server/dist/index.js"]
