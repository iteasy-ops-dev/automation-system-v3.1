#!/bin/bash

# 통합 자동화 시스템 시작 스크립트 (마이그레이션 포함)

set -e
PROJECT_DIR="/Users/leesg/Documents/work_ops/automation-system"
cd $PROJECT_DIR

echo "🚀 통합 자동화 시스템 시작..."

# 1. 기본 서비스 시작
echo "📦 데이터베이스 서비스 시작..."
docker-compose up -d postgres mongodb redis minio influxdb kafka zookeeper

# 데이터베이스 준비 대기
echo "⏳ 데이터베이스 준비 대기 (15초)..."
sleep 15

# 2. Storage 서비스 시작 및 마이그레이션
echo "🗄️ Storage 서비스 시작 및 마이그레이션..."
docker-compose up -d storage
sleep 5
docker exec automation-storage npx prisma migrate deploy || echo "Storage 마이그레이션 건너뜀"

# 3. 나머지 서비스 시작
echo "🔧 백엔드 서비스 시작..."
docker-compose up -d gateway device-service mcp-service llm-service workflow-engine

# 4. MCP 서비스 마이그레이션
echo "🔄 MCP 서비스 마이그레이션..."
sleep 5
docker exec automation-mcp-service npx prisma migrate deploy || echo "MCP 마이그레이션 건너뜀"

# transport 필드 기본값 설정 (기존 데이터 호환성)
docker exec automation-postgres psql -U postgres -d automation -c "UPDATE mcp_servers SET transport = 'http' WHERE transport IS NULL;" || true

# 5. Workflow 서비스 마이그레이션
echo "🔄 Workflow 서비스 마이그레이션..."
docker exec automation-workflow-engine npx prisma migrate deploy || echo "Workflow 마이그레이션 건너뜀"

# 6. Frontend 시작
echo "🌐 Frontend 서비스 시작..."
docker-compose up -d main-app

# 7. 상태 확인
echo "⏳ 시스템 안정화 대기 (20초)..."
sleep 20

echo "📊 시스템 상태:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep automation

echo "✅ 시스템 시작 완료!"
echo "📍 접속: http://localhost:3001"
echo "🔍 로그인: admin / Admin123!@#"
