#!/bin/bash

echo "🌐 Chat 페이지 접근 테스트 시작..."

# Main App이 실행 중인지 확인
echo "📱 Main App 상태 확인..."
if curl -s http://localhost:3001 > /dev/null; then
    echo "✅ Main App 정상 실행 중 (http://localhost:3001)"
else
    echo "❌ Main App 접근 실패"
    exit 1
fi

# Gateway 상태 확인
echo "🔗 API Gateway 상태 확인..."
if curl -s http://localhost:8080/api/v1/health > /dev/null 2>&1; then
    echo "✅ API Gateway 정상 실행 중 (http://localhost:8080)"
else
    echo "⚠️  API Gateway 헬스체크 실패 (정상일 수 있음)"
fi

# 백엔드 API 테스트
echo "🧪 백엔드 Chat API 테스트..."

# 1. 로그인 토큰 획득
echo "🔐 토큰 획득 중..."
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin123!@#"}' | jq -r '.accessToken' 2>/dev/null)

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo "✅ 토큰 획득 성공: ${TOKEN:0:50}..."
else
    echo "❌ 토큰 획득 실패"
    exit 1
fi

# 2. 간단한 메시지 테스트
echo "💬 간단한 메시지 테스트: '안녕하세요'"
RESPONSE=$(curl -s -X POST http://localhost:8080/api/v1/workflows/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "안녕하세요", "sessionId": "550e8400-e29b-41d4-a716-446655440001"}')

echo "응답 결과:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

# 성공 여부 확인
if echo "$RESPONSE" | jq -e '.message' > /dev/null 2>&1; then
    MESSAGE=$(echo "$RESPONSE" | jq -r '.message')
    echo ""
    echo "✅ Chat API 정상 작동!"
    echo "🤖 AI 응답: $MESSAGE"
    
    # 브라우저에서 Chat 페이지 열기
    echo ""
    echo "🌐 브라우저에서 Chat 페이지를 여는 중..."
    echo "📍 URL: http://localhost:3001/chat"
    
    open "http://localhost:3001/chat" 2>/dev/null || \
    xdg-open "http://localhost:3001/chat" 2>/dev/null || \
    echo "⚠️  수동으로 브라우저에서 http://localhost:3001/chat 를 열어주세요"
    
    echo ""
    echo "🎉 테스트 완료! 다음을 확인하세요:"
    echo "1. 브라우저에서 로그인 페이지가 열림 (admin / Admin123!@#)"
    echo "2. 로그인 후 사이드바에서 '채팅' 메뉴 클릭"
    echo "3. 채팅창에서 '안녕하세요' 입력 후 전송"
    echo "4. AI가 응답하는지 확인"
    
else
    echo "❌ Chat API 응답 실패"
    echo "응답 내용: $RESPONSE"
    exit 1
fi
