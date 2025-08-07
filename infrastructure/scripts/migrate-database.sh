#!/bin/bash
# ========================================
# 데이터베이스 마이그레이션 실행 스크립트
# Flyway 기반 마이그레이션 관리
# ========================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 환경 변수 설정
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-automation}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${POSTGRES_PASSWORD:-automation_password}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
MIGRATION_DIR="$SCRIPT_DIR/../database/migrations"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE} 데이터베이스 마이그레이션 실행${NC}"
echo -e "${BLUE}========================================${NC}"

# PostgreSQL 연결 확인
echo -e "${YELLOW}PostgreSQL 연결 확인...${NC}"
if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ PostgreSQL 연결 실패${NC}"
    echo "연결 정보: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
    exit 1
fi
echo -e "${GREEN}✅ PostgreSQL 연결 성공${NC}"

# 마이그레이션 파일 확인
echo -e "${YELLOW}마이그레이션 파일 확인...${NC}"
if [ ! -d "$MIGRATION_DIR" ]; then
    echo -e "${RED}❌ 마이그레이션 디렉토리 없음: $MIGRATION_DIR${NC}"
    exit 1
fi

MIGRATION_FILES=($(ls $MIGRATION_DIR/V*.sql 2>/dev/null | sort))
if [ ${#MIGRATION_FILES[@]} -eq 0 ]; then
    echo -e "${RED}❌ 마이그레이션 파일이 없습니다${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 발견된 마이그레이션 파일: ${#MIGRATION_FILES[@]}개${NC}"
for file in "${MIGRATION_FILES[@]}"; do
    echo "  - $(basename $file)"
done

# Flyway 메타데이터 테이블 생성 (간단한 버전)
echo -e "${YELLOW}마이그레이션 메타데이터 테이블 확인...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
CREATE TABLE IF NOT EXISTS flyway_schema_history (
    installed_rank INTEGER NOT NULL,
    version VARCHAR(50),
    description VARCHAR(200) NOT NULL,
    type VARCHAR(20) NOT NULL,
    script VARCHAR(1000) NOT NULL,
    checksum INTEGER,
    installed_by VARCHAR(100) NOT NULL,
    installed_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    execution_time INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank)
);
" > /dev/null

echo -e "${GREEN}✅ 메타데이터 테이블 준비 완료${NC}"

# 이미 적용된 마이그레이션 확인
APPLIED_MIGRATIONS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COALESCE(string_agg(version, ','), '') FROM flyway_schema_history WHERE success = true;
" | tr -d ' ')

echo -e "${YELLOW}적용된 마이그레이션: $APPLIED_MIGRATIONS${NC}"

# 마이그레이션 실행
for migration_file in "${MIGRATION_FILES[@]}"; do
    filename=$(basename $migration_file)
    version=$(echo $filename | sed 's/V\([0-9]*\)__.*/\1/')
    description=$(echo $filename | sed 's/V[0-9]*__\(.*\)\.sql/\1/' | tr '_' ' ')
    
    # 이미 적용된 마이그레이션인지 확인
    if [[ ",$APPLIED_MIGRATIONS," == *",$version,"* ]]; then
        echo -e "${BLUE}⏭️  스킵: $filename (이미 적용됨)${NC}"
        continue
    fi
    
    echo -e "${YELLOW}🔄 실행 중: $filename${NC}"
    
    start_time=$(date +%s)
    
    # 마이그레이션 실행
    if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration_file" > /dev/null 2>&1; then
        end_time=$(date +%s)
        execution_time=$((end_time - start_time))
        
        # 성공 기록
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        INSERT INTO flyway_schema_history (
            installed_rank, version, description, type, script, 
            installed_by, execution_time, success
        ) VALUES (
            (SELECT COALESCE(MAX(installed_rank), 0) + 1 FROM flyway_schema_history),
            '$version', '$description', 'SQL', '$filename',
            '$DB_USER', $execution_time, true
        );
        " > /dev/null
        
        echo -e "${GREEN}✅ 완료: $filename (${execution_time}초)${NC}"
    else
        # 실패 기록
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        INSERT INTO flyway_schema_history (
            installed_rank, version, description, type, script, 
            installed_by, execution_time, success
        ) VALUES (
            (SELECT COALESCE(MAX(installed_rank), 0) + 1 FROM flyway_schema_history),
            '$version', '$description', 'SQL', '$filename',
            '$DB_USER', 0, false
        );
        " > /dev/null
        
        echo -e "${RED}❌ 실패: $filename${NC}"
        echo -e "${RED}마이그레이션이 실패했습니다. 로그를 확인하세요.${NC}"
        exit 1
    fi
done

# MongoDB 초기화
echo -e "${YELLOW}MongoDB 초기화...${NC}"
MONGO_HOST=${MONGO_HOST:-localhost}
MONGO_PORT=${MONGO_PORT:-27017}
MONGO_INIT_SCRIPT="$SCRIPT_DIR/../docker/mongodb/init/01-init-automation.js"

if [ -f "$MONGO_INIT_SCRIPT" ]; then
    if mongosh --host $MONGO_HOST:$MONGO_PORT < "$MONGO_INIT_SCRIPT" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ MongoDB 초기화 완료${NC}"
    else
        echo -e "${YELLOW}⚠️  MongoDB 초기화 스킵 (이미 초기화됨 또는 연결 실패)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  MongoDB 초기화 스크립트 없음${NC}"
fi

# 마이그레이션 상태 확인
echo -e "${YELLOW}마이그레이션 상태 확인...${NC}"
MIGRATION_STATUS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    version,
    description,
    installed_on,
    execution_time,
    CASE WHEN success THEN '✅' ELSE '❌' END as status
FROM flyway_schema_history 
ORDER BY installed_rank;
")

echo "$MIGRATION_STATUS"

# 최종 검증
echo -e "${YELLOW}최종 스키마 검증...${NC}"
VALIDATION_SCRIPT="$SCRIPT_DIR/validate-schema.sh"
if [ -f "$VALIDATION_SCRIPT" ] && [ -x "$VALIDATION_SCRIPT" ]; then
    if "$VALIDATION_SCRIPT"; then
        echo -e "${GREEN}✅ 스키마 검증 성공${NC}"
    else
        echo -e "${RED}❌ 스키마 검증 실패${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  스키마 검증 스크립트 없음 또는 실행 권한 없음${NC}"
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ 모든 마이그레이션 완료${NC}"
echo -e "${BLUE}========================================${NC}"

# 요약 정보
TOTAL_TABLES=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
")

TOTAL_INDEXES=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';
")

echo -e "${YELLOW}데이터베이스 구성 요약:${NC}"
echo "- 테이블: $TOTAL_TABLES개"
echo "- 인덱스: $TOTAL_INDEXES개"
echo "- 적용된 마이그레이션: ${#MIGRATION_FILES[@]}개"
echo ""
echo -e "${GREEN}데이터베이스가 v3.1 아키텍처에 따라 성공적으로 구성되었습니다.${NC}"
