#!/bin/bash
# test-n8n-real-api.sh

echo "🧪 n8n 실제 API 구조 확인..."

# Basic Auth 설정
AUTH="admin:Admin123!@#"
BASE_URL="http://localhost:5678"

echo -e "\n1. Health Check..."
curl -s -o /dev/null -w "Health endpoint: %{http_code}\n" $BASE_URL/healthz

echo -e "\n2. 가능한 모든 API 경로 테스트..."

# 다양한 경로 조합 테스트
PATHS=(
    "/"
    "/api"
    "/api/v1"
    "/rest"
    "/rest/workflows"
    "/rest/executions"
    "/rest/credentials"
    "/api/v1/workflows"
    "/api/v1/executions"
    "/api/workflows"
    "/api/executions"
    "/workflows"
    "/executions"
)

for path in "${PATHS[@]}"; do
    echo -n "Testing $path: "
    
    # Basic Auth로 시도
    response=$(curl -s -o /dev/null -w "%{http_code}" -u "$AUTH" "$BASE_URL$path")
    echo -n "Basic Auth=$response"
    
    # Auth 없이 시도
    response_noauth=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$path")
    echo " | No Auth=$response_noauth"
    
    # 200이면 성공 표시
    if [ "$response" == "200" ] || [ "$response_noauth" == "200" ]; then
        echo "  ✅ SUCCESS - Valid endpoint found!"
    fi
done

echo -e "\n3. Webhook 엔드포인트 확인..."
curl -s -o /dev/null -w "Production webhook: %{http_code}\n" $BASE_URL/webhook-prod/test
curl -s -o /dev/null -w "Test webhook: %{http_code}\n" $BASE_URL/webhook-test/test
curl -s -o /dev/null -w "Webhook (generic): %{http_code}\n" $BASE_URL/webhook/test

echo -e "\n✅ 테스트 완료"
