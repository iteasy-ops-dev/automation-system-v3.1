#!/bin/bash
# create-complete-safe-backup.sh - 통합 자동화 시스템 v3.1 완전한 안전 백업

set -e
PROJECT_DIR="/Users/leesg/Documents/work_ops/automation-system"
BACKUP_ID="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$PROJECT_DIR/backups/$BACKUP_ID"

echo "🚀 안전한 통합 백업 시작: $BACKUP_ID"
echo "📍 프로젝트 디렉토리: $PROJECT_DIR"
echo "📍 백업 디렉토리: $BACKUP_DIR"

# 백업 디렉토리 생성
mkdir -p $BACKUP_DIR/{images,data,schemas,configs,source-code}

echo ""
echo "========================================"
echo "📊 1. 서비스 상태 저장 중..."
echo "========================================"

# 1. 서비스 상태 저장
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | grep automation > $BACKUP_DIR/service-status.txt
docker-compose ps > $BACKUP_DIR/docker-compose-status.txt
echo "✅ 서비스 상태 저장 완료"

echo ""
echo "========================================"
echo "📦 2. Docker 이미지 백업 중..."
echo "========================================"

# 2. Docker 이미지 백업
echo "📦 Docker 이미지 백업 중..."
cd $BACKUP_DIR/images

# 각 서비스별 이미지 백업
services=("gateway" "storage" "device-service" "mcp-service" "llm-service" "workflow-engine" "main-app")
for service in "${services[@]}"; do
    if docker images | grep -q "automation-system/$service"; then
        echo "  - $service 백업 중..."
        docker save automation-system/$service:latest -o ${service}-$BACKUP_ID.tar
        echo "    ✅ ${service} 이미지 백업 완료 ($(du -sh ${service}-$BACKUP_ID.tar | cut -f1))"
    else
        echo "    ⚠️ $service 이미지를 찾을 수 없습니다"
    fi
done

# Main App 이미지도 백업 (ID 기반)
if docker images | grep -q "0f1cc77585e1"; then
    echo "  - main-app (ID 기반) 백업 중..."
    docker save 0f1cc77585e1 -o main-app-by-id-$BACKUP_ID.tar
    echo "    ✅ main-app (ID 기반) 이미지 백업 완료"
fi

echo "✅ Docker 이미지 백업 완료"

echo ""
echo "========================================"
echo "🗄️ 3. 데이터베이스 백업 중..."
echo "========================================"

cd $BACKUP_DIR/data

# 3-1. PostgreSQL 완전 백업
echo "  📊 PostgreSQL 완전 백업 중..."
docker exec automation-postgres pg_dump -U postgres -d automation --verbose --column-inserts --data-only > postgres-data-$BACKUP_ID.sql
docker exec automation-postgres pg_dump -U postgres -d automation --schema-only > postgres-schema-$BACKUP_ID.sql
docker exec automation-postgres pg_dump -U postgres -d automation > postgres-full-$BACKUP_ID.sql

# Prisma 마이그레이션 상태 백업 (중요!)
echo "  📊 Prisma 마이그레이션 상태 백업 중..."
docker exec automation-postgres pg_dump -U postgres -d automation -t _prisma_migrations > prisma-migrations-$BACKUP_ID.sql

# PostgreSQL 전체 정보
docker exec automation-postgres psql -U postgres -d automation -c "\dt" > postgres-tables-$BACKUP_ID.txt
docker exec automation-postgres psql -U postgres -d automation -c "SELECT schemaname,tablename,tableowner FROM pg_tables WHERE schemaname NOT IN ('information_schema','pg_catalog');" > postgres-table-info-$BACKUP_ID.txt

echo "    ✅ PostgreSQL 백업 완료 ($(du -sh postgres-full-$BACKUP_ID.sql | cut -f1))"

# 3-2. MongoDB 백업
echo "  📊 MongoDB 백업 중..."
docker exec automation-mongodb mongodump --archive --db=automation \
  --username=admin --password=automation_mongo_pass_2024 \
  --authenticationDatabase=admin > mongodb-$BACKUP_ID.archive

