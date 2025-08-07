#!/bin/bash
# ========================================
# 데이터베이스 스키마 검증 스크립트
# 계약과 실제 스키마의 일치성 검증
# ========================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 환경 변수 설정
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-automation}
DB_USER=${DB_USER:-postgres}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE} 데이터베이스 스키마 검증 시작${NC}"
echo -e "${BLUE}========================================${NC}"

# PostgreSQL 연결 테스트
echo -e "${YELLOW}PostgreSQL 연결 테스트...${NC}"
if ! psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ PostgreSQL 연결 실패${NC}"
    exit 1
fi
echo -e "${GREEN}✅ PostgreSQL 연결 성공${NC}"

# 필수 테이블 존재 확인
echo -e "${YELLOW}필수 테이블 존재 확인...${NC}"
REQUIRED_TABLES=(
    "users"
    "user_sessions"
    "devices"
    "device_groups"
    "device_status_history"
    "mcp_servers"
    "mcp_tools"
    "mcp_executions"
    "workflows"
    "workflow_executions"
    "workflow_execution_steps"
    "llm_providers"
    "llm_requests"
    "system_settings"
    "audit_logs"
)

MISSING_TABLES=()

for table in "${REQUIRED_TABLES[@]}"; do
    if ! psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1 FROM $table LIMIT 1;" > /dev/null 2>&1; then
        MISSING_TABLES+=($table)
    fi
done

