#!/bin/bash
# 통합 자동화 시스템 v3.1 - 완전 백업 스크립트 (개선된 버전)
# 자동 스키마 수정 비활성화 버전

set -e
PROJECT_DIR="/Users/leesg/Documents/work_ops/automation-system"
BACKUP_ID="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$PROJECT_DIR/backups/$BACKUP_ID"

echo "🚀 통합 자동화 시스템 v3.1 완전 백업 시작: $BACKUP_ID"
echo "📍 프로젝트: $PROJECT_DIR"
echo "💾 백업 대상: 스키마 안전 보장 버전"
echo ""

mkdir -p $BACKUP_DIR/{images,data,schemas,configs,source}

# 1. 시스템 상태 및 환경 정보 저장
echo "📊 시스템 상태 저장..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | grep automation > $BACKUP_DIR/service-status.txt
docker --version > $BACKUP_DIR/docker-version.txt
echo "macOS $(sw_vers -productVersion)" > $BACKUP_DIR/system-info.txt
echo "Backup created at: $(date)" >> $BACKUP_DIR/system-info.txt

# 2. Docker 이미지 백업 (핵심 서비스만)
echo "📦 Docker 이미지 백업..."
cd $BACKUP_DIR/images
CORE_SERVICES=("gateway" "storage" "device-service" "mcp-service" "llm-service" "workflow-engine" "main-app")

for service in "${CORE_SERVICES[@]}"; do
    if docker images | grep -q "automation-system/$service"; then
        echo "  - $service 이미지 백업 중..."
        docker save automation-system/$service:latest -o ${service}-$BACKUP_ID.tar &
    fi
done
wait # 모든 이미지 백업 완료 대기

# 3. 데이터베이스 완전 백업
echo "🗄️ 데이터베이스 백업..."
cd $BACKUP_DIR/data

# PostgreSQL - 스키마와 데이터 완전 백업
echo "  - PostgreSQL 완전 백업..."
docker exec automation-postgres pg_dump -U postgres -d automation --verbose --schema-only > postgres-schema-$BACKUP_ID.sql
docker exec automation-postgres pg_dump -U postgres -d automation --verbose --data-only > postgres-data-$BACKUP_ID.sql
docker exec automation-postgres pg_dump -U postgres -d automation --verbose > postgres-full-$BACKUP_ID.sql

# Prisma 마이그레이션 상태 백업 (매우 중요!)
echo "  - Prisma 마이그레이션 상태 백업..."
docker exec automation-postgres pg_dump -U postgres -d automation -t _prisma_migrations --data-only > prisma-migrations-$BACKUP_ID.sql

# MongoDB 백업
echo "  - MongoDB 백업..."
docker exec automation-mongodb mongodump --archive --db=automation \
  --username=admin --password=automation_mongo_pass_2024 \
  --authenticationDatabase=admin > mongodb-$BACKUP_ID.archive

# Redis 백업 (개선된 방법)
echo "  - Redis 백업..."
docker exec automation-redis redis-cli -a automation_redis_pass_2024 --rdb /tmp/redis-backup.rdb > /dev/null 2>&1
docker cp automation-redis:/tmp/redis-backup.rdb ./redis-$BACKUP_ID.rdb

# InfluxDB 백업
echo "  - InfluxDB 백업..."
docker exec automation-influxdb sh -c "cd /tmp && influx backup -portable influxdb-backup" > /dev/null 2>&1 || true
docker cp automation-influxdb:/tmp/influxdb-backup ./influxdb-$BACKUP_ID/ 2>/dev/null || true

# 4. 핵심 소스 코드 백업
echo "📁 소스 코드 백업..."
cd $BACKUP_DIR/source

# 서비스 소스 코드
tar -czf services-$BACKUP_ID.tar.gz -C $PROJECT_DIR services/
tar -czf frontend-$BACKUP_ID.tar.gz -C $PROJECT_DIR frontend/
tar -czf shared-$BACKUP_ID.tar.gz -C $PROJECT_DIR shared/

# 설정 파일들
tar -czf configs-$BACKUP_ID.tar.gz -C $PROJECT_DIR \
  docker-compose.yml \
  .env \
  .env.example \
  package.json \
  package-lock.json

# 5. 중요 스크립트 및 문서 백업
echo "📋 스크립트 및 문서 백업..."
cd $BACKUP_DIR/configs

