#!/bin/bash
# 시스템 상태 확인 스크립트

echo "🔍 통합 자동화 시스템 v3.1 상태 확인"
echo "================================="
echo ""

# 1. Docker 컨테이너 상태
echo "📦 1. Docker 컨테이너 상태:"
echo "----------------------------"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep automation
echo ""

# 2. Kafka 토픽 상태
echo "📨 2. Kafka 토픽 상태:"
echo "----------------------"
docker exec automation-kafka /bin/kafka-topics --list --bootstrap-server localhost:9092
echo ""

# 3. 서비스 로그 확인 (에러만)
echo "⚠️  3. 최근 에러 로그:"
echo "---------------------"
for service in storage device-service mcp-service llm-service workflow-engine gateway; do
    echo "[$service]"
    docker logs automation-$service --tail 10 2>&1 | grep -i "error" | head -3
done
echo ""

# 4. API 응답 테스트
echo "🌐 4. API 엔드포인트 테스트:"
echo "---------------------------"
# Storage Service
echo -n "Storage Service: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/health
echo ""

# Device Service  
echo -n "Device Service: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:8101/health
echo ""

# MCP Service
echo -n "MCP Service: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:8201/health
echo ""

# LLM Service
echo -n "LLM Service: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:8301/health
echo ""

# Workflow Engine
echo -n "Workflow Engine: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:8401/health
echo ""

# Gateway
echo -n "API Gateway: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/auth/health
echo ""

echo ""
echo "✅ 상태 확인 완료!"
