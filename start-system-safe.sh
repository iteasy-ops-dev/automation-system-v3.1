#!/bin/bash
# start-system-safe.sh - 통합 자동화 시스템 안전 시작 스크립트
# v3.1 - 자동 스키마 수정 비활성화 버전

set -e
PROJECT_DIR="/Users/leesg/Documents/work_ops/automation-system"
cd $PROJECT_DIR

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo "========================================="
echo "  통합 자동화 시스템 v3.1 - 안전 시작"
echo "========================================="
echo "특징: 자동 스키마 수정 비활성화"
echo "데이터 안전성: 100% 보장"
echo "========================================="
echo ""

# 1. 기본 인프라 시작
log_info "인프라 서비스 시작..."
docker-compose up -d postgres mongodb redis minio influxdb kafka zookeeper

# 2. 데이터베이스 준비 확인
log_info "데이터베이스 준비 확인..."
until docker exec automation-postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo "   PostgreSQL 준비 대기..."
    sleep 2
done
log_success "PostgreSQL 준비 완료"

until docker exec automation-mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
    echo "   MongoDB 준비 대기..."
    sleep 2
done
log_success "MongoDB 준비 완료"

# 3. Storage 서비스 시작 (스키마 수정 없음)
log_info "Storage 서비스 시작..."
docker-compose up -d storage
sleep 5

# Storage 연결 확인
until docker exec automation-storage wget -q -O- http://localhost:8001/api/v1/health > /dev/null 2>&1; do
    echo "   Storage Service 준비 대기..."
    sleep 2
done
log_success "Storage Service 준비 완료"

# 4. 백엔드 서비스 시작
log_info "백엔드 서비스 시작..."
docker-compose up -d gateway device-service mcp-service llm-service workflow-engine

# 5. 각 서비스 연결 확인 (스키마 수정 없음)
log_info "서비스 연결 상태 확인..."

# MCP Service 연결 확인
until docker exec automation-mcp-service wget -q -O- http://localhost:8201/api/v1/health > /dev/null 2>&1; do
    echo "   MCP Service 준비 대기..."
    sleep 2
done
log_success "MCP Service 준비 완료"

# Workflow Engine 연결 확인
until docker exec automation-workflow-engine wget -q -O- http://localhost:8401/api/v1/health > /dev/null 2>&1; do
    echo "   Workflow Engine 준비 대기..."
    sleep 2
done
log_success "Workflow Engine 준비 완료"

# 6. Frontend 시작
log_info "Frontend 서비스 시작..."
docker-compose up -d main-app

# 7. 헬스체크
log_info "시스템 헬스체크..."
sleep 10

# 모든 서비스 상태 확인
ALL_HEALTHY=true
services=("postgres" "mongodb" "redis" "storage" "gateway" "device-service" "mcp-service" "llm-service" "workflow-engine" "main-app")

echo ""
echo "서비스 상태:"
echo "========================================="
for service in "${services[@]}"; do
    STATUS=$(docker inspect -f '{{.State.Health.Status}}' automation-$service 2>/dev/null || echo "no health check")
    RUNNING=$(docker inspect -f '{{.State.Status}}' automation-$service 2>/dev/null || echo "not found")
    
    if [[ "$STATUS" == "unhealthy" ]]; then
        echo -e "❌ $service: ${RED}unhealthy${NC}"
        ALL_HEALTHY=false
    elif [[ "$RUNNING" == "running" ]]; then
        echo -e "✅ $service: ${GREEN}running${NC}"
    else
        echo -e "⚠️  $service: ${YELLOW}$RUNNING${NC}"
        ALL_HEALTHY=false
    fi
done
echo "========================================="
echo ""

if $ALL_HEALTHY; then
    log_success "시스템 시작 완료!"
    echo ""
    echo "접속 정보:"
    echo "📍 Frontend: http://localhost:3001"
    echo "📍 API Gateway: http://localhost:8080"
    echo "🔍 로그인: admin / Admin123!@#"
    echo ""
    echo "⚠️  중요: 스키마 변경이 필요한 경우:"
    echo "   ./scripts/manual-migration.sh"
else
    log_warning "일부 서비스 문제 감지"
    echo ""
    echo "문제 해결 방법:"
    echo "1. 로그 확인: docker logs automation-[service-name]"
    echo "2. 서비스 재시작: docker-compose restart [service-name]"
    echo "3. 스키마 확인: ./scripts/manual-migration.sh"
fi

echo ""
echo "📊 상태 모니터링:"
echo "   docker ps | grep automation"
echo "   docker logs -f automation-[service-name]"
echo ""