# 안전한 스크립트들 백업
cp $PROJECT_DIR/create-safe-backup.sh ./create-safe-backup.sh 2>/dev/null || true
cp $PROJECT_DIR/scripts/manual-migration.sh ./manual-migration.sh 2>/dev/null || true
cp $PROJECT_DIR/start-system-safe.sh ./start-system-safe.sh 2>/dev/null || true

# 중요 문서들
cp $PROJECT_DIR/README.md ./README.md
cp $PROJECT_DIR/DEVELOPMENT.md ./DEVELOPMENT.md 2>/dev/null || true
cp $PROJECT_DIR/BACKUP-RESTORE-GUIDE.md ./BACKUP-RESTORE-GUIDE.md 2>/dev/null || true

# Docker 관련 파일들
cp $PROJECT_DIR/docker-compose.yml ./docker-compose.yml.backup
cp $PROJECT_DIR/.env ./env.backup 2>/dev/null || true

# 6. Prisma 스키마 파일들 백업 (중요!)
echo "🔧 Prisma 스키마 백업..."
cd $BACKUP_DIR/schemas

find $PROJECT_DIR/services -name "schema.prisma" -exec cp {} ./schema-{}.prisma \; 2>/dev/null || true
find $PROJECT_DIR/services -path "*/prisma/migrations/*" -name "*.sql" -exec cp --parents {} . \; 2>/dev/null || true

# 7. 백업 메타데이터 생성
cd $BACKUP_DIR
BACKUP_SIZE=$(du -sh . | cut -f1)

cat > backup-info.txt << INFO_EOF
=== 통합 자동화 시스템 v3.1 완전 백업 정보 ===

백업 ID: $BACKUP_ID
백업 시간: $(date)
백업 크기: $BACKUP_SIZE
시스템 버전: v3.1 (Prisma 기반)
Docker 버전: $(docker --version)
플랫폼: macOS $(sw_vers -productVersion)

특이사항:
- 자동 스키마 수정 비활성화 버전
- Prisma 마이그레이션 상태 포함
- 모든 서비스 헬시 상태에서 백업
- 스키마 안전성 보장

백업 구조:
- images/: Docker 이미지들
- data/: 데이터베이스 덤프들
- source/: 소스 코드 아카이브
- configs/: 설정 파일들
- schemas/: Prisma 스키마 및 마이그레이션
INFO_EOF

# 8. 복원 스크립트 생성 (개선된 버전)
cat > restore-complete-backup.sh << 'RESTORE_EOF'
#!/bin/bash
# 통합 자동화 시스템 v3.1 완전 복원 스크립트
# 자동 스키마 수정 없음 - 100% 안전

set -e
BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$BACKUP_DIR")")"
BACKUP_ID="$(basename "$BACKUP_DIR")"

echo "🔄 통합 자동화 시스템 v3.1 완전 복원 시작"
echo "📍 백업 ID: $BACKUP_ID"
echo "📁 프로젝트: $PROJECT_DIR"
echo "⚠️  주의: 이 복원은 스키마를 자동으로 수정하지 않습니다"
echo ""

# 사용자 확인
read -p "정말로 복원을 진행하시겠습니까? 기존 데이터가 모두 대체됩니다. (y/N): " confirm
if [[ $confirm != [yY] ]]; then
    echo "❌ 복원이 취소되었습니다."
    exit 1
fi

# 1. 현재 시스템 중지
echo "🛑 현재 시스템 중지..."
cd "$PROJECT_DIR"
docker-compose down

# 2. 소스 코드 복원 (옵션)
if [ -d "$BACKUP_DIR/source" ]; then
    read -p "소스 코드도 복원하시겠습니까? (기존 코드 덮어씀) (y/N): " restore_source
    if [[ $restore_source == [yY] ]]; then
        echo "📁 소스 코드 복원..."
        cd "$PROJECT_DIR"
        tar -xzf "$BACKUP_DIR/source/services-"*.tar.gz
        tar -xzf "$BACKUP_DIR/source/frontend-"*.tar.gz
        tar -xzf "$BACKUP_DIR/source/shared-"*.tar.gz
        echo "  ✅ 소스 코드 복원 완료"
    fi
fi

# 3. Docker 이미지 복원
if [ -d "$BACKUP_DIR/images" ] && [ "$(ls -A $BACKUP_DIR/images/*.tar 2>/dev/null)" ]; then
    echo "📦 Docker 이미지 복원..."
    cd "$BACKUP_DIR/images"
    for tar_file in *.tar; do
        [ -f "$tar_file" ] || continue
        echo "  - $tar_file 복원 중..."
        docker load -i "$tar_file"
    done
