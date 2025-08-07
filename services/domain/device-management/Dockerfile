# ========================================
# Device Management Service Dockerfile
# Multi-stage build for optimization
# ========================================

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

# Build TypeScript
RUN npm run build

# ========================================
# Production stage
# ========================================
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Create logs directory
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8101

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8101/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1) \
  }).on('error', () => process.exit(1))"

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

# Metadata
LABEL maintainer="Backend Team - Domains"
LABEL service="device-management-service"
LABEL version="1.0.0"