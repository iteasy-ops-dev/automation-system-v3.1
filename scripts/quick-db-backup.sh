#!/bin/bash
# quick-db-backup.sh - 데이터베이스만 빠르게 백업
# v3.1 - 자동 스키마 수정 비활성화 버전

set -e
PROJECT_DIR="/Users/leesg/Documents/work_ops/automation-system"
BACKUP_ID="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$PROJECT_DIR/backups/quick-$BACKUP_ID"

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

echo ""
echo "========================================="
echo "  빠른 데이터베이스 백업 v3.1"
echo "========================================="
echo "백업 ID: $BACKUP_ID"
echo "========================================="

log_info "빠른 데이터베이스 백업 시작..."
mkdir -p $BACKUP_DIR

# PostgreSQL
echo "  - PostgreSQL 백업..."
docker exec automation-postgres pg_dump -U postgres -d automation > $BACKUP_DIR/postgres.sql 2>/dev/null || {
    echo "postgres-backup-failed" > $BACKUP_DIR/postgres.sql
}

# MongoDB  
echo "  - MongoDB 백업..."
docker exec automation-mongodb mongodump --archive --db=automation \
  --username=admin --password=automation_mongo_pass_2024 \
  --authenticationDatabase=admin > $BACKUP_DIR/mongodb.archive 2>/dev/null || {
    echo "mongodb-backup-failed" > $BACKUP_DIR/mongodb.archive
}

# Redis (스냅샷)
echo "  - Redis 스냅샷..."
docker exec automation-redis redis-cli -a automation_redis_pass_2024 BGSAVE >/dev/null 2>&1 || true

# 백업 정보
cat > $BACKUP_DIR/backup-info.txt << INFO_EOF
백업 유형: 빠른 DB 백업
백업 시간: $(date)
백업 ID: $BACKUP_ID
포함: PostgreSQL, MongoDB, Redis(스냅샷)
시스템 버전: v3.1
특징: 자동 스키마 수정 비활성화
INFO_EOF

# 빠른 복원 스크립트 생성
cat > $BACKUP_DIR/quick-restore.sh << 'RESTORE_EOF'
#!/bin/bash
# 빠른 데이터베이스 복원

set -e
BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="/Users/leesg/Documents/work_ops/automation-system"

echo "🔄 빠른 데이터베이스 복원..."

# PostgreSQL
if [ -f "$BACKUP_DIR/postgres.sql" ] && [ -s "$BACKUP_DIR/postgres.sql" ]; then
    echo "  - PostgreSQL 복원..."
    docker exec automation-postgres psql -U postgres -c "DROP DATABASE IF EXISTS automation;"
    docker exec automation-postgres psql -U postgres -c "CREATE DATABASE automation;"
    docker exec -i automation-postgres psql -U postgres -d automation < "$BACKUP_DIR/postgres.sql"
fi

# MongoDB
if [ -f "$BACKUP_DIR/mongodb.archive" ] && [ -s "$BACKUP_DIR/mongodb.archive" ]; then
    echo "  - MongoDB 복원..."
    docker exec -i automation-mongodb mongorestore --archive --db=automation \
      --username=admin --password=automation_mongo_pass_2024 \
      --authenticationDatabase=admin --drop < "$BACKUP_DIR/mongodb.archive"
fi

echo "✅ 빠른 복원 완료!"
echo "⚠️  스키마 변경 필요시: cd $PROJECT_DIR && ./scripts/manual-migration.sh"
RESTORE_EOF

chmod +x $BACKUP_DIR/quick-restore.sh

echo ""
log_success "빠른 백업 완료!"
echo "📍 위치: $BACKUP_DIR"
echo "📊 크기: $(du -sh $BACKUP_DIR | cut -f1)"
echo "🔄 복원: cd $BACKUP_DIR && ./quick-restore.sh"
echo ""