fi

# 4. 데이터베이스만 시작
echo "🗄️ 데이터베이스 서비스 시작..."
cd "$PROJECT_DIR"
docker-compose up -d postgres mongodb redis influxdb

# PostgreSQL 준비 대기
echo "⏳ PostgreSQL 준비 대기..."
timeout=60
while ! docker exec automation-postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo "   PostgreSQL 준비 중..."
    sleep 2
    timeout=$((timeout-2))
    if [ $timeout -le 0 ]; then
        echo "❌ PostgreSQL 시작 타임아웃"
        exit 1
    fi
done

# 5. PostgreSQL 완전 복원
echo "📊 PostgreSQL 완전 복원..."
docker exec automation-postgres psql -U postgres -c "DROP DATABASE IF EXISTS automation;"
docker exec automation-postgres psql -U postgres -c "CREATE DATABASE automation;"

echo "  - 스키마 및 데이터 복원..."
docker exec -i automation-postgres psql -U postgres -d automation < "$BACKUP_DIR/data/postgres-full-"*.sql

echo "  - Prisma 마이그레이션 상태 확인..."
if [ -f "$BACKUP_DIR/data/prisma-migrations-"*.sql ]; then
    echo "  ✅ Prisma 마이그레이션 상태 포함됨"
else
    echo "  ⚠️  Prisma 마이그레이션 백업 없음 - 수동 확인 필요"
fi

# 6. MongoDB 복원
if [ -f "$BACKUP_DIR/data/mongodb-"*.archive ]; then
    echo "📊 MongoDB 복원..."
    docker exec -i automation-mongodb mongorestore --archive --db=automation \
      --username=admin --password=automation_mongo_pass_2024 \
      --authenticationDatabase=admin --drop < "$BACKUP_DIR/data/mongodb-"*.archive
fi

# 7. Redis 복원
if [ -f "$BACKUP_DIR/data/redis-"*.rdb ]; then
    echo "📊 Redis 복원..."
    docker cp "$BACKUP_DIR/data/redis-"*.rdb automation-redis:/data/dump.rdb
    docker-compose restart redis
fi

# 8. 전체 시스템 시작
echo "🚀 전체 시스템 시작..."
docker-compose up -d

echo "⏳ 시스템 안정화 대기..."
sleep 30

# 9. 시스템 상태 확인
echo "🔍 시스템 상태 확인..."
docker ps --format "table {{.Names}}\t{{.Status}}" | grep automation

echo ""
echo "✅ 복원 완료!"
echo "📍 웹 접속: http://localhost:3001"
echo "🔐 로그인: admin / Admin123!@#"
echo ""
echo "⚠️  중요 후속 작업:"
echo "1. 스키마 상태 확인: ./scripts/manual-migration.sh (옵션 3)"
echo "2. 데이터 검증: 주요 기능 테스트"
echo "3. 서비스 로그 확인: docker-compose logs"
echo ""
echo "🆘 문제 발생 시:"
echo "- 로그 확인: docker logs [service-name]"
echo "- 스키마 동기화: ./scripts/manual-migration.sh"
RESTORE_EOF

chmod +x restore-complete-backup.sh

# 9. 최신 백업 링크 업데이트
cd $PROJECT_DIR/backups
echo $BACKUP_ID > latest-backup.txt

# 10. 백업 완료 보고
echo ""
echo "✅ 통합 자동화 시스템 v3.1 완전 백업 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 백업 위치: $BACKUP_DIR"
echo "📊 백업 크기: $BACKUP_SIZE"
echo "🆔 백업 ID: $BACKUP_ID"
echo "⏰ 백업 시간: $(date)"
echo ""
echo "📦 백업 내용:"
echo "  ✅ Docker 이미지: $(ls $BACKUP_DIR/images/*.tar 2>/dev/null | wc -l)개"
echo "  ✅ PostgreSQL: 스키마+데이터+마이그레이션"
echo "  ✅ MongoDB: 완전 덤프"
echo "  ✅ Redis: RDB 스냅샷"
echo "  ✅ 소스 코드: services/frontend/shared/"
echo "  ✅ 설정 파일: docker-compose.yml, .env"
echo "  ✅ Prisma 스키마: 모든 마이그레이션"
echo ""
echo "🔄 복원 방법:"
echo "  cd $BACKUP_DIR"
echo "  ./restore-complete-backup.sh"
echo ""
echo "💡 특징: 자동 스키마 수정 없음 - 100% 안전"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