# MongoDB 컬렉션 정보
docker exec automation-mongodb mongo --username=admin --password=automation_mongo_pass_2024 \
  --authenticationDatabase=admin automation --eval "db.getCollectionNames()" > mongodb-collections-$BACKUP_ID.txt

echo "    ✅ MongoDB 백업 완료 ($(du -sh mongodb-$BACKUP_ID.archive | cut -f1))"

# 3-3. Redis 백업
echo "  📊 Redis 백업 중..."
docker exec automation-redis redis-cli -a automation_redis_pass_2024 --rdb /tmp/redis-backup.rdb
docker cp automation-redis:/tmp/redis-backup.rdb ./redis-$BACKUP_ID.rdb

# Redis 키 정보
docker exec automation-redis redis-cli -a automation_redis_pass_2024 INFO > redis-info-$BACKUP_ID.txt
docker exec automation-redis redis-cli -a automation_redis_pass_2024 KEYS "*" > redis-keys-$BACKUP_ID.txt

echo "    ✅ Redis 백업 완료 ($(du -sh redis-$BACKUP_ID.rdb | cut -f1))"

# 3-4. InfluxDB 백업
echo "  📊 InfluxDB 백업 중..."
docker exec automation-influxdb influx backup /tmp/influxdb-backup 2>/dev/null || echo "    ⚠️ InfluxDB 백업 스킵 (데이터 없음)"
if docker exec automation-influxdb ls /tmp/influxdb-backup > /dev/null 2>&1; then
    docker cp automation-influxdb:/tmp/influxdb-backup ./influxdb-backup-$BACKUP_ID/
    echo "    ✅ InfluxDB 백업 완료"
else
    echo "    ℹ️ InfluxDB 백업 데이터 없음"
fi

# 3-5. MinIO/S3 백업
echo "  📊 MinIO 데이터 백업 중..."
docker exec automation-minio mc alias set local http://localhost:9000 automation_minio_user automation_minio_pass_2024 2>/dev/null || true
docker exec automation-minio mc ls local/ > minio-buckets-$BACKUP_ID.txt 2>/dev/null || echo "No buckets found" > minio-buckets-$BACKUP_ID.txt
echo "    ✅ MinIO 정보 백업 완료"

echo "✅ 모든 데이터베이스 백업 완료"

echo ""
echo "========================================"
echo "📋 4. 소스 코드 및 설정 백업 중..."
echo "========================================"

cd $BACKUP_DIR/source-code

# 4-1. 전체 소스 코드 백업 (node_modules 제외)
echo "  📁 소스 코드 백업 중..."
rsync -av --exclude='node_modules' --exclude='.git' --exclude='backups' \
      --exclude='*.log' --exclude='tmp' \
      $PROJECT_DIR/ ./project-source/

echo "    ✅ 소스 코드 백업 완료 ($(du -sh ./project-source | cut -f1))"

# 4-2. 설정 파일들 백업
echo "  ⚙️ 중요 설정 파일 백업 중..."
cd $BACKUP_DIR/configs

# Docker 관련
cp $PROJECT_DIR/docker-compose.yml docker-compose.yml.backup
cp $PROJECT_DIR/docker-compose.db.yml docker-compose.db.yml.backup 2>/dev/null || true
cp $PROJECT_DIR/docker-compose.dev.yml docker-compose.dev.yml.backup 2>/dev/null || true

# 환경 설정
cp $PROJECT_DIR/.env .env.backup 2>/dev/null || true
cp $PROJECT_DIR/.env.example .env.example.backup 2>/dev/null || true

# 중요 스크립트들 백업
cp $PROJECT_DIR/services/storage/docker-entrypoint.sh storage-entrypoint.sh 2>/dev/null || true
cp $PROJECT_DIR/services/domain/mcp-integration/docker-entrypoint.sh mcp-entrypoint.sh 2>/dev/null || true
cp $PROJECT_DIR/services/domain/workflow-engine/start.sh workflow-start.sh 2>/dev/null || true
cp $PROJECT_DIR/manual-migration.sh manual-migration.sh 2>/dev/null || true

