#!/bin/bash

echo "🧪 n8n API 테스트 시작..."

# 1. 기본 인증 정보
AUTH="admin:Admin123!@#"
BASE_URL="http://localhost:5678"

# 2. 워크플로우 목록 조회
echo "1. 워크플로우 목록 조회..."
curl -s -u $AUTH $BASE_URL/rest/workflows | python3 -m json.tool 2>/dev/null || echo "Failed to get workflows"

# 3. 실행 관련 엔드포인트 테스트
echo -e "\n2. 실행 관련 엔드포인트 테스트..."

# 가능한 실행 API 후보들
ENDPOINTS=(
    "/rest/executions"
    "/rest/executions/current"
    "/rest/workflow-executions"
    "/api/v1/executions"
    "/api/v1/workflows/run"
)

for endpoint in "${ENDPOINTS[@]}"; do
    echo "Testing: $endpoint"
    response=$(curl -s -o /dev/null -w "%{http_code}" -u $AUTH $BASE_URL$endpoint)
    echo "  Response code: $response"
done

# 4. Webhook 엔드포인트 확인
echo -e "\n3. Webhook 엔드포인트 확인..."
curl -s -o /dev/null -w "Production webhook: %{http_code}\n" $BASE_URL/webhook-prod/test
curl -s -o /dev/null -w "Test webhook: %{http_code}\n" $BASE_URL/webhook-test/test

echo -e "\n✅ 테스트 완료"
