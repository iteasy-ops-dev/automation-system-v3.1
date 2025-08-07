#!/bin/bash

# MCP 통합 테스트 스크립트 (Bash)
GATEWAY_URL="http://localhost:8080"

echo "🔧 MCP 통합 테스트 시작..."
echo ""

# 1. 로그인
echo "1️⃣ 로그인 시도..."
TOKEN_RESPONSE=$(curl -s -X POST "$GATEWAY_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!@#"}')

TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | sed 's/"accessToken":"//;s/"//')

if [ -z "$TOKEN" ]; then
  echo "❌ 로그인 실패: $TOKEN_RESPONSE"
  exit 1
fi

echo "✅ 로그인 성공"
echo ""

# 2. 채팅 세션 생성
echo "2️⃣ 채팅 세션 생성..."
SESSION_RESPONSE=$(curl -s -X POST "$GATEWAY_URL/api/v1/chat/sessions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"MCP 통합 테스트"}')

SESSION_ID=$(echo "$SESSION_RESPONSE" | grep -o '"id":"[^"]*"' | sed 's/"id":"//;s/"//')

if [ -z "$SESSION_ID" ]; then
  echo "❌ 세션 생성 실패: $SESSION_RESPONSE"
  exit 1
fi

echo "✅ 세션 생성: $SESSION_ID"
echo ""

# 3. MCP 통합 테스트: 서버 상태 확인 (직접 Workflow Engine 호출)
echo "3️⃣ MCP 통합 테스트: '서버 상태 확인해줘'"
CHAT_RESPONSE=$(curl -s -X POST "http://localhost:8401/api/v1/workflows/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "123e4567-e89b-12d3-a456-426614174000",
    "message": "서버 상태 확인해줘",
    "context": {"type": "infrastructure"}
  }')

echo "📝 MCP 통합 응답:"
echo "$CHAT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CHAT_RESPONSE"
echo ""

# 4. 기본 기능 테스트: 간단한 계산
echo "4️⃣ 기본 기능 테스트: '5 + 3'"
CALC_RESPONSE=$(curl -s -X POST "http://localhost:8401/api/v1/workflows/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "123e4567-e89b-12d3-a456-426614174000",
    "message": "5 + 3",
    "context": {"type": "calculation"}
  }')

echo "📝 계산 응답:"
echo "$CALC_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CALC_RESPONSE"
echo ""

echo "✅ 모든 테스트 완료!"