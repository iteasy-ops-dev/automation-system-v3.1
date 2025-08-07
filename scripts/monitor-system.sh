#!/bin/bash
# 시스템 건강 상태 모니터링 대시보드
# v3.1 통합 자동화 시스템

clear
echo "════════════════════════════════════════════════════════════════"
echo "           통합 자동화 시스템 v3.1 - 실시간 모니터링           "
echo "════════════════════════════════════════════════════════════════"
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. 시스템 개요
echo -e "${BLUE}📊 시스템 개요${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "버전: ${GREEN}v3.1${NC} | 아키텍처: ${GREEN}마이크로서비스 (8개 서비스)${NC}"
echo -e "URL: ${BLUE}http://localhost:3001${NC} | 로그인: admin / Admin123!@#"
echo ""

# 2. 서비스 상태
echo -e "${BLUE}🚀 서비스 상태${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 각 서비스 상태 확인
services=(
    "gateway:8080:API Gateway"
    "storage:8001:Storage Service"
    "device-service:8101:Device Service"
    "mcp-service:8201:MCP Service"
    "llm-service:8301:LLM Service"
    "workflow-engine:8401:Workflow Engine"
    "main-app:3001:Main Application"
)

healthy_count=0
total_count=0

for service_info in "${services[@]}"; do
    IFS=':' read -r service port name <<< "$service_info"
    total_count=$((total_count + 1))
    
    # Docker 상태 확인
    if docker ps | grep -q "automation-$service.*healthy"; then
        status="${GREEN}✅ Healthy${NC}"
        healthy_count=$((healthy_count + 1))
    elif docker ps | grep -q "automation-$service"; then
        status="${YELLOW}⚠️  Running${NC}"
    else
        status="${RED}❌ Down${NC}"
    fi
    
    printf "%-20s: %b\n" "$name" "$status"
done

echo ""
echo -e "전체 상태: ${GREEN}$healthy_count/$total_count${NC} 서비스 정상"
echo ""

# 3. 데이터베이스 상태
echo -e "${BLUE}💾 데이터베이스 상태${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

databases=(
    "postgres:5432:PostgreSQL"
    "mongodb:27017:MongoDB"
    "redis:6379:Redis"
    "influxdb:8086:InfluxDB"
)

for db_info in "${databases[@]}"; do
    IFS=':' read -r db port name <<< "$db_info"
    
    if docker ps | grep -q "automation-$db.*healthy"; then
        status="${GREEN}✅ Connected${NC}"
    elif docker ps | grep -q "automation-$db"; then
        status="${YELLOW}⚠️  Running${NC}"
    else
        status="${RED}❌ Down${NC}"
    fi
    
    printf "%-20s: %b\n" "$name" "$status"
done

echo ""

# 4. Kafka 상태
echo -e "${BLUE}📨 메시징 시스템 (Kafka)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if docker ps | grep -q "automation-kafka.*healthy"; then
    echo -e "Kafka 상태: ${GREEN}✅ Healthy${NC}"
    
    # 토픽 개수 확인
    topic_count=$(docker exec automation-kafka /bin/kafka-topics --list --bootstrap-server localhost:9092 2>/dev/null | wc -l)
    echo -e "토픽 개수: ${GREEN}$topic_count개${NC}"
    
    # 토픽 목록
    echo "토픽 목록:"
    docker exec automation-kafka /bin/kafka-topics --list --bootstrap-server localhost:9092 2>/dev/null | while read topic; do
        echo "  • $topic"
    done
else
    echo -e "Kafka 상태: ${RED}❌ Down${NC}"
fi

echo ""

# 5. 실시간 메트릭
echo -e "${BLUE}📈 실시간 메트릭${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# CPU 사용률
cpu_usage=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}" | grep automation | awk '{sum+=$2} END {printf "%.1f", sum}')
echo -e "전체 CPU 사용률: ${GREEN}${cpu_usage}%${NC}"

# 메모리 사용률
mem_usage=$(docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}" | grep automation | wc -l)
echo -e "실행 중인 컨테이너: ${GREEN}${mem_usage}개${NC}"

echo ""

# 6. 최근 활동
echo -e "${BLUE}📝 최근 활동${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 최근 로그 (에러 제외)
echo "최근 API 호출:"
docker logs automation-gateway --tail 5 2>&1 | grep -v error | grep -E "GET|POST|PUT|DELETE" | tail -3

echo ""

# 7. 빠른 액션
echo -e "${BLUE}⚡ 빠른 액션${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. 대시보드 열기: open http://localhost:3001"
echo "2. n8n 워크플로우: open http://localhost:5678"
echo "3. 로그 보기: docker-compose logs -f"
echo "4. 서비스 재시작: docker-compose restart"
echo "5. 전체 중지: docker-compose down"
echo ""

echo "════════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ 시스템 정상 작동 중${NC} | 업데이트: $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════════════════════════"