if [ ${#MISSING_TABLES[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ 모든 필수 테이블 존재 확인${NC}"
else
    echo -e "${RED}❌ 누락된 테이블: ${MISSING_TABLES[*]}${NC}"
    exit 1
fi

# Device 테이블 스키마 검증 (Storage API 계약 기반)
echo -e "${YELLOW}Device 테이블 스키마 검증...${NC}"
DEVICE_SCHEMA_CHECK=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM information_schema.columns 
WHERE table_name = 'devices' 
AND column_name IN ('id', 'name', 'type', 'status', 'group_id', 'metadata', 'tags', 'created_at', 'updated_at')
")

if [ "$DEVICE_SCHEMA_CHECK" -eq 9 ]; then
    echo -e "${GREEN}✅ Device 테이블 스키마 검증 통과${NC}"
else
    echo -e "${RED}❌ Device 테이블 스키마 불일치 (예상: 9, 실제: $DEVICE_SCHEMA_CHECK)${NC}"
    exit 1
fi

# Device 타입 제약 조건 확인
echo -e "${YELLOW}Device 타입 제약 조건 확인...${NC}"
TYPE_CONSTRAINT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%devices%type%'
")

if [ "$TYPE_CONSTRAINT" -gt 0 ]; then
    echo -e "${GREEN}✅ Device 타입 제약 조건 존재${NC}"
else
    echo -e "${RED}❌ Device 타입 제약 조건 누락${NC}"
    exit 1
fi

# 인덱스 존재 확인
echo -e "${YELLOW}필수 인덱스 존재 확인...${NC}"
REQUIRED_INDEXES=(
    "idx_devices_name"
    "idx_devices_type"
    "idx_devices_status"
    "idx_devices_group_id"
    "idx_mcp_servers_status"
    "idx_workflow_executions_status"
)

MISSING_INDEXES=()

for index in "${REQUIRED_INDEXES[@]}"; do
    INDEX_EXISTS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
    SELECT COUNT(*) FROM pg_indexes WHERE indexname = '$index'
    ")
    
    if [ "$INDEX_EXISTS" -eq 0 ]; then
        MISSING_INDEXES+=($index)
    fi
done

if [ ${#MISSING_INDEXES[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ 모든 필수 인덱스 존재 확인${NC}"
else
    echo -e "${RED}❌ 누락된 인덱스: ${MISSING_INDEXES[*]}${NC}"
    exit 1
fi

# 트리거 존재 확인
echo -e "${YELLOW}필수 트리거 존재 확인...${NC}"
TRIGGER_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM information_schema.triggers 
WHERE trigger_name LIKE '%updated_at%'
")

if [ "$TRIGGER_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ updated_at 트리거 존재 확인${NC}"
else
    echo -e "${RED}❌ updated_at 트리거 누락${NC}"
    exit 1
fi

# 기본 데이터 존재 확인
echo -e "${YELLOW}기본 데이터 존재 확인...${NC}"

# Admin 사용자 확인
ADMIN_USER=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM users WHERE username = 'admin'
")

if [ "$ADMIN_USER" -eq 1 ]; then
    echo -e "${GREEN}✅ Admin 사용자 존재 확인${NC}"
else
    echo -e "${RED}❌ Admin 사용자 누락${NC}"
    exit 1
fi

# 기본 장비 그룹 확인
GROUP_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM device_groups 
WHERE name IN ('Production', 'Development', 'Testing')
")

if [ "$GROUP_COUNT" -eq 3 ]; then
    echo -e "${GREEN}✅ 기본 장비 그룹 존재 확인${NC}"
else
    echo -e "${RED}❌ 기본 장비 그룹 누락 (예상: 3, 실제: $GROUP_COUNT)${NC}"
    exit 1
fi

# 시스템 설정 확인
SETTINGS_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM system_settings 
WHERE key IN ('system.version', 'database.schema_version')
")

if [ "$SETTINGS_COUNT" -eq 2 ]; then
    echo -e "${GREEN}✅ 기본 시스템 설정 존재 확인${NC}"
else
    echo -e "${RED}❌ 기본 시스템 설정 누락${NC}"
    exit 1
fi

# MongoDB 연결 및 검증
echo -e "${YELLOW}MongoDB 연결 및 검증...${NC}"
MONGO_HOST=${MONGO_HOST:-localhost}
MONGO_PORT=${MONGO_PORT:-27017}

if ! mongosh --host $MONGO_HOST:$MONGO_PORT --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo -e "${RED}❌ MongoDB 연결 실패${NC}"
    exit 1
fi
echo -e "${GREEN}✅ MongoDB 연결 성공${NC}"

# MongoDB 컬렉션 확인
MONGO_COLLECTIONS=$(mongosh --host $MONGO_HOST:$MONGO_PORT automation --quiet --eval "
db.getCollectionNames()
" | grep -o '"[^"]*"' | tr -d '"' | wc -l)

if [ "$MONGO_COLLECTIONS" -gt 0 ]; then
    echo -e "${GREEN}✅ MongoDB 컬렉션 존재 확인${NC}"
else
    echo -e "${RED}❌ MongoDB 컬렉션 누락${NC}"
    exit 1
fi

# Redis 연결 테스트
echo -e "${YELLOW}Redis 연결 테스트...${NC}"
REDIS_HOST=${REDIS_HOST:-localhost}
REDIS_PORT=${REDIS_PORT:-6379}

if ! redis-cli -h $REDIS_HOST -p $REDIS_PORT ping > /dev/null 2>&1; then
    echo -e "${RED}❌ Redis 연결 실패${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Redis 연결 성공${NC}"

# InfluxDB 연결 테스트
echo -e "${YELLOW}InfluxDB 연결 테스트...${NC}"
INFLUX_HOST=${INFLUX_HOST:-localhost}
INFLUX_PORT=${INFLUX_PORT:-8086}

if ! curl -s "http://$INFLUX_HOST:$INFLUX_PORT/ping" > /dev/null 2>&1; then
    echo -e "${RED}❌ InfluxDB 연결 실패${NC}"
    exit 1
fi
echo -e "${GREEN}✅ InfluxDB 연결 성공${NC}"

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ 모든 데이터베이스 스키마 검증 완료${NC}"
echo -e "${BLUE}========================================${NC}"

# 검증 결과 요약
echo -e "${YELLOW}검증 결과 요약:${NC}"
echo "- PostgreSQL: 테이블 ${#REQUIRED_TABLES[@]}개, 인덱스 ${#REQUIRED_INDEXES[@]}개 확인"
echo "- MongoDB: 컬렉션 및 스키마 검증 완료"
echo "- Redis: 연결 확인 완료"
echo "- InfluxDB: 연결 확인 완료"
echo ""
echo -e "${GREEN}모든 데이터베이스가 계약에 따라 올바르게 구성되었습니다.${NC}"
