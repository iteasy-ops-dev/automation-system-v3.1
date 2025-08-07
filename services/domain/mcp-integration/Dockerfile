# Multi-stage build for MCP Integration Service
FROM node:18-alpine AS builder

# Install necessary build tools
RUN apk add --no-cache python3 make g++ git openssh-client

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma
ENV DATABASE_URL="postgresql://postgres:automation_postgres_pass_2024@postgres:5432/automation"
RUN npx prisma generate

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies (PostgreSQL client 추가)
RUN apk add --no-cache git openssh-client postgresql-client

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --only=production && npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Copy entrypoint script (올바른 위치에 복사)
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chown nodejs:nodejs docker-entrypoint.sh && chmod +x docker-entrypoint.sh

# Create necessary directories
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app/logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8201

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8201/api/v1/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start the service
CMD ["/bin/sh", "./docker-entrypoint.sh"]
