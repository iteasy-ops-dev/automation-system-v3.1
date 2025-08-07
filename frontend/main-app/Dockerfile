# Main Application Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Set build arguments for API URL
ARG VITE_API_BASE_URL=http://localhost:8080
ARG VITE_WS_HOST=localhost:8080
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_HOST=$VITE_WS_HOST

# Copy source code
COPY . .

# Build the application with production environment
RUN npm run build

# Production stage
FROM nginx:alpine

# Install curl for health check
RUN apk add --no-cache curl

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