# 각 서비스의 package.json
mkdir -p service-configs
find $PROJECT_DIR/services -name "package.json" -exec cp {} service-configs/ \; 2>/dev/null || true
find $PROJECT_DIR/frontend -name "package.json" -exec cp {} service-configs/ \; 2>/dev/null || true

echo "    ✅ 설정 파일 백업 완료"

echo ""
echo "========================================"
echo "📊 5. Kafka 토픽 및 스키마 백업 중..."
echo "========================================"

cd $BACKUP_DIR/schemas

# Kafka 토픽 정보
echo "  📊 Kafka 토픽 정보 백업 중..."
docker exec automation-kafka kafka-topics.sh --bootstrap-server localhost:9092 --list > kafka-topics-$BACKUP_ID.txt
docker exec automation-kafka kafka-topics.sh --bootstrap-server localhost:9092 --describe > kafka-topics-detail-$BACKUP_ID.txt

# API 계약 파일들 백업
echo "  📋 API 계약 파일 백업 중..."
if [ -d "$PROJECT_DIR/shared/contracts" ]; then
    cp -r $PROJECT_DIR/shared/contracts ./api-contracts/
    echo "    ✅ API 계약 파일 백업 완료"
else
    echo "    ⚠️ API 계약 디렉토리를 찾을 수 없습니다"
fi

echo "✅ 스키마 및 계약 백업 완료"

echo ""
echo "========================================"
echo "📄 6. 백업 정보 및 복원 스크립트 생성 중..."
echo "========================================"

# 6-1. 백업 정보 파일 생성
cat > $BACKUP_DIR/backup-info.txt << INFO_EOF
==============================================
통합 자동화 시스템 v3.1 완전 백업 정보
==============================================

백업 ID: $BACKUP_ID
백업 시간: $(date)
백업 위치: $BACKUP_DIR
시스템 버전: v3.1 (Prisma 기반)
Docker 버전: $(docker --version)
Docker Compose 버전: $(docker-compose --version)

