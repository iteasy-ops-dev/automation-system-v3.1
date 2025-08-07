# API Gateway Service Dockerfile
# 통합 자동화 시스템 v3.1

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S gateway -u 1001

WORKDIR /app

# Copy package files and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production && npm cache clean --force

# Copy built application
COPY --from=builder --chown=gateway:nodejs /app/dist ./dist

# Create logs directory with proper permissions
RUN mkdir -p /app/logs && chown -R gateway:nodejs /app/logs

# Switch to non-root user
USER gateway

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
    const options = { host: '0.0.0.0', port: process.env.GATEWAY_PORT || 8080, path: '/health', timeout: 2000 }; \
    const req = http.request(options, (res) => { \
      if (res.statusCode === 200) process.exit(0); else process.exit(1); \
    }); \
    req.on('timeout', () => process.exit(1)); \
    req.on('error', () => process.exit(1)); \
    req.end();"

# Expose port
EXPOSE 8080

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]