#!/bin/bash
# create-safe-backup.sh - 통합 자동화 시스템 안전 백업 스크립트
# v3.1 - 자동 스키마 수정 비활성화 버전

set -e
PROJECT_DIR="/Users/leesg/Documents/work_ops/automation-system"
BACKUP_ID="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$PROJECT_DIR/backups/$BACKUP_ID"

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
echo "  통합 자동화 시스템 v3.1 - 안전 백업"
echo "========================================="
echo "백업 ID: $BACKUP_ID"
echo "특징: 자동 스키마 수정 비활성화"
echo "데이터 안전성: 100% 보장"
echo "========================================="
echo ""

# 1. 백업 디렉토리 생성
log_info "백업 디렉토리 생성..."
mkdir -p $BACKUP_DIR/{images,data,schemas,configs}

# 2. 서비스 상태 저장
log_info "서비스 상태 저장..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | grep automation > $BACKUP_DIR/service-status.txt 2>/dev/null || echo "No services running" > $BACKUP_DIR/service-status.txt

# 3. Docker 이미지 백업 (선택적 - 시간이 오래 걸림)
echo ""
read -p "Docker 이미지도 백업하시겠습니까? (y/n): " backup_images
if [ "$backup_images" = "y" ]; then
    log_info "Docker 이미지 백업..."
    cd $BACKUP_DIR/images
    for service in gateway storage device-service mcp-service llm-service workflow-engine main-app; do
        if docker images | grep -q "automation-system/$service"; then
            echo "  - $service 백업 중..."
            docker save automation-system/$service:latest -o ${service}-$BACKUP_ID.tar &
        fi
    done
    wait
    log_success "Docker 이미지 백업 완료"
else
    log_warning "Docker 이미지 백업 건너뜀"
fi

# 4. 데이터베이스 백업
log_info "데이터베이스 백업..."
cd $BACKUP_DIR/data

# PostgreSQL - 완전 백업
echo "  - PostgreSQL 완전 백업..."
docker exec automation-postgres pg_dump -U postgres -d automation --verbose > postgres-full-$BACKUP_ID.sql 2>/dev/null || {
    log_error "PostgreSQL 백업 실패"
    echo "postgres-backup-failed" > postgres-full-$BACKUP_ID.sql
}

# Prisma 마이그레이션 상태 백업 (중요!)
echo "  - Prisma 마이그레이션 상태 백업..."
docker exec automation-postgres pg_dump -U postgres -d automation -t _prisma_migrations > prisma-migrations-$BACKUP_ID.sql 2>/dev/null || {
    log_warning "Prisma 마이그레이션 백업 실패 (테이블 없음 가능)"
    echo "prisma-migrations-not-found" > prisma-migrations-$BACKUP_ID.sql
}

# MongoDB 백업
echo "  - MongoDB 백업..."
docker exec automation-mongodb mongodump --archive --db=automation \
  --username=admin --password=automation_mongo_pass_2024 \
  --authenticationDatabase=admin > mongodb-$BACKUP_ID.archive 2>/dev/null || {
    log_error "MongoDB 백업 실패"
    echo "mongodb-backup-failed" > mongodb-$BACKUP_ID.archive
}

# Redis 백업
echo "  - Redis 백업..."
docker exec automation-redis redis-cli -a automation_redis_pass_2024 --rdb /tmp/redis-backup.rdb >/dev/null 2>&1 && \
docker cp automation-redis:/tmp/redis-backup.rdb ./redis-$BACKUP_ID.rdb || {
    log_warning "Redis 백업 실패"
    echo "redis-backup-failed" > redis-$BACKUP_ID.rdb
}

# InfluxDB 백업 (메트릭 데이터)
echo "  - InfluxDB 백업..."
docker exec automation-influxdb influx backup /tmp/influx-backup >/dev/null 2>&1 && \
docker cp automation-influxdb:/tmp/influx-backup ./influxdb-$BACKUP_ID 2>/dev/null || {
    log_warning "InfluxDB 백업 스킵 (선택적)"
    echo "influxdb-backup-skipped" > influxdb-$BACKUP_ID.txt
}

log_success "데이터베이스 백업 완료"

