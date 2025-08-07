#!/bin/bash
# 서비스 재빌드 및 재시작 스크립트

echo "🔧 서비스 재빌드 및 재시작 시작..."
echo ""

# 1. MCP Service 재빌드
echo "📦 MCP Service 재빌드..."
docker-compose build mcp-service

# 2. Gateway 재빌드  
echo "📦 Gateway 재빌드..."
docker-compose build gateway

# 3. 서비스 재시작
echo "🔄 서비스 재시작..."
docker-compose up -d mcp-service gateway

echo "⏳ 서비스 안정화 대기 (20초)..."
sleep 20

# 4. 헬스체크 테스트
echo ""
echo "🔍 헬스체크 확인..."
echo "-------------------"

echo -n "MCP Service: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:8201/health
echo ""

echo -n "Gateway: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/gateway/health
echo ""

echo ""
echo "✅ 완료!"
echo ""
echo "📍 대시보드 확인: http://localhost:3001"
echo "💬 채팅 테스트: http://localhost:3001/chat"
