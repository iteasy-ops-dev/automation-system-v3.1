# Storage Service Dockerfile - 완전한 마이그레이션 지원
FROM node:18-alpine AS builder

# Install dependencies for building native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Set temporary DATABASE_URL for Prisma generate
ENV DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder"

# Install dependencies and generate Prisma client
RUN npm ci --only=production && \
    npm install -g prisma && \
    npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

# Install runtime dependencies for native modules + PostgreSQL client
RUN apk add --no-cache python3 make g++ postgresql-client

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Install Prisma CLI for runtime
RUN npm install -g prisma

# Copy environment file template
COPY .env.example .env.example

# Copy entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
  CMD node -e "require('http').get('http://localhost:8001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["npm", "start"]