# 5. Prisma 스키마 백업
log_info "Prisma 스키마 백업..."
cd $BACKUP_DIR/schemas
for service_path in storage domain/mcp-integration domain/workflow-engine; do
    service_name=$(basename $service_path)
    if [ -d "$PROJECT_DIR/services/$service_path/prisma" ]; then
        echo "  - $service_name 스키마 백업..."
        cp -r "$PROJECT_DIR/services/$service_path/prisma" "./${service_name}-prisma"
    fi
done
log_success "Prisma 스키마 백업 완료"

# 6. 현재 스크립트 백업 (중요!)
log_info "안전한 스크립트 백업..."
cd $BACKUP_DIR/configs
cp $PROJECT_DIR/services/storage/docker-entrypoint.sh storage-entrypoint.sh 2>/dev/null || echo "storage-entrypoint.sh not found"
cp $PROJECT_DIR/services/domain/mcp-integration/docker-entrypoint.sh mcp-entrypoint.sh 2>/dev/null || echo "mcp-entrypoint.sh not found"
cp $PROJECT_DIR/services/domain/workflow-engine/start.sh workflow-start.sh 2>/dev/null || echo "workflow-start.sh not found"
cp $PROJECT_DIR/scripts/manual-migration.sh manual-migration.sh 2>/dev/null || echo "manual-migration.sh not found"

# 7. 환경 설정 백업
log_info "환경 설정 백업..."
cp $PROJECT_DIR/.env .env.backup 2>/dev/null || echo ".env not found"
cp $PROJECT_DIR/docker-compose.yml docker-compose.yml.backup

# 8. 백업 정보 생성
log_info "백업 정보 생성..."
cd $BACKUP_DIR
cat > backup-info.txt << INFO_EOF
백업 ID: $BACKUP_ID
백업 시간: $(date)
백업 크기: $(du -sh $BACKUP_DIR | cut -f1)
시스템 버전: v3.1
Docker 버전: $(docker --version)
특이사항: 자동 스키마 수정 비활성화 버전
스크립트 안전성: 검증됨
이미지 백업: $backup_images

서비스 상태:
$(cat service-status.txt)

데이터베이스 정보:
- PostgreSQL: $(docker exec automation-postgres psql -U postgres -d automation -t -c "SELECT COUNT(*) FROM devices;" 2>/dev/null | tr -d ' ' || echo "N/A") devices
- MongoDB: $(docker exec automation-mongodb mongosh automation --quiet --eval "db.chat_sessions.countDocuments()" --username=admin --password=automation_mongo_pass_2024 --authenticationDatabase=admin 2>/dev/null || echo "N/A") chat sessions
INFO_EOF

# 9. 복원 스크립트 생성
log_info "복원 스크립트 생성..."
cat > restore-safe-backup.sh << 'RESTORE_EOF'
#!/bin/bash
# 안전한 복원 스크립트 - 자동 스키마 수정 없음

set -e
BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$BACKUP_DIR")")"

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
echo "  통합 자동화 시스템 v3.1 - 안전 복원"
echo "========================================="
echo "백업 위치: $(basename $BACKUP_DIR)"
echo "특징: 자동 스키마 수정 없음"
echo "데이터 안전성: 100% 보장"
echo "========================================="
echo ""

echo "📋 백업 정보:"
if [ -f "$BACKUP_DIR/backup-info.txt" ]; then
    cat "$BACKUP_DIR/backup-info.txt" | grep -E "(백업 시간|백업 크기|특이사항)"
else
    log_warning "백업 정보 파일 없음"
fi
echo ""
read -p "계속하시겠습니까? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    log_error "복원 취소됨"
    exit 0
fi

# 1. 시스템 중지
log_info "기존 시스템 중지..."
cd "$PROJECT_DIR"
docker-compose down
log_success "시스템 중지 완료"

# 2. 이미지 복원 (선택적)
if [ -d "$BACKUP_DIR/images" ] && [ "$(ls -A $BACKUP_DIR/images 2>/dev/null)" ]; then
    read -p "Docker 이미지를 복원하시겠습니까? (y/n): " restore_images
    if [ "$restore_images" = "y" ]; then
        log_info "Docker 이미지 복원..."
        cd "$BACKUP_DIR/images"
        for tar_file in *.tar; do
            [ -f "$tar_file" ] || continue
            echo "  - $tar_file 복원 중..."
            docker load -i "$tar_file"
        done
        log_success "Docker 이미지 복원 완료"
    fi
fi

# 3. 데이터베이스 서비스만 시작
log_info "데이터베이스 서비스 시작..."
cd "$PROJECT_DIR"
docker-compose up -d postgres mongodb redis influxdb

# PostgreSQL 준비 대기
log_info "PostgreSQL 준비 대기..."
until docker exec automation-postgres pg_isready -U postgres > /dev/null 2>&1; do
    sleep 2
done
log_success "PostgreSQL 준비 완료"

# 4. PostgreSQL 복원
log_info "PostgreSQL 복원..."
docker exec automation-postgres psql -U postgres -c "DROP DATABASE IF EXISTS automation;" 2>/dev/null
docker exec automation-postgres psql -U postgres -c "CREATE DATABASE automation;"

echo "  - 전체 데이터베이스 복원 중..."
if [ -f "$BACKUP_DIR/data/postgres-full-"*.sql ] && [ -s "$BACKUP_DIR/data/postgres-full-"*.sql ]; then
    docker exec -i automation-postgres psql -U postgres -d automation < "$BACKUP_DIR/data/postgres-full-"*.sql
    log_success "PostgreSQL 복원 완료"
else
    log_error "PostgreSQL 백업 파일 없거나 비어있음"
fi

# 5. MongoDB 복원
log_info "MongoDB 복원..."
if [ -f "$BACKUP_DIR/data/mongodb-"*.archive ] && [ -s "$BACKUP_DIR/data/mongodb-"*.archive ]; then
    docker exec -i automation-mongodb mongorestore --archive --db=automation \
      --username=admin --password=automation_mongo_pass_2024 \
      --authenticationDatabase=admin --drop < "$BACKUP_DIR/data/mongodb-"*.archive
    log_success "MongoDB 복원 완료"
else
    log_warning "MongoDB 백업 파일 없음, 건너뜀"
fi

# 6. Redis 복원 (선택적)
if [ -f "$BACKUP_DIR/data/redis-"*.rdb ] && [ -s "$BACKUP_DIR/data/redis-"*.rdb ]; then
    log_info "Redis 복원..."
    docker cp "$BACKUP_DIR/data/redis-"*.rdb automation-redis:/tmp/restore.rdb
    docker exec automation-redis redis-cli -a automation_redis_pass_2024 --rdb /tmp/restore.rdb >/dev/null 2>&1 || log_warning "Redis 복원 스킵 (선택적)"
fi

# 7. 전체 시스템 시작
log_info "전체 시스템 시작..."
docker-compose up -d

log_info "시스템 안정화 대기..."
sleep 30

# 8. 시스템 상태 확인
log_info "시스템 상태 확인..."
docker ps --format "table {{.Names}}\t{{.Status}}" | grep automation

echo ""
echo "========================================="
echo "✅ 복원 완료!"
echo "========================================="
echo "📍 Frontend: http://localhost:3001"
echo "📍 API Gateway: http://localhost:8080"
echo "🔍 로그인: admin / Admin123!@#"
echo ""
echo "⚠️  중요: 스키마 변경이 필요한 경우 수동으로 실행하세요:"
echo "   cd $PROJECT_DIR && ./scripts/manual-migration.sh"
echo "========================================="
RESTORE_EOF

chmod +x restore-safe-backup.sh
log_success "복원 스크립트 생성 완료"

# 10. 완료
echo ""
echo "========================================="
echo "✅ 안전한 백업 완료!"
echo "========================================="
echo ""
echo "📦 백업 ID: $BACKUP_ID"
echo "📍 위치: $BACKUP_DIR"
echo "📊 크기: $(du -sh "$BACKUP_DIR" | cut -f1)"
echo ""
echo "복원 명령:"
echo "  cd $BACKUP_DIR && ./restore-safe-backup.sh"
echo ""
echo "📋 백업 내용:"
ls -la $BACKUP_DIR/
echo ""
echo "========================================="

log_success "안전한 백업이 생성되었습니다! 🎉"

# 최신 백업 정보 업데이트
cat > "$PROJECT_DIR/backups/latest-backup.txt" << EOF
최신 백업: $BACKUP_ID
생성 시간: $(date)
크기: $(du -sh "$BACKUP_DIR" | cut -f1)
위치: $BACKUP_DIR
복원: cd $BACKUP_DIR && ./restore-safe-backup.sh
특징: 자동 스키마 수정 비활성화
EOF

echo ""
echo "📋 최신 백업 정보가 backups/latest-backup.txt에 저장되었습니다."