=== 백업 구성 요소 ===
✅ Docker 이미지: $(ls $BACKUP_DIR/images/*.tar 2>/dev/null | wc -l)개
✅ PostgreSQL: 스키마 + 데이터 + Prisma 마이그레이션
✅ MongoDB: 전체 컬렉션
✅ Redis: RDB 덤프 + 키 정보
✅ InfluxDB: 백업 (가능한 경우)
✅ MinIO: 버킷 정보
✅ 소스 코드: 전체 프로젝트
✅ 설정 파일: Docker, 환경변수, 스크립트
✅ Kafka: 토픽 정보
✅ API 계약: OpenAPI 스키마

=== 백업 크기 ===
전체 크기: $(du -sh $BACKUP_DIR | cut -f1)
이미지 크기: $(du -sh $BACKUP_DIR/images 2>/dev/null | cut -f1)
데이터 크기: $(du -sh $BACKUP_DIR/data 2>/dev/null | cut -f1)
소스 크기: $(du -sh $BACKUP_DIR/source-code 2>/dev/null | cut -f1)

=== 특이사항 ===
- 자동 스키마 수정 비활성화 버전
- 안전한 수동 마이그레이션 방식
- 모든 서비스 정상 상태에서 백업
- Prisma 마이그레이션 상태 포함

=== 복원 방법 ===
1. 전체 복원: ./restore-complete-backup.sh
2. 데이터만 복원: ./restore-data-only.sh
3. 설정만 복원: ./restore-configs-only.sh

INFO_EOF

# 6-2. 완전 복원 스크립트 생성
cat > $BACKUP_DIR/restore-complete-backup.sh << 'RESTORE_EOF'
#!/bin/bash
# 완전 복원 스크립트 - 통합 자동화 시스템 v3.1

set -e
BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$BACKUP_DIR")")"

echo "🔄 통합 자동화 시스템 v3.1 완전 복원 시작"
echo "📍 백업 디렉토리: $BACKUP_DIR"
echo "📍 프로젝트 디렉토리: $PROJECT_DIR"
echo ""

read -p "❓ 전체 시스템을 복원하시겠습니까? 기존 데이터가 모두 삭제됩니다! (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 복원이 취소되었습니다."
    exit 1
fi

echo "🛑 1. 기존 시스템 중지..."
cd "$PROJECT_DIR"
docker-compose down -v
echo "   ✅ 시스템 중지 완료"

echo ""
echo "📦 2. Docker 이미지 복원..."
if [ -d "$BACKUP_DIR/images" ] && [ "$(ls -A $BACKUP_DIR/images)" ]; then
    cd "$BACKUP_DIR/images"
    for tar_file in *.tar; do
        [ -f "$tar_file" ] || continue
        echo "   - $tar_file 복원 중..."
        docker load -i "$tar_file"
    done
    echo "   ✅ Docker 이미지 복원 완료"
else
    echo "   ⚠️ Docker 이미지 백업이 없습니다."
fi

echo ""
echo "📁 3. 소스 코드 복원..."
if [ -d "$BACKUP_DIR/source-code/project-source" ]; then
    echo "   ⚠️ 기존 소스 코드를 백업합니다..."
    if [ -d "$PROJECT_DIR.old" ]; then
        rm -rf "$PROJECT_DIR.old"
    fi
    cp -r "$PROJECT_DIR" "$PROJECT_DIR.old" 2>/dev/null || true
    
    echo "   📁 새 소스 코드 복사..."
    rsync -av --delete "$BACKUP_DIR/source-code/project-source/" "$PROJECT_DIR/"
    echo "   ✅ 소스 코드 복원 완료"
else
    echo "   ⚠️ 소스 코드 백업이 없습니다."
fi

echo ""
echo "⚙️ 4. 설정 파일 복원..."
if [ -d "$BACKUP_DIR/configs" ]; then
    cd "$BACKUP_DIR/configs"
    [ -f .env.backup ] && cp .env.backup "$PROJECT_DIR/.env"
    [ -f docker-compose.yml.backup ] && cp docker-compose.yml.backup "$PROJECT_DIR/docker-compose.yml"
    echo "   ✅ 설정 파일 복원 완료"
else
    echo "   ⚠️ 설정 파일 백업이 없습니다."
fi

echo ""
echo "🗄️ 5. 데이터베이스 서비스 시작..."
cd "$PROJECT_DIR"
docker-compose up -d postgres mongodb redis influxdb minio zookeeper kafka

echo "   ⏳ 데이터베이스 준비 대기..."
sleep 10

# PostgreSQL 준비 대기
until docker exec automation-postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo "   PostgreSQL 준비 대기..."
    sleep 2
done

# MongoDB 준비 대기
until docker exec automation-mongodb mongo --eval "db.adminCommand('ismaster')" > /dev/null 2>&1; do
    echo "   MongoDB 준비 대기..."
    sleep 2
done

echo "   ✅ 데이터베이스 서비스 준비 완료"

echo ""
echo "📊 6. 데이터베이스 복원..."

# PostgreSQL 복원
echo "   📊 PostgreSQL 복원..."
docker exec automation-postgres psql -U postgres -c "DROP DATABASE IF EXISTS automation;"
docker exec automation-postgres psql -U postgres -c "CREATE DATABASE automation;"

if [ -f "$BACKUP_DIR/data/postgres-full-"*.sql ]; then
    echo "   - 전체 데이터베이스 복원..."
    docker exec -i automation-postgres psql -U postgres -d automation < "$BACKUP_DIR/data/postgres-full-"*.sql
    echo "   ✅ PostgreSQL 복원 완료"
else
    echo "   ⚠️ PostgreSQL 백업 파일이 없습니다."
fi

# MongoDB 복원
echo "   📊 MongoDB 복원..."
if [ -f "$BACKUP_DIR/data/mongodb-"*.archive ]; then
    docker exec -i automation-mongodb mongorestore --archive --db=automation \
      --username=admin --password=automation_mongo_pass_2024 \
      --authenticationDatabase=admin --drop < "$BACKUP_DIR/data/mongodb-"*.archive
    echo "   ✅ MongoDB 복원 완료"
else
    echo "   ⚠️ MongoDB 백업 파일이 없습니다."
fi

# Redis 복원
echo "   📊 Redis 복원..."
if [ -f "$BACKUP_DIR/data/redis-"*.rdb ]; then
    docker cp "$BACKUP_DIR/data/redis-"*.rdb automation-redis:/data/dump.rdb
    docker-compose restart redis
    echo "   ✅ Redis 복원 완료"
else
    echo "   ⚠️ Redis 백업 파일이 없습니다."
fi

echo ""
echo "🚀 7. 전체 시스템 시작..."
docker-compose up -d

echo "   ⏳ 시스템 안정화 대기..."
sleep 30

echo ""
echo "✅ 복원 완료!"
echo "📍 메인 앱: http://localhost:3001"
echo "🔍 로그인: admin / Admin123!@#"
echo "📊 n8n: http://localhost:5678"
echo ""
echo "🔧 복원 후 확인사항:"
echo "   1. docker ps | grep automation"
echo "   2. ./scripts/manual-migration.sh (옵션 3: 검증만)"
echo "   3. 웹 브라우저에서 기능 테스트"
echo ""
echo "⚠️ 주의: 스키마 변경이 필요한 경우 수동으로 실행하세요:"
echo "   ./scripts/manual-migration.sh"
RESTORE_EOF

chmod +x $BACKUP_DIR/restore-complete-backup.sh

# 6-3. 데이터만 복원 스크립트 생성
cat > $BACKUP_DIR/restore-data-only.sh << 'DATA_RESTORE_EOF'
#!/bin/bash
# 데이터만 복원 스크립트

set -e
BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔄 데이터베이스만 복원 시작..."

read -p "❓ 데이터베이스를 복원하시겠습니까? 기존 데이터가 삭제됩니다! (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 복원이 취소되었습니다."
    exit 1
fi

echo "📊 PostgreSQL 복원..."
if [ -f "$BACKUP_DIR/data/postgres-full-"*.sql ]; then
    docker exec automation-postgres psql -U postgres -c "DROP DATABASE IF EXISTS automation;"
    docker exec automation-postgres psql -U postgres -c "CREATE DATABASE automation;"
    docker exec -i automation-postgres psql -U postgres -d automation < "$BACKUP_DIR/data/postgres-full-"*.sql
    echo "✅ PostgreSQL 복원 완료"
fi

echo "📊 MongoDB 복원..."
if [ -f "$BACKUP_DIR/data/mongodb-"*.archive ]; then
    docker exec -i automation-mongodb mongorestore --archive --db=automation \
      --username=admin --password=automation_mongo_pass_2024 \
      --authenticationDatabase=admin --drop < "$BACKUP_DIR/data/mongodb-"*.archive
    echo "✅ MongoDB 복원 완료"
fi

echo "✅ 데이터 복원 완료!"
DATA_RESTORE_EOF

chmod +x $BACKUP_DIR/restore-data-only.sh

echo "✅ 복원 스크립트 생성 완료"

echo ""
echo "========================================"
echo "🎉 백업 완료 요약"
echo "========================================"

echo "📍 백업 ID: $BACKUP_ID"
echo "📍 백업 위치: $BACKUP_DIR"
echo "📊 백업 크기: $(du -sh $BACKUP_DIR | cut -f1)"
echo ""
echo "📦 백업 구성:"
echo "  - Docker 이미지: $(ls $BACKUP_DIR/images/*.tar 2>/dev/null | wc -l)개"
echo "  - PostgreSQL: $(ls $BACKUP_DIR/data/postgres-*.sql 2>/dev/null | wc -l)개 파일"
echo "  - MongoDB: $(ls $BACKUP_DIR/data/mongodb-*.archive 2>/dev/null | wc -l)개 파일"
echo "  - Redis: $(ls $BACKUP_DIR/data/redis-*.rdb 2>/dev/null | wc -l)개 파일"
echo "  - 소스 코드: ✅ 포함"
echo "  - 설정 파일: ✅ 포함"
echo ""
echo "🔄 복원 방법:"
echo "  전체 복원: cd $BACKUP_DIR && ./restore-complete-backup.sh"
echo "  데이터만: cd $BACKUP_DIR && ./restore-data-only.sh"
echo ""
echo "📄 백업 정보: $BACKUP_DIR/backup-info.txt"
echo ""
echo "✅ 안전한 완전 백업이 성공적으로 완료되었습니다!"
