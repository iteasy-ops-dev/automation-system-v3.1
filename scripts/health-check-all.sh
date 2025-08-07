#!/bin/bash

echo "=== 통합 자동화 시스템 헬스체크 ==="
echo "시간: $(date)"
echo ""

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# 헬스체크 함수
check_health() {
    local service_name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "[$service_name]: "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" $url 2>/dev/null)
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✅ Healthy${NC} (HTTP $response)"
        # 상세 정보 가져오기
        curl -s $url | jq '.' 2>/dev/null || echo "JSON 파싱 실패"
    else
        echo -e "${RED}❌ Unhealthy${NC} (HTTP $response)"
    fi
    echo ""
}

# 서비스별 헬스체크
echo "=== Core Services ==="
check_health "Storage Service" "http://localhost:8001/health"
check_health "API Gateway" "http://localhost:8080/health"

echo ""
echo "=== Domain Services ==="
check_health "Device Service" "http://localhost:8101/health"
check_health "MCP Service" "http://localhost:8201/health"
check_health "LLM Service" "http://localhost:8301/health"

echo ""
echo "=== Data Stores ==="
# PostgreSQL
echo -n "[PostgreSQL]: "
if PGPASSWORD=automation_postgres_pass_2024 psql -h localhost -U postgres -d automation -c "SELECT 1" &>/dev/null; then
    echo -e "${GREEN}✅ Connected${NC}"
else
    echo -e "${RED}❌ Connection Failed${NC}"
fi

# MongoDB
echo -n "[MongoDB]: "
if mongosh --host localhost:27017 -u admin -p automation_mongo_pass_2024 --authenticationDatabase admin --eval "db.adminCommand('ping')" &>/dev/null; then
    echo -e "${GREEN}✅ Connected${NC}"
else
    echo -e "${RED}❌ Connection Failed${NC}"
fi

# Redis
echo -n "[Redis]: "
if redis-cli -h localhost -a automation_redis_pass_2024 ping &>/dev/null; then
    echo -e "${GREEN}✅ Connected${NC}"
else
    echo -e "${RED}❌ Connection Failed${NC}"
fi

# Kafka
echo -n "[Kafka]: "
if timeout 5 nc -zv localhost 9092 &>/dev/null; then
    echo -e "${GREEN}✅ Port Open${NC}"
else
    echo -e "${RED}❌ Port Closed${NC}"
fi

# InfluxDB
echo -n "[InfluxDB]: "
if curl -s http://localhost:8086/ping &>/dev/null; then
    echo -e "${GREEN}✅ Connected${NC}"
else
    echo -e "${RED}❌ Connection Failed${NC}"
fi

echo ""
echo "=== Docker 컨테이너 상태 ==="
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Service}}"
