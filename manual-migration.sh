#!/bin/bash
# manual-migration.sh - 통합 자동화 시스템 수동 마이그레이션 스크립트
# v3.1 - 자동 스키마 수정 비활성화 버전
# ⚠️ 주의: 이 스크립트는 데이터베이스를 수정합니다. 백업을 먼저 하세요!

set -e

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
echo "  통합 자동화 시스템 v3.1 - 수동 마이그레이션"
echo "========================================="
echo "⚠️  경고: 이 스크립트는 데이터베이스 스키마를 수정합니다."
echo "⚠️  중요: 백업 없이 실행하지 마세요!"
echo "========================================="
echo ""

# 백업 확인
echo "📋 최근 백업 확인:"
if [ -f "backups/latest-backup.txt" ]; then
    cat backups/latest-backup.txt | head -3
    echo ""
    read -p "백업이 완료되었습니까? (yes/no): " backup_confirm
    if [ "$backup_confirm" != "yes" ]; then
        echo ""
        log_warning "먼저 백업을 실행하세요:"
        echo "  ./create-safe-backup.sh"
        echo "  또는"
        echo "  ./scripts/quick-db-backup.sh"
        exit 1
    fi
else
    log_error "백업 정보가 없습니다!"
    echo ""
    read -p "백업 없이 계속하시겠습니까? (yes/no): " force_continue
    if [ "$force_continue" != "yes" ]; then
        echo "❌ 취소되었습니다."
        exit 0
    fi
fi

echo ""
read -p "정말로 마이그레이션을 진행하시겠습니까? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    log_error "취소되었습니다."
    exit 0
fi

echo ""
echo "📋 마이그레이션 옵션:"
echo "1) Prisma 마이그레이션 적용 (안전) - 기존 마이그레이션 파일 적용"
echo "2) 스키마 강제 동기화 (위험) - 데이터 손실 가능성"
echo "3) 스키마 검증만 - 현재 상태 확인"
echo ""
read -p "선택하세요 (1/2/3): " choice

case $choice in
    1)
        log_info "Prisma 마이그레이션 적용 중..."
        echo ""
        
        # Storage Service
        log_info "Storage Service 마이그레이션..."
        if docker exec automation-storage npx prisma migrate deploy 2>/dev/null; then
            log_success "Storage Service 마이그레이션 완료"
        else
            log_warning "Storage Service 마이그레이션 실패 (서비스 미실행 가능)"
        fi
        
        # MCP Service
        log_info "MCP Service 마이그레이션..."
        if docker exec automation-mcp-service npx prisma migrate deploy 2>/dev/null; then
            log_success "MCP Service 마이그레이션 완료"
        else
            log_warning "MCP Service 마이그레이션 실패 (서비스 미실행 가능)"
        fi
        
        # Workflow Engine
        log_info "Workflow Engine 마이그레이션..."
        if docker exec automation-workflow-engine npx prisma migrate deploy 2>/dev/null; then
            log_success "Workflow Engine 마이그레이션 완료"
        else
            log_warning "Workflow Engine 마이그레이션 실패 (서비스 미실행 가능)"
        fi
        
        echo ""
        log_success "마이그레이션 적용 완료!"
        ;;
        
    2)
        echo ""
        log_error "⚠️  경고: 스키마 강제 동기화는 데이터 손실 가능성이 있습니다!"
        log_error "⚠️  이 작업은 매우 위험합니다!"
        echo ""
        read -p "정말로 계속하시겠습니까? (FORCE/no): " force_confirm
        
        if [ "$force_confirm" = "FORCE" ]; then
            log_warning "스키마 강제 동기화 중..."
            echo ""
            
            # 각 서비스별 db push
            log_info "Storage Service 스키마 동기화..."
            if docker exec automation-storage npx prisma db push --skip-generate 2>/dev/null; then
                log_success "Storage Service 동기화 완료"
            else
                log_error "Storage Service 동기화 실패"
            fi
            
            log_info "MCP Service 스키마 동기화..."
            if docker exec automation-mcp-service npx prisma db push --skip-generate 2>/dev/null; then
                log_success "MCP Service 동기화 완료"
            else
                log_error "MCP Service 동기화 실패"
            fi
            
            log_info "Workflow Engine 스키마 동기화..."
            if docker exec automation-workflow-engine npx prisma db push --skip-generate 2>/dev/null; then
                log_success "Workflow Engine 동기화 완료"
            else
                log_error "Workflow Engine 동기화 실패"
            fi
            
            echo ""
            log_success "스키마 강제 동기화 완료!"
            log_warning "데이터 무결성을 확인하세요!"
        else
            log_error "취소되었습니다."
        fi
        ;;
        
    3)
        log_info "스키마 검증 중..."
        echo ""
        
        # 각 서비스의 스키마 상태 확인
        echo "========================================="
        log_info "Storage Service 상태:"
        if docker exec automation-storage npx prisma migrate status 2>/dev/null; then
            log_success "Storage Service 상태 확인 완료"
        else
            log_warning "Storage Service 상태 확인 실패 (서비스 미실행 가능)"
        fi
        
        echo ""
        echo "========================================="
        log_info "MCP Service 상태:"
        if docker exec automation-mcp-service npx prisma migrate status 2>/dev/null; then
            log_success "MCP Service 상태 확인 완료"
        else
            log_warning "MCP Service 상태 확인 실패 (서비스 미실행 가능)"
        fi
        
        echo ""
        echo "========================================="
        log_info "Workflow Engine 상태:"
        if docker exec automation-workflow-engine npx prisma migrate status 2>/dev/null; then
            log_success "Workflow Engine 상태 확인 완료"
        else
            log_warning "Workflow Engine 상태 확인 실패 (서비스 미실행 가능)"
        fi
        
        echo ""
        echo "========================================="
        log_info "데이터베이스 연결 상태:"
        
        # PostgreSQL 연결 확인
        if docker exec automation-postgres pg_isready -U postgres >/dev/null 2>&1; then
            log_success "PostgreSQL: 연결됨"
            
            # 테이블 존재 확인
            DEVICE_COUNT=$(docker exec automation-postgres psql -U postgres -d automation -t -c "SELECT COUNT(*) FROM devices;" 2>/dev/null | tr -d ' ' || echo "0")
            MCP_COUNT=$(docker exec automation-postgres psql -U postgres -d automation -t -c "SELECT COUNT(*) FROM mcp_servers;" 2>/dev/null | tr -d ' ' || echo "0")
            
            echo "  - devices 테이블: $DEVICE_COUNT 개"
            echo "  - mcp_servers 테이블: $MCP_COUNT 개"
        else
            log_error "PostgreSQL: 연결 실패"
        fi
        
        # MongoDB 연결 확인
        if docker exec automation-mongodb mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
            log_success "MongoDB: 연결됨"
        else
            log_error "MongoDB: 연결 실패"
        fi
        
        echo "========================================="
        log_success "스키마 검증 완료!"
        ;;
        
    *)
        log_error "잘못된 선택입니다."
        exit 1
        ;;
esac

echo ""
echo "========================================="
echo "📋 마이그레이션 후 확인사항:"
echo "1. 서비스 상태: docker ps | grep automation"
echo "2. 로그 확인: docker logs automation-[service-name]"
echo "3. API 테스트: curl http://localhost:8080/api/v1/system/health"
echo "4. Frontend 접속: http://localhost:3001"
echo "========================================="
echo ""